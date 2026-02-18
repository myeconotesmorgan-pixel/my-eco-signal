const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Eco-Signaling Server v5 is Running');
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

wss.on('connection', (conn, req) => {
  // --- [超強力房間解析] ---
  // 同時嘗試從「路徑」或「參數」抓房間名
  const urlParts = req.url.split('room=');
  let roomName = 'default';
  
  if (urlParts.length > 1) {
    // 從 ?room=xxx 抓取
    roomName = urlParts[1].split('&')[0];
  } else {
    // 從 /xxx 路徑抓取
    roomName = req.url.split('/')[1] || 'default';
  }
  
  // 移除可能的多餘斜線
  roomName = roomName.replace(/\//g, '');

  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const clients = rooms.get(roomName);
  clients.add(conn);

  console.log(`[連線成功] 房間: ${roomName} | 網址: ${req.url}`);

  conn.on('message', (message) => {
    clients.forEach((client) => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: true });
      }
    });
  });

  conn.on('close', () => {
    clients.delete(conn);
    if (clients.size === 0) rooms.delete(roomName);
    console.log(`[連線中斷] 房間: ${roomName}`);
  });

  // 每 20 秒 Ping 一次手機，防止 Render 免費版中斷連線
  const interval = setInterval(() => {
    if (conn.readyState === WebSocket.OPEN) conn.ping();
    else clearInterval(interval);
  }, 20000);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server v5 listening on ${port}`);
});