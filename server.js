const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Eco-Signaling Server Active');
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

// 監聽連線
wss.on('connection', (conn, req) => {
  // --- [萬能路徑解析] ---
  // 從網址中抓取最後一個斜線後的內容作為房間名，並過濾掉特殊字元
  const urlParts = req.url.split('/');
  let roomName = urlParts[urlParts.length - 1] || 'default';
  
  // 處理可能帶有的查詢參數 (例如 ?room=)
  if (roomName.includes('?')) {
    const params = new URLSearchParams(roomName.split('?')[1]);
    roomName = params.get('room') || roomName.split('?')[0];
  }

  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const clients = rooms.get(roomName);
  clients.add(conn);

  console.log(`[連線成功] 房間: ${roomName} | 完整路徑: ${req.url}`);

  conn.on('message', (message) => {
    clients.forEach((client) => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        // 必須以 binary 模式傳送 yjs 資料
        client.send(message, { binary: true });
      }
    });
  });

  conn.on('close', () => {
    clients.delete(conn);
    if (clients.size === 0) rooms.delete(roomName);
    console.log(`[連線中斷] 房間: ${roomName}`);
  });

  // 強制保活
  const ping = setInterval(() => {
    if (conn.readyState === WebSocket.OPEN) conn.ping();
    else clearInterval(ping);
  }, 30000);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server v6 is running on port ${port}`);
});