export const authMandatory = asyncHandler((req, res, next) => {
  if(!req.isAuthenticated()){
    throw AuthenticationError('You must be logged in to access this resource.')
  }
  return next();
});