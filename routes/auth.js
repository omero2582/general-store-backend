import express from 'express';
import asyncHandler from 'express-async-handler';
import passport from 'passport';
import { overwriteReqJsonIncludeUser } from '../middleware/authMiddleware.js';
import cookie from 'cookie'
const router = express.Router();

// TODO add asyncHandler? nvm not sure if passport code is async / has diff async version

// NOTE - auth flow contains multiple redirects. req AND all cookies besides sid 
// are cleared after step 1, req.session is cleared after step 2.
// To make data accessible in the later steps in auth flow:
// 1. save req data into req.session in step 1
// 2. save req.session data into req in step 2
// 3. retrieve data from req
router.get('/google',
  // Step 1 - This redirects the user to the google sign-in page, by creating a large URL
  function (req, res, next) { 
    console.log('AUTHENTICATE', req.cookies.clientId, 'session: ',  req.sessionID);
    req.session.clientId = req.cookies.clientId
    // ^^^ we must asssign cookie to session like this, otherwise req fields dont persist to step 2
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',

    })(req, res, next)
  },
)

router.get('/google/redirect',
  // Step 2 - This actually authenticates the user and runs the code in the passport strategy 
  // express session clears all your req fields AND all your cookies besides sid
  // when you reach this code after step 1. This is simply bc the req here 
  // does NOT come from our original client req, but instead from google redirect
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
    io.in(req.clientId).socketsJoin(req.user.id)
    
    res.redirect(process.env.NODE_ENV === 'development' ? 'http://localhost:5173/' : '/');
  }
)

router.post('/logout', (req, res, next) => {
  console.log('log out', req.cookies)
  const oldSessionID = req.cookies.clientId // this was orginaly sessionID, now clientId
  const oldUser = req.user;
  // As soon as you call req.logout, passport changes the req.sessionID for security (to prevent some attack)
  req.logout(function(err) {
    if (err) { return next(err); }
    // Log out all other sockets in same client (same browser different tabs)
    const io = req.io;
    io.in(oldSessionID).emit('user', null)
    io.in(oldSessionID).socketsLeave(oldUser.id); // leave the user room
    res.json({message: 'logged out !'})
  });
})

router.get('/me', 
  overwriteReqJsonIncludeUser,  // includes user
  (req, res, next) => {
  res.json({test: 'hi'})
})

export default router;