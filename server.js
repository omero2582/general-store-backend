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

const app = express();

// // static files
// // need __dirname manually, since it is only available in CommonJS, and we changed to ES6 modules
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// app.use(express.static(baseUrlFrontend  || path.join(__dirname, '../frontend/build')));
// app.use(cors())
app.use(express.json());

app.use(session({
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
}));  //research saveUninitailized and resave, think i need to set them to false if setting expiry maxAge

app.use(passport.session());

//

// Middleware to override res.json() to always include req.user
app.use((req, res, next) => {
  const originalJson = res.json;  // Store the original res.json method
  
  res.json = function (body) {    // Override the res.json method
    if (req.isAuthenticated()) {
      body.user = req.user;       // Attach req.user to the response body
      body.auth = true;
    }
    originalJson.call(this, body); // Call the original res.json with the modified body
  };
  
  next();
});

app.get('/api/',
  asyncHandler(async (req, res) => {
    res.json({message: 'success'})
  })
);

// other routers, then
app.use('/api', indexRouter);

app.use('/api/auth', authRouter);

// Error Handler (catch-all)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const hostname = '0.0.0.0';
// app.listen(port, hostname, () => {
//   console.log(`Server running at http://${hostname}:${port}/`);
// });
