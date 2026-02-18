const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Eco-Signaling Server is Running');
});

const wss = new WebSocket.Server({ server });

// 儲存房間內的客戶端
const rooms = new Map();

wss.on('connection', (conn, req) => {
  // 解析路徑作為房間名，如果只有 / 就給予預設值
  const rawPath = req.url.slice(1);
  const roomName = rawPath && rawPath !== '' ? rawPath : 'default-room';
  
  console.log(`[連線成功] 房間: ${roomName} (原始路徑: ${req.url})`);

  // 將連線加入房間
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const clients = rooms.get(roomName);
  clients.add(conn);

  // 定時發送 Ping 防止 Render 休眠/斷線
  const pingInterval = setInterval(() => {
    if (conn.readyState === WebSocket.OPEN) {
      conn.ping();
    }
  }, 30000);

  conn.on('message', (data) => {
    // 收到訊息，只轉發給同房間的其他隊友
    clients.forEach((client) => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  conn.on('close', () => {
    console.log(`[連線中斷] 房間: ${roomName}`);
    clients.delete(conn);
    if (clients.size === 0) {
      rooms.delete(roomName);
    }
    clearInterval(pingInterval);
  });

  conn.on('error', (err) => {
    console.error(`[連線錯誤] ${err.message}`);
  });
});

server.listen(port, () => {
  console.log(`伺服器已啟動於 Port ${port}`);
});