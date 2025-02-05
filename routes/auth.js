import express from 'express';
import asyncHandler from 'express-async-handler';
import passport from 'passport';
import { overwriteReqJsonIncludeUser } from '../middleware/authMiddleware.js';
import cookie from 'cookie'
const router = express.Router();

// TODO add asyncHandler? nvm not sure if passport code is async / has diff async version

router.get('/google',
  // Step 1 - This redirects the user to the google sign-in page, by creating a large URL
  function (req, res, next) { 
    console.log('AUTHENTICATE', req.cookies.clientId, 'session: ',  req.sessionID);
    req.session.clientId = req.cookies.clientId
    // ^^^ we must asssign to session like this, otherwise req doesnt persist to step 2
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',

    })(req, res, next)
  },
)

router.get('/google/redirect',
  // Step 2 - This actually authenticates the user and runs the code in the passport strategy 
  // express session clears all your cookies besides sid AND your req fields,
  // when you reach this code after step 1
  function (req, res, next) {
    console.log('REDIRECT', req.cookies, 'clientId: ', req.session.clientId);
    req.clientId = req.session.clientId;

    passport.authenticate('google', { 
      failureRedirect: process.env.NODE_ENV === 'development' ? 'http://localhost:5173/' : '/',
    })(req, res, next)
  },

  function(req, res) {
    // Step 5 - Successfully created session, redirect home
    const io = req.io;
    console.log('SUCCESS', req.cookies, 'clientId: ', req.session.clientId);
    res.cookie('clientId', req.clientId, { 
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true, 
      sameSite: 'strict', 
    });
    io.in(req.clientId).emit('user', req.user)
    // io.in(req.clientId).socketsJoin(req.sessionID)
    io.in(req.clientId).socketsJoin(req.user.id)
    // io.socketsLeave(req.clientId)
    
    res.redirect(process.env.NODE_ENV === 'development' ? 'http://localhost:5173/' : '/');
  }
)

router.post('/logout', (req, res, next) => {
  // const oldSessionID = req.sessionID
  console.log('log out', req.cookies)
  const oldSessionID = req.cookies.clientId
  const oldUser = req.user;
  // As soon as you call req.logout, passport changes the req.sessionID for security (to prevent some attack)
  req.logout(function(err) {
    if (err) { return next(err); }
    // Log out all other passport session sockets (same browser different tabs)
    const io = req.io;
    io.in(oldSessionID).emit('user', null)
    // io.in(oldSessionID).socketsJoin(req.sessionID);  // join new sessionID room
    io.in(oldSessionID).socketsLeave(oldUser.id); // leave the user room
    // io.socketsLeave(oldSessionID); // leave previous sessionID room
    res.json({message: 'logged out !'})
  });
})

router.get('/me', 
  overwriteReqJsonIncludeUser,
  (req, res, next) => {
  res.json({test: 'hi'})  // already includes user due to our middleware
})

export default router;