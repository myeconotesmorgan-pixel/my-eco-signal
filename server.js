const WebSocket = require('ws');
const http = require('http');
const url = require('url'); // 引入 URL 解析工具

const port = process.env.PORT || 10000; // Render 預設通常是 10000

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Eco-Signaling Server is Running');
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

wss.on('connection', (conn, req) => {
  // --- 強化路徑解析邏輯 ---
  const parsedUrl = url.parse(req.url, true);
  const pathRoom = parsedUrl.pathname ? parsedUrl.pathname.slice(1) : '';
  const queryRoom = parsedUrl.query ? parsedUrl.query.room : '';
  
  // 優先取路徑，若無則取參數，最後才給 default
  const roomName = pathRoom || queryRoom || 'default-room';
  
  console.log(`[連線成功] 房間: ${roomName} (完整網址: ${req.url})`);

  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const clients = rooms.get(roomName);
  clients.add(conn);

  // 心跳包
  const pingInterval = setInterval(() => {
    if (conn.readyState === WebSocket.OPEN) {
      conn.ping();
    }
  }, 30000);

  conn.on('message', (data) => {
    clients.forEach((client) => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  conn.on('close', () => {
    console.log(`[連線中斷] 房間: ${roomName}`);
    clients.delete(conn);
    if (clients.size === 0) rooms.delete(roomName);
    clearInterval(pingInterval);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`伺服器啟動於 Port ${port}`);
});