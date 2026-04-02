const WebSocket = require('ws');
const http = require('http');
const { URL } = require('url');

const port = process.env.PORT || 10000;

// 儲存房間 (topic) 內的客戶端 (WebSocket 連線)
const topics = new Map();

// 建立 HTTP 伺服器
const server = http.createServer((req, res) => {
  // 設定 CORS，讓手機端能順利發送 POST
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理 Preflight 請求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ★ 新增：背景座標廣播 API (HTTP POST)
  if (req.url === '/api/location' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
          const { roomId, payload } = JSON.parse(body);
          
          if (roomId && payload) {
              const receivers = topics.get(roomId);
              if (receivers) {
                  // 找到房間內的所有在線隊友，把加密座標塞給他們的 WebSocket
                  const broadcastMsg = JSON.stringify({
                      type: 'TEAM_LOCATION_UPDATE',
                      data: payload // 這是加密過的亂碼，伺服器直接轉發
                  });
                  
                  receivers.forEach(client => {
                      if (client.readyState === WebSocket.OPEN) {
                          client.send(broadcastMsg);
                      }
                  });
              }
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('Broadcast successful');
          } else {
              res.writeHead(400);
              res.end('Missing roomId or payload');
          }
      } catch (e) {
          res.writeHead(400);
          res.end('Invalid JSON');
      }
    });
    return;
  }

  // 原有的基本回應
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Eco-Signaling Server Active with BG Support');
});

const wss = new WebSocket.Server({ server });

// 安全發送 JSON 訊息的工具
const send = (conn, message) => {
  if (conn.readyState === WebSocket.OPEN) {
    try {
      conn.send(JSON.stringify(message));
    } catch (e) {
      conn.close();
    }
  }
};

wss.on('connection', conn => {
  const subscribedTopics = new Set();
  let isAlive = true;

  conn.on('pong', () => { isAlive = true; });

  conn.on('message', messageStr => {
    let message;
    try {
      message = JSON.parse(messageStr);
    } catch (e) { return; }

    if (message && message.type) {
      switch (message.type) {
        case 'subscribe':
          (message.topics || []).forEach(topicName => {
            subscribedTopics.add(topicName);
            let receivers = topics.get(topicName);
            if (!receivers) {
              receivers = new Set();
              topics.set(topicName, receivers);
            }
            receivers.add(conn);
            console.log(`[加入房間] ${topicName} | 人數: ${receivers.size}`);
          });
          break;
        case 'publish':
          if (message.topic) {
            const receivers = topics.get(message.topic);
            if (receivers) {
              receivers.forEach(receiver => {
                if (receiver !== conn) send(receiver, message);
              });
            }
          }
          break;
        case 'ping':
          send(conn, { type: 'pong' });
          break;
      }
    }
  });

  conn.on('close', () => {
    subscribedTopics.forEach(topicName => {
      const receivers = topics.get(topicName);
      if (receivers) {
        receivers.delete(conn);
        if (receivers.size === 0) topics.delete(topicName);
      }
    });
  });
  
  const pingInterval = setInterval(() => {
    if (!isAlive) return conn.terminate();
    isAlive = false;
    conn.ping();
  }, 30000);

  conn.on('close', () => clearInterval(pingInterval));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port} with BG Support`);
});
