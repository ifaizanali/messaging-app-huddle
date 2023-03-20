const express = require('express')
const server = require('http')
const socketio = require("socket.io")
const { v4: uuidV4 } = require('uuid')
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express()


app.use(cors({
    origin: '*'
}));


app.get('/get-id', (req, res) => {
  res.send({id: uuidV4()})
})


let db = new sqlite3.Database('data.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database.');
});


app.get('/start-screen/:room/:user', (req, res) => {
  const room = req.params.room
  const user = req.params.user
  db.serialize(() => {
    db.run(`INSERT INTO screen_logs(room_uuid, user_uuid) VALUES(?,?)`, [room, user], function(err) {
      if (err) {
        res.send({satus: false})
      }
      res.send({status: true});
    });
  })
})


app.get('/get-screen/:room', async (req, res) => {
  const room = req.params.room
  const sql = `SELECT user_uuid FROM screen_logs WHERE room_uuid = ?`;
  db.all(sql, [room], (err, rows) => {
    if (err) {
      throw err;
    }
    res.send({users: rows.map(i => i.user_uuid)})
  });
})


app.get('/stop-screen/:room/:user', (req, res) => {
  const room = req.params.room
  const user = req.params.user
  db.serialize(() => {
    db.run(`DELETE FROM screen_logs WHERE room_uuid = ? AND user_uuid = ?`, [room, user], function(err) {
      if (err) {
        res.send({satus: false})
      }
      res.send({status: true});
    });
  })
})

app.get('/start-video/:room/:user', (req, res) => {
  const room = req.params.room
  const user = req.params.user
  db.serialize(() => {
    db.run(`INSERT INTO video_logs(room_uuid, user_uuid) VALUES(?,?)`, [room, user], function(err) {
      if (err) {
        res.send({satus: false})
      }
      res.send({status: true});
    });
  })
})

app.get('/get-video/:room', async (req, res) => {
  const room = req.params.room
  const sql = `SELECT user_uuid FROM video_logs WHERE room_uuid = ?`;
  db.all(sql, [room], (err, rows) => {
    if (err) {
      throw err;
    }
    res.send({users: rows.map(i => i.user_uuid)})
  });
})


app.get('/stop-video/:room/:user', (req, res) => {
  const room = req.params.room
  const user = req.params.user
  db.serialize(() => {
    db.run(`DELETE FROM video_logs WHERE room_uuid = ? AND user_uuid = ?`, [room, user], function(err) {
      if (err) {
        res.send({satus: false})
      }
      res.send({status: true});
    });
  })
})


const myserver = server.Server(app)
const io = socketio(myserver, {
  cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
})


io.on('connection', socket => {
  console.log("new client connected")
  socket.on('join-room', (roomId, userId) => {
    console.log(`room: ${roomId} user: ${userId}`)
    socket.join(roomId)
    socket.to(roomId).emit('user-connected', userId)
    socket.to(roomId).emit('get-screen')

    socket.on('disconnect', () => {
      console.log("user disconnected", userId)
      socket.to(roomId).emit('user-disconnected', userId)
    })
  })

  socket.on('start-screen-share', (roomId, screenId) => {
    console.log("screen share")
    socket.join(roomId)
    socket.to(roomId).emit('share-screen', screenId)
    socket.on('disconnect', () => {
      console.log("user disconnected", screenId)
      socket.to(roomId).emit('screen-disconnected', screenId)
    })
  })

  socket.on('stop-screen-share', (roomId, screenId) => {
    socket.join(roomId)
    socket.to(roomId).emit('screen-disconnected', screenId)
  })


  socket.on('start-video-share', (roomId, screenId) => {
    console.log("video share")
    socket.join(roomId)
    socket.to(roomId).emit('share-video', screenId)
    socket.on('disconnect', () => {
      console.log("video disconnected", screenId)
      socket.to(roomId).emit('video-disconnected', screenId)
    })
  })

  socket.on('stop-video-share', (roomId, screenId) => {
    socket.join(roomId)
    socket.to(roomId).emit('video-disconnected', screenId)
  })

})


myserver.listen(5000, () => {
	console.log("server is litening on port 5000");
})
