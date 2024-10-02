
import asyncHandler from 'express-async-handler';
import { AuthenticationError } from '../errors/errors.js';

export const authMandatory = (req, res, next) => {
  if(!req.isAuthenticated()){
    throw AuthenticationError('You must be logged in to access this resource.')
  }
  return next();
}

export const overwriteReqJsonIncludeUser = (req, res, next) => {
  const originalJson = res.json;  // Store the original res.json method
  
  res.json = function (body) {    // Override the res.json method
    if (req.isAuthenticated()) {
      body.user = req.user;       // Attach req.user to the response body
      body.auth = true;
    }
    originalJson.call(this, body); // Call the original res.json with the modified body
  };
  
  next();
}