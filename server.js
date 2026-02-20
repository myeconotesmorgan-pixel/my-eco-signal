const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
      console.log(`[HTTP 存取] 收到來自 ${req.headers['x-forwarded-for'] || req.socket.remoteAddress} 的健康檢查`);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Eco-Signaling Server v7 is Active');
  } else {
      res.writeHead(404);
      res.end();
  }
});

const wss = new WebSocket.Server({ server });

// 儲存房間：Map<roomName, Set<WebSocket>>
const rooms = new Map();

// 心跳機制（必須有，否則 Render 會切斷）
const pingInterval = setInterval(() => {
    wss.clients.forEach(conn => {
        if (!conn.isAlive) {
            return conn.terminate();
        }
        conn.isAlive = false;
        conn.ping();
    });
}, 30000);

wss.on('connection', (conn, req) => {
  conn.isAlive = true;
  conn.on('pong', () => { conn.isAlive = true; });

  // 【強化路徑解析】：確保無論如何都能抓到房間名
  let roomName = 'default';
  try {
      // 嘗試解析 y-webrtc 預設的格式 (通常在最後一個斜線後面)
      const urlParts = req.url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      // 排除掉可能是查詢參數的干擾
      roomName = lastPart.split('?')[0] || 'default';
  } catch (e) {
      console.error('[解析錯誤]', e);
  }

  // 將空白或異常短的路徑也歸為 default
  if (roomName.trim() === '' || roomName.length < 2) {
      roomName = 'default';
  }

  console.log(`[🟢 WS 加入] 房間: ${roomName} (原始請求: ${req.url})`);

  let room = rooms.get(roomName);
  if (!room) {
    room = new Set();
    rooms.set(roomName, room);
  }
  room.add(conn);

  // 【關鍵】：必須確保以二進位 (binary) 格式轉發
  conn.on('message', (message, isBinary) => {
      // y-webrtc 的訊號通常是二進位的 ArrayBuffer
      room.forEach(client => {
          if (client !== conn && client.readyState === WebSocket.OPEN) {
              // 強制使用 isBinary 標記，確保 Yjs 能正確解碼
              client.send(message, { binary: isBinary !== undefined ? isBinary : true });
          }
      });
  });

  conn.on('close', () => {
    room.delete(conn);
    if (room.size === 0) {
      rooms.delete(roomName);
    }
    console.log(`[🔴 WS 退出] 房間: ${roomName} | 剩餘人數: ${room.size}`);
  });
});

wss.on('close', () => {
    clearInterval(pingInterval);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server v7 is running on port ${port}`);
});