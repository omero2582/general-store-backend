// TODO TODO change our 'type' to just 'name'
// A lot of apis return name it seems. Change this is our message board too
export class CustomError extends Error {
  constructor(message, {statusCode = 500, type = "InternalServerError", ...object} = {}){
    super(message);
    Object.assign(this, object);
    this.statusCode = statusCode;
    this.type = type;
    // this.name = name;
    // this.isOperational = true; Not sure if should add this,
    // basically marks it as a 'known caught error'
    // to differentiate it from an unknown thrown error that
    // is caught in the middleware catch-all error handler
    // https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/operationalvsprogrammererror.md
  }
}

//
export class CloudinaryError extends CustomError {
  constructor(cloudinaryErr){
    const {message, name, http_code, ...rest} = cloudinaryErr;
    //  {
    //   "message": "Resource not found - GVGBQTBXIAAS3ax_dkcdap",
    //   "name": "Error",
    //   "http_code": 404
    // }
    super(message, {
      // name,
      ...rest,
      type: name,
      statusCode: http_code || 500,
    });
  }
}
//

export class AuthenticationError extends CustomError {
  constructor(message, object = {}) {
    super(message, {
      ...object,
      statusCode: 401,
      type: "AuthenticationError",
    });
  }
}

export class AuthorizationError extends CustomError {
  constructor(message, object = {}) {
    super(message, {
      ...object,
      statusCode: 403,
      type: "AuthorizationError",
    });
  }
}

export class ValidationError extends CustomError {
  constructor(message, object = {}) {
    super(message, {
      ...object,
      statusCode: 400,
      type: "ValidationError",
    });
  }
}

export class DuplicateMongoError extends CustomError {
  constructor(mongoErr){
    const { keyValue, errorResponse } = mongoErr;
    const [field, value] = Object.entries(keyValue)[0];
    // const msg = `${field} already exists with value ${value}`;
    const msg = `That ${field} is already taken. Try another.`;

    super(msg, {
      // ...errorResponse, 
      errors: {
        [field]: {
          value,
          msg,
        },
      },
      type: "DuplicateError",
      statusCode: 400
      // name: mongoErr.name,
    });
      // This err has an err.errorResponse object, which contains all the exact same other key values as the err object
      // The only thing is that 'message' is renamed to 'errmsg', which I prefer when I forward this error
      // TODO, I'm assuming when code 11000 that this object returns all these properties, I think this is ok
  }
}

export class NotFoundError extends CustomError {
  constructor(message, object = {}) {
    super(message, {
      ...object,
      statusCode: 404,
      type: "NotFoundError"
    });
  }
}

export class TransactionError extends CustomError {
  constructor(message, object = {}) {
    super(message, {
      ...object,
      statusCode: 500,
      type: "TransactionError"
    });
  }
}