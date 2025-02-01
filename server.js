import './config/env.js';

import express from 'express';
import cors from 'cors'

import session from 'express-session';
import passport from 'passport';
import MongoStore from 'connect-mongo';

import MongoClient from './config/database.js';
import './config/google-auth.js';

import indexRouter from './routes/index.js'

import { errorHandler } from './middleware/errorMiddleware.js';
import { overwriteReqJsonIncludeUser } from './middleware/authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';


import http from 'http';
import { setupSocketIO } from './socket.js';


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
// Websockets
const io = setupSocketIO(server, sessionMiddleware);
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware to override res.json() to always include req.user
app.use(overwriteReqJsonIncludeUser);

app.use('/api', indexRouter);

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '/../frontend/dist/index.html'));
});


// Error Handler (catch-all)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
// app.listen(PORT, () => { // when usig web sobkets, I use above which combines the app.liten and websocket listen
  console.log(`Server running on port ${PORT}`);
});
