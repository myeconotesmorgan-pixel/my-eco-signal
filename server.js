const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Signaling Server Active');
});

const wss = new WebSocket.Server({ server });

// 房間管理：Map<RoomName, Set<WebSocket>>
const rooms = new Map();

wss.on('connection', (conn, req) => {
  // 解析房間名稱 (路徑)
  const roomName = req.url.slice(1) || 'default';
  
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const clients = rooms.get(roomName);
  clients.add(conn);

  console.log(`[加入] 房間: ${roomName} | 目前人數: ${clients.size}`);

  // 定時心跳探測，防止伺服器端超時
  conn.isAlive = true;
  conn.on('pong', () => { conn.isAlive = true; });

  conn.on('message', (message) => {
    // 收到訊息後，只轉發給「同房間」的「其他」客戶端
    clients.forEach((client) => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        // 直接轉發原始 Buffer 資料，不進行轉碼，確保 Yjs 協定完整
        client.send(message, { binary: true });
      }
    });
  });

  conn.on('close', () => {
    clients.delete(conn);
    console.log(`[退出] 房間: ${roomName} | 剩餘人數: ${clients.size}`);
    if (clients.size === 0) {
      rooms.delete(roomName);
    }
  });

  conn.on('error', (err) => {
    console.error(`[錯誤] ${roomName}: ${err.message}`);
  });
});

// 定期清理斷線客戶端
const interval = setInterval(() => {
  wss.clients.forEach((conn) => {
    if (conn.isAlive === false) return conn.terminate();
    conn.isAlive = false;
    conn.ping();
  });
}, 30000);

server.listen(port, '0.0.0.0', () => {
  console.log(`Signaling server running on port ${port}`);
});