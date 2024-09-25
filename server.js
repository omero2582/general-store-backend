import express from 'express';
import * as dotenv from 'dotenv'
import cors from 'cors'
dotenv.config();

import indexRouter from './routes/index.js'

import session from 'express-session';
import passport from 'passport';
import './config/google-auth.js';
import MongoClient from './config/database.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import MongoStore from 'connect-mongo';

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
app.use(passport.initialize());
app.use(passport.session());

// other routers, then
app.use('/api', indexRouter);

//
app.get('/api/auth/google',
  (req, res, next) => { console.log('AUTHENTICATE'); return next()},
  passport.authenticate('google', {scope: ['profile', 'email']})
  // this redirect the user to a large URL that is the google sign-in page
)

app.get('/api/auth/google/redirect',
  (req, res, next) => { console.log('REDIRECT'); return next()},
  // this actually athenticates the use and runs the code in the passport strategy
  passport.authenticate('google', { 
    failureRedirect: '/login',
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    console.log('SUCCESS')
    res.redirect('/');
  }
)
//

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const hostname = '0.0.0.0';

// app.listen(port, hostname, () => {
//   console.log(`Server running at http://${hostname}:${port}/`);
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});