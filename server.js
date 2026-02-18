const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 3000;

// 建立一個 HTTP 伺服器
const server = http.createServer((req, res) => {
  // 診斷：紀錄所有進入伺服器的 HTTP 請求
  console.log(`[HTTP Request] ${req.method} ${req.url}`);
  res.writeHead(200);
  res.end('Signaling server is alive');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  // 診斷：紀錄 WebRTC 的連線嘗試
  console.log(`[WS Connect] 收到連線請求，路徑: ${req.url}`);

  // y-webrtc 傳入的路徑通常是 /roomName
  const roomName = req.url.slice(1) || 'default';
  
  conn.on('message', message => {
    wss.clients.forEach(client => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  conn.on('close', () => console.log(`[WS Close] 連線已斷開`));
  conn.on('error', (err) => console.error(`[WS Error] ${err}`));
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});