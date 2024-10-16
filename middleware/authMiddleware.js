
import asyncHandler from 'express-async-handler';
import { AuthenticationError } from '../errors/errors.js';

export const authMandatory = (req, res, next) => {
  if(!req.isAuthenticated()){
    throw new AuthenticationError('You must be logged in to access this resource.')
  }
  return next();
}

export const overwriteReqJsonIncludeUser = (req, res, next) => {
  const originalJson = res.json;  // Store the original res.json method
  

  res.json = function (body) {    // Override the res.json method
    if (req.isAuthenticated()) {
      // add cookie info
      // console.log(req.session.cookie);
      const {expires, maxAge, originalMaxAge} = req.session?.cookie;
      //

      body.user = {...req.user.toObject(), cookie: {expires, maxAge, originalMaxAge}};       // Attach req.user to the response body
      body.auth = true;
    }
    originalJson.call(this, body); // Call the original res.json with the modified body
  };
  
  next();
}