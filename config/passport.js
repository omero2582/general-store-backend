import passport from "passport";
import User from '../models/User.js';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as dotenv from 'dotenv'
import mongoose from "mongoose";
import { CustomError, ValidationError } from "../errors/errors.js";
dotenv.config();

// I think I should maybe combine middleware/authMiddleware.js and this file, because they are targetting
// the same purposes, and doesnt make sense to keep them separated

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_PUBLIC,
  algoriths: ['RS256']
};

passport.use(
  new Strategy(opts, async (payload, done) => {
    // this callback only runs if the JWT is verified as valid and untampered with and not expired
    // there is no code for that, it just happens with (new Strategy) and passport behind the scenes

    // try/catch because findById can throw unexpected errors
    try {
      // Validating/Sanitizing payload
      // TODO since this callback only runs if the JWT is verified (issued by us), Im not sure about this check here....
      if(!mongoose.isValidObjectId(payload.sub)){
        throw new ValidationError('Invalid User ID on JSON Web Token payload');
      }

      // Proceed
      // 'done()' here continues onto the execution of the callback passed onto passport.authenticate("jwt"),
      // which is the caller of this function. authMiddleware.js has some callers
      const user = await User.findById(payload.sub).populate('membership')
      if (user) {
        return done(null, user);
      } else {
        return done(null, false)
      }
    } catch (error) {
      return done(error, false);
    }
  })
);