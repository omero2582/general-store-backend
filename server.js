import './config/env.js';

import express from 'express';
import cors from 'cors'

import session from 'express-session';
import passport from 'passport';
import MongoStore from 'connect-mongo';

import MongoClient from './config/database.js';
import './config/google-auth.js';

import indexRouter from './routes/index.js'
import authRouter from './routes/auth.js'

import { errorHandler } from './middleware/errorMiddleware.js';
import { AuthenticationError } from './errors/errors.js';
import asyncHandler from 'express-async-handler';
import { overwriteReqJsonIncludeUser } from './middleware/authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';


import http from 'http';
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);


// // static files
// // need __dirname manually, since it is only available in CommonJS, and we changed to ES6 modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../frontend/dist')));
// app.use(cors())
app.use(express.json());

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false,
  resave: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  store: MongoStore.create({ 
    client: MongoClient,
    collectionName: 'sessions', // this is also defaullt name, so dont need to specify
    // ttl time in seconds to set expiry date on the session store. Dont need to specify because by default
    // mongo store will automatically use the value of maxAge that we set on the cookie as the value for ttl
  })
});
app.use(sessionMiddleware);  //research saveUninitailized and resave, think i need to set them to false if setting expiry maxAge

app.use(passport.session());

//

// Middleware to override res.json() to always include req.user
app.use(overwriteReqJsonIncludeUser);

app.get('/api/',
  asyncHandler(async (req, res) => {
    res.json({message: 'success'})
  })
);

// other routers, then
app.use('/api', indexRouter);

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '/../frontend/dist/index.html'));
});


// Error Handler (catch-all)
app.use(errorHandler);

// websockets
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite dev server address
    methods: ["GET", "POST"],
  },
})
// p sure I can thake out above, not sure tho
//

// https://socket.io/how-to/use-with-passport
// https://socket.io/docs/v4/how-it-works/
// https://socket.io/docs/v3/client-initialization/#low-level-engine-options
// https://www.youtube.com/watch?v=ZKEqqIO7n-k
function onlyForHandshake(middleware) {
  return (req, res, next) => {
    const isHandshake = req._query.sid === undefined;
    if (isHandshake) {
      middleware(req, res, next);
    } else {
      next();
    }
  };
}

// TODO, I think slution was for client to listen to socket.on('connect_error')
// and insdie it check the response, if its code 401 and .name = Unauthroized 
// then do socket.disconnect()
// then from here in the backend, just make sure to throw the rpoper error repsonse
// https://socket.io/docs/v4/emit-cheatsheet/

io.engine.use(onlyForHandshake(sessionMiddleware));
io.engine.use(onlyForHandshake(passport.session()));
// TODO change fn below so it stops polling if no user found....
io.engine.use(
  onlyForHandshake((req, res, next) => {
    if (req.user) {
      next();
    } else {
      res.writeHead(401);
      res.end();
    }
  }),
);

//
io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  const user = socket.request.user;
  const sessionId = socket.request.sessionID;

  if (user) {
    // const room = user.id;
    const room = sessionId; // session ID better... we only want to notify of logout to users
    // in the same session, AKA users using same browser instance
    socket.join(room);
    console.log(`Socket ${socket.id} joined user room: ${room}`);
    socket.emit("join-room", room) 
    // TODO also somho detect standalone token expiry on opened browsers???
  }

  // Handle client disconnect
  socket.on("disconnect", () => {
    console.log("Socket disconnected", socket.id);
  });

  // socket = singular connection from 1 client to server
  // socket.emit -> emits to that 1 socket/server
  // io.emit -> emits to all sockets
  // socket.broadcast.emit -> emits to all sockets except that 1 socket
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
// app.listen(PORT, () => { // when usig web sobkets, I use above which combines the app.liten and websocket listen
  console.log(`Server running on port ${PORT}`);
});

const hostname = '0.0.0.0';
// app.listen(port, hostname, () => {
//   console.log(`Server running at http://${hostname}:${port}/`);
// });
