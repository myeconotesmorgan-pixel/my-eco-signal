const WebSocket = require('ws')
const http = require('http')

const host = process.env.HOST || '0.0.0.0'
const port = process.env.PORT || 3000

// 建立一個房間管理地圖
const rooms = new Map()

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Signaling server is running')
})

const wss = new WebSocket.Server({ noServer: true })

wss.on('connection', (conn, req) => {
  // 從 URL 取得房間名稱 (例如 /room123)
  const roomName = req.url.slice(1)
  let room = rooms.get(roomName)
  if (room === undefined) {
    room = new Set()
    rooms.set(roomName, room)
  }
  room.add(conn)
  
  // 當收到訊息時，廣播給同一個房間的其他所有人
  conn.on('message', message => {
    room.forEach(client => {
      if (client !== conn && client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  })

  // 當連線中斷時，從房間移除
  conn.on('close', () => {
    room.delete(conn)
    if (room.size === 0) {
      rooms.delete(roomName)
    }
  })
})

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port, host, () => {
  console.log(`running at '${host}' on port ${port}`)
})