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
      // Adds session fields to response
      // Since the session cookie needs to be http only to prevent hijacking sessions
      const {expires, maxAge, originalMaxAge} = req.session?.cookie;

      // Attaches req.user to the response body
      body.user = {
        ...req.user.toObject(), 
        session: {expires, maxAge, originalMaxAge}
      };       
      body.auth = true;
    }
    originalJson.call(this, body); // Call the original res.json with the modified body
  };
  
  next();
}