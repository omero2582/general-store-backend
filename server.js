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


import http from 'http';
import { setupSocketIO } from './socket.js';
import cookieParser from 'cookie-parser';


const app = express();
const server = http.createServer(app);

// Requires Dockerfile to do 'WORKDIR /app/backend' before CMD ["npm", "start"]
app.use(express.static(path.resolve('../frontend/dist')));


// app.use(cors())
app.use(express.json());
app.use(cookieParser());

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false,  // saves anonymous users (not signed in) to session store
  // with above true, when a non signed-in user opens 2 tabs, they have same session id
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

// set cookie 'clientId' if it doesnt exist
app.use((req, res, next) => {
  if (!req.cookies?.clientId) {
    const clientId = crypto.randomUUID();
    res.cookie('clientId', clientId, { 
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true, 
      sameSite: 'strict', 
    });
  }
  next();
})

// Middleware to override res.json() to always include req.user in every response
// Not using this anymore. We are instead now using websockets to udpate user info
// app.use(overwriteReqJsonIncludeUser);

// Websockets
const io = setupSocketIO(server, sessionMiddleware);
app.use((req, res, next) => {
  req.io = io;
  next();
});
// TODO, is adding req.io good memory-wise?? is the alternative exporting & importing the same or better?
// consider that here io is getting added to EVERY request, feels unneessary


app.use('/api', indexRouter);

// Serve Front End for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.resolve('../frontend/dist/index.html'));
});


// Error Handler (catch-all)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
// app.listen(PORT, () => { // when usig web sobkets, I use above which combines the app.liten and websocket listen
  console.log(`Server running on port ${PORT}`);
});
