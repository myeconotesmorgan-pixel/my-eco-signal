const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 10000;

// 建立 HTTP 伺服器
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Eco-Signaling Server Active (Official Protocol)');
});

const wss = new WebSocket.Server({ server });

// 儲存房間 (topic) 內的客戶端
const topics = new Map();

// 安全發送 JSON 訊息的工具
const send = (conn, message) => {
  if (conn.readyState !== WebSocket.CONNECTING && conn.readyState !== WebSocket.OPEN) {
    conn.close();
    return;
  }
  try {
    conn.send(JSON.stringify(message));
  } catch (e) {
    conn.close();
  }
};

wss.on('connection', conn => {
  // 紀錄這個連線訂閱了哪些房間
  const subscribedTopics = new Set();
  let isAlive = true;

  conn.on('pong', () => { isAlive = true; });

  conn.on('message', messageStr => {
    let message;
    try {
      // 破案關鍵：y-webrtc 的信號全都是 JSON 字串！
      message = JSON.parse(messageStr);
    } catch (e) {
      return; // 忽略非 JSON 訊息
    }

    if (message && message.type) {
      switch (message.type) {
        case 'subscribe':
          // 真正的房間名稱 (topic) 藏在這裡！
          (message.topics || []).forEach(topicName => {
            subscribedTopics.add(topicName);
            let receivers = topics.get(topicName);
            if (!receivers) {
              receivers = new Set();
              topics.set(topicName, receivers);
            }
            receivers.add(conn);
            console.log(`[WS加入] 成功解析房間: ${topicName} | 目前人數: ${receivers.size}`);
          });
          break;
        case 'unsubscribe':
          (message.topics || []).forEach(topicName => {
            subscribedTopics.delete(topicName);
            const receivers = topics.get(topicName);
            if (receivers) {
              receivers.delete(conn);
              if (receivers.size === 0) topics.delete(topicName);
            }
          });
          break;
        case 'publish':
          // 轉發 P2P 握手訊號給同房間的其他人
          if (message.topic) {
            const receivers = topics.get(message.topic);
            if (receivers) {
              message.clients = receivers.size;
              receivers.forEach(receiver => {
                if (receiver !== conn) {
                  send(receiver, message);
                }
              });
            }
          }
          break;
        case 'ping':
          // ★★★ 防止斷線迴圈的關鍵！回傳 pong 給手機 ★★★
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
        console.log(`[WS退出] 房間: ${topicName} | 剩餘人數: ${receivers.size}`);
        if (receivers.size === 0) topics.delete(topicName);
      }
    });
    subscribedTopics.clear();
  });
  
  // Render 免費版防休眠心跳
  const pingInterval = setInterval(() => {
    if (!isAlive) {
      clearInterval(pingInterval);
      return conn.terminate();
    }
    isAlive = false;
    conn.ping();
  }, 30000);

  conn.on('close', () => clearInterval(pingInterval));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Signaling server running on port ${port} with Official Protocol`);
});