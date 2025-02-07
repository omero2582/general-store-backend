
import passport from "passport";
import { Server } from "socket.io";
import express from 'express';
import { instrument } from "@socket.io/admin-ui";
import { AuthorizationError } from "./errors/errors.js";
import cookieParser from "cookie-parser";
import cookie from 'cookie'

// websockets
// https://socket.io/docs/v4/emit-cheatsheet/
// https://socket.io/how-to/use-with-passport
// https://socket.io/docs/v4/how-it-works/
// https://socket.io/docs/v3/client-initialization/#low-level-engine-options
// https://www.youtube.com/watch?v=ZKEqqIO7n-k

// socket = singular connection from 1 client to server
// socket.emit -> emits to that 1 socket/server
// io.emit -> emits to all sockets
// socket.broadcast.emit -> emits to all sockets except that 1 socket

// export let io;
export const setupSocketIO = (server, sessionMiddleware) => {
  const io = new Server(server, {
    // cookie: {
    //   name: 'io',
    //   httpOnly: true,
    //   sameSite: 'strict',
    //   maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    // }
    // cors: {
    //   origin: "http://localhost:5173", // Vite dev server address
    //   methods: ["GET", "POST"],
    // },
    // transports: ["websocket", "polling"]
  })

  const wrap = expressMiddleware => (socket, next) => 
    expressMiddleware(socket.request, {}, next)

  const onlyForHandshake = (middleware) => {
    return (req, res, next) => {
      const isHandshake = req._query.sid === undefined;
      if (isHandshake) {
        middleware(req, res, next);
      } else {
        next();
      }
    };
  }

  io.engine.use(express.json());
  // io.engine.use(cookieParser());
  io.engine.use(onlyForHandshake(sessionMiddleware));
  io.engine.use(onlyForHandshake(passport.session()));

  // only establish websocket if they are user
  // io.use((socket, next) => {
  //   console.log('SID', socket.request.sessionID)
  //   console.log('QUERY', socket.handshake.query)
  //   console.log('user', socket.request.user)
  //   if (socket.request.user) {
  //     next();
  //   } else {
  //     const message = "Not Signed In, Stop WebSocket connection";
  //     const err = new AuthorizationError(message);
  //     next(err);
  //     // res.writeHead(403, { 'Content-Type': 'application/json' });
  //     // res.end(JSON.stringify({ error: message, message }));
  //     // return res.status(404).json(err) <--- doesnt work, socekt.io res is NOT express res
  //   }
  // }),


  // Handle WebSocket handshake errors
  io.engine.on("connection_error", (err) => {
    console.error("WebSocket handshake error:", err);
  });

  //
  io.on('connection', (socket) => {

    const user = socket.request.user; // user id is our DB user id
    const websocketId = socket.id // id for each websocket connection (new socket every tab)
    const cookies = cookie.parse(socket.request.headers.cookie || '');
    const clientId = cookies.clientId; // manual clientId cookie we set on each new browser/client
    const passportSessionId = socket.request.sessionID; //  cookie in the browser shared among tabs
    // request.sessionID === request.session.id
    console.log(`socket.id: ${websocketId} | request.sessionID: ${passportSessionId} | user.id: ${user?.id} | clientId: ${clientId}`);
    
    // Consider:
    // I connect to this server using 2 chrome tabs AND 1 firefox tab
    // This means I have: 3 websocket ids, 1 user if signed-in, then:
    // - 3 passport sessions IF not signed in 
    // - 2 passport sessions ONLY IF user is signed in OR if saveUnitialized: true
    // saveUnitialized is a session opt that determines if anonymous sessions are stored to DB
    // Setting it to false is good though, bc otherwise every new browser would
    // create a new DB doc (scaling issue to spam DB)
    
    // Our goal is -> changing log-in state from ur browser updates all tabs
    // But not other browser/devices logged into same user acc

    socket.join(clientId)
    socket.emit("join-room", clientId) 
    if (user) {
      socket.join(user.id)
      socket.emit("join-room", user.id) 
      // TODO somehow detect session cookie expiry and emit an event to all users ???
      // JK, it is best to not worry about this... bad for performance.
      // Also it is perfectly ok to rely on the user's next request
      // If our app really NEEDS to notify the user about their cookie expiry before 
      // their next request (rare case), then send a heartbeat emit from the CLIENT every X seconds
    }

    socket.on("disconnect", () => {
      console.log("Socket disconnected", socket.id);
    });

    socket.on('message', (message) => {
      console.log('mesage:', message)
    })

  });

  // socket.io Dev Dashboard 
  // https://admin.socket.io/
  instrument(io, {
    auth: false,
    mode: "development",
  });

  return io;
}
