const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  // 🔴 這裡增加了紀錄，這樣手機瀏覽器打開網址時，Log 就會跳動！
  console.log(`[網頁存取] 收到來自 ${req.headers['x-forwarded-for'] || req.socket.remoteAddress} 的請求`);
  
  res.writeHead(200);
  res.end('Eco-Signaling Server Active');
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

wss.on('connection', (conn, req) => {
  // WebSocket 的路徑解析
  const roomName = req.url.slice(1) || 'default';
  
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const clients = rooms.get(roomName);
  clients.add(conn);

  console.log(`[WS連線] 房間: ${roomName} | 目前人數: ${clients.size}`);

  conn.on('message', (message) => {
    clients.forEach((client) => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: true });
      }
    });
  });

  conn.on('close', () => {
    clients.delete(conn);
    console.log(`[WS退出] 房間: ${roomName}`);
    if (clients.size === 0) rooms.delete(roomName);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server v6.0.4 is running on port ${port}`);
});