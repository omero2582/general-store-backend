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
import cookieParser from 'cookie-parser';


const app = express();
const server = http.createServer(app);


// // static files
// // need __dirname manually, since it is only available in CommonJS, and we changed to ES6 modules



// import { fileURLToPath } from 'url';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// app.use(express.static(path.join(__dirname, '../frontend/dist')));


app.use(express.static(path.resolve('../frontend/dist')));

// TODO deplying test above (shouldnt) & then update dockerfile to add an extra
// WORKDIR /app/backend before
// CMD ["npm", "start"]





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
//
// set cookie if no user
app.use((req, res, next) => {
  if (!req.session.user && !req.cookies?.clientId) {
    const clientId = crypto.randomUUID();
    res.cookie('clientId', clientId, { 
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true, 
      sameSite: 'strict', 
    });
  }
  next();
})

// Websockets
const io = setupSocketIO(server, sessionMiddleware);
app.use((req, res, next) => {
  req.io = io;
  next();
});
// TODO, is adding req.io good memory-wise?? is the alternative exporting & importing the same or better?
// consider that here io is getting added to EVERY request, feels unneessary



// Middleware to override res.json() to always include req.user
// app.use(overwriteReqJsonIncludeUser);

app.use('/api', indexRouter);

// Serve the React app for all other routes
app.get('*', (req, res) => {
  // res.sendFile(path.join(__dirname, '/../frontend/dist/index.html'));
  res.sendFile(path.resolve('/../frontend/dist/index.html'));
});


// Error Handler (catch-all)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
// app.listen(PORT, () => { // when usig web sobkets, I use above which combines the app.liten and websocket listen
  console.log(`Server running on port ${PORT}`);
});
