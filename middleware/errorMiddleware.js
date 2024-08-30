export const errorHandler = (err, req, res, next) => {
  console.error('Catch-all error handler', err, '======================= err handler end');
  res.status(err.statusCode || 500)
    .json({
      ...err, // spreads manually-set properties only (error obj only spread these)
      message: err.message, // then specify error-native properties, so that they are also included
      // stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
}