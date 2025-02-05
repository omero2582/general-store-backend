import passport from "passport";
import { Strategy } from "passport-google-oauth20";
import User from "../models/User.js";
import Cart from "../models/Cart.js";
import mongoose from "mongoose";


const opts = {
  clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  callbackURL: process.env.NODE_ENV === 'development' ? 'http://localhost:3000/api/auth/google/redirect' : '/api/auth/google/redirect',
};
passport.use(
	new Strategy(opts, async (accessToken, refreshToken, profile, done) => {
    // Step 3 - Google Sign-In Success, now use the google user information
    // to findOrCreate a new user for our DB
    // console.log('PROFIELEEE', profile)
    console.log('PROFILE')
    let user;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        user = await User.findOne({ 'authProviders.google.id': profile.id });
        
        const id = profile.id;
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const firstName = profile.name.givenName;
        const lastName = profile.name.familyName;
        const profilePicture = profile.photos[0].value;

        if (!user) {
          const newUser = new User({
            email,
            username: email,
            displayName: firstName,
            nameFull: {
              firstName,
              lastName,
            },
            profilePicture,
            authProviders: {
              google: {
                id,
                email,
                displayName: name,
                nameFull: {
                  firstName,
                  lastName,
                },
                profilePicture,
              }
            }
          });
          user = await newUser.save({session: session});

          const cart = new Cart({user: user});
          await cart.save({session: session});
        }
        return done(null, user);
      });
    } catch (err) {
      return done(err, null);
      // const {message, errors, stack} = error;
      // if(error instanceof CustomError){
      //   throw error;
      // }
      // throw new TransactionError(message);
    } finally {
      session.endSession();
    }
  })
);

passport.serializeUser((user, done) => {
  // step 4 - user our DB's id to store the session
  console.log('SERLIAZIE');
	done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  console.log('DEESERLIAZIE');
	try {
		const user = await User.findById(id);
    if (user) {
      return done(null, user);
    } else {
      return done(null, null);
    }
	} catch (err) {
		done(err, null);
	}
});