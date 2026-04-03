const WebSocket = require('ws');
const http = require('http');
const { URL } = require('url');
const axios = require('axios'); // ★ 新增：用來向 EcoBot 發射保活訊號

const port = process.env.PORT || 10000;

// 儲存房間 (topic) 內的客戶端 (WebSocket 連線)
const topics = new Map();

// ★ 新增：儲存已註冊的留守機器人 (RoomName -> BotURL)
const activeBots = new Map(); 

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

  // ★ 原有功能：背景座標廣播 API
  if (req.url === '/api/location' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
          const { roomId, payload } = JSON.parse(body);
          
          if (roomId && payload) {
              const receivers = topics.get(roomId);
              if (receivers) {
                  const broadcastMsg = JSON.stringify({
                      type: 'TEAM_LOCATION_UPDATE',
                      data: payload
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

  // ★ 新增功能：EcoBot 報到櫃台
  if (req.url === '/register-bot' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { roomName, botUrl } = JSON.parse(body);
        if (roomName && botUrl) {
          activeBots.set(roomName, botUrl);
          console.log(`[母艦雷達] 🤖 發現 EcoBot 報到！房間：${roomName} | 網址：${botUrl}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Bot registered' }));
        } else {
          res.writeHead(400);
          res.end('Missing roomName or botUrl');
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
  res.end('Eco-Signaling Server Active with BG Support & Bot Commander');
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

// ============================================================================
// ★ 新增功能：母艦指揮官的保活巡邏系統 (每 8 分鐘執行一次)
// ============================================================================
// Render 的免費機器人 15 分鐘沒動靜會睡著，我們每 8 分鐘去敲一次門
setInterval(async () => {
  if (activeBots.size === 0) return;

  console.log(`[母艦巡邏] 正在巡視 ${activeBots.size} 台服役中的 EcoBot...`);
  
  for (const [roomName, botUrl] of activeBots.entries()) {
    try {
      // 對機器人的 /ping 發射請求
      await axios.get(`${botUrl}/ping`);
      console.log(`  ✅ [保活成功] ${roomName} 持續守衛中`);
    } catch (error) {
      console.log(`  ❌ [失聯警告] ${roomName} 的機器人無回應，已從雷達剔除`);
      // 如果機器人被隊長手動刪除或發生異常，把它從名單移除，避免一直戳浪費資源
      activeBots.delete(roomName);
    }
  }
}, 8 * 60 * 1000);

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port} with BG Support & Bot Commander`);
});
