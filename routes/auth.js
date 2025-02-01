import express from 'express';
import asyncHandler from 'express-async-handler';
import passport from 'passport';
const router = express.Router();

// TODO add asyncHandler

router.get('/google',
  (req, res, next) => { console.log('AUTHENTICATE'); return next()},
  // Step 1 - This redirects the user to the google sign-in page, by creating a large URL
  passport.authenticate('google', {scope: ['profile', 'email'], prompt: 'select_account'})
)

router.get('/google/redirect',
  (req, res, next) => { console.log('REDIRECT'); return next()},
  // Step 2 - This actually authenticates the user and runs the code in the passport strategy 
  passport.authenticate('google', { 
    // failureRedirect: '/api',
    failureRedirect: process.env.NODE_ENV === 'development' ? 'http://localhost:5173/' : '/',
  }),
  function(req, res) {
    // Step 5 - Successfully created session, redirect home
    console.log('SUCCESS')
    // res.redirect('/api');
    if (process.env.NODE_ENV === 'development') {
      res.redirect('http://localhost:5173/');
      // res.redirect('/api');
    } else {
      res.redirect('/'); // In production, serve from built files
    }
  }
)

router.post('/logout', (req, res, next) => {
  const sessionID = req.sessionID // NECESSARY to capture req.sessionID BEFORE req.logout,
  // As soon as you call req.logout, passport changes the req.sessionID for security (to prevent some attack)
  req.logout(function(err) {
    if (err) { return next(err); }
    const io = req.io;
    // TODO add an emit here to notify all sockets in this room of the logout
    io.in(sessionID).emit('user', null) // req.user is null here
    io.socketsLeave(sessionID);
    res.json({message: 'logged out !'})
  });
})

router.get('/me', (req, res, next) => {
  res.json({test: 'hi'})  // already includes user due to our middleware
})

export default router;