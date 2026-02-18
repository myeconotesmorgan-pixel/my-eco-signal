const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Signaling Server is Running');
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

wss.on('connection', (conn, req) => {
  // 標準解析：取出 / 之後的字串作為房間名
  const roomName = req.url.slice(1) || 'default';
  
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const clients = rooms.get(roomName);
  clients.add(conn);

  console.log(`[加入] 房間: ${roomName} | 人數: ${clients.size}`);

  conn.on('message', (message) => {
    // 關鍵：將 Yjs 的二進制數據轉發給同房間的人
    clients.forEach((client) => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: true });
      }
    });
  });

  conn.on('close', () => {
    clients.delete(conn);
    if (clients.size === 0) rooms.delete(roomName);
    console.log(`[退出] 房間: ${roomName}`);
  });

  // 每 30 秒發送一個 Ping 給手機，防止 Render 免費版斷線
  const heartbeat = setInterval(() => {
    if (conn.readyState === WebSocket.OPEN) conn.ping();
    else clearInterval(heartbeat);
  }, 30000);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server listen on port ${port}`);
});