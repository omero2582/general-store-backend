
import passport from "passport";
import { Server } from "socket.io";
import express from 'express';
import { AuthorizationError } from "./errors/errors.js";
import { instrument } from "@socket.io/admin-ui";

// export let io;
export const setupSocketIO = (server, sessionMiddleware) => {
  // websockets
// https://socket.io/how-to/use-with-passport
// https://socket.io/docs/v4/how-it-works/
// https://socket.io/docs/v3/client-initialization/#low-level-engine-options
// https://www.youtube.com/watch?v=ZKEqqIO7n-k
const io = new Server(server, {
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

// TODO, I think slution was for client to listen to socket.on('connect_error')
// and insdie it check the response, if its code 401 and .name = Unauthroized 
// then do socket.disconnect()
// then from here in the backend, just make sure to throw the rpoper error repsonse
// https://socket.io/docs/v4/emit-cheatsheet/

io.engine.use(express.json());
io.engine.use(onlyForHandshake(sessionMiddleware));
io.engine.use(onlyForHandshake(passport.session()));
// TODO change fn below so it stops polling if no user found....
// io.engine.use(
//   onlyForHandshake((req, res, next) => {
//     if (req.user) {
//       next();
//     } else {
//       const message = "Not Signed In, Stop WebSocket connection";
//       // next(new Error(message));
//       res.writeHead(403, { 'Content-Type': 'application/json' });
//       res.end(JSON.stringify({ error: message, message }));
//       // return res.status(404).json(err) <--- doesnt work, socekt.io res is NOT express res
//     }
//   }),
// );
io.use((socket, next) => {
  console.log('SID', socket.request.sessionID)
  console.log('QUERY', socket.handshake.query)
  console.log('auth', socket.request.user)
    if (socket.request.user) {
      next();
    } else {
      const message = "Not Signed In, Stop WebSocket connection";
      const err = new AuthorizationError(message);
      next(err);
      // res.writeHead(403, { 'Content-Type': 'application/json' });
      // res.end(JSON.stringify({ error: message, message }));
      // return res.status(404).json(err) <--- doesnt work, socekt.io res is NOT express res
    }
}),

// Handle WebSocket handshake errors
io.engine.on("connection_error", (err) => {
  console.error("WebSocket handshake error:", err);
});

//
io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  const user = socket.request.user; // user id is our DB user id
  const passportSessionId = socket.request.sessionID; //  cookie in the browser shared among tabs
  const websocketId = socket.id // id for each websocket connection (new socket every tab)
  // Consider the situation:
  // I open 1 chrome browser with 2 tabs connecting to this server, and 1 firefox browser connecting also
  // This means I have: 3 websocket ids, 2 passport sessions (chrome tabs share the cookie), and 1 user
  // user.id = user logged in from any device
  // In this case, we want users in the same session to join the room,
  // this way logging out from ur browser does NOT log you out form your phone

  if (user) {
    console.log(`socket.id: ${websocketId} | request.sessionID: ${passportSessionId} | user.id: ${user.id}`);
    // console.log('SESSSSIOn', socket.request.session)
    // socket.join([passportSessionId, user.id]); // performance-wise, it is the same
    socket.join(passportSessionId)
    socket.join(user.id)
    socket.emit("join-room", passportSessionId) 
    socket.emit("join-room", user.id) 
    // TODO somehow detect passport session expiry and emit an event to all users ???
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

  // socket = singular connection from 1 client to server
  // socket.emit -> emits to that 1 socket/server
  // io.emit -> emits to all sockets
  // socket.broadcast.emit -> emits to all sockets except that 1 socket
});

instrument(io, {
  auth: false,
  mode: "development",
});

return io;

}
