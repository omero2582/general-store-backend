import passport from "passport";
import { Strategy } from "passport-google-oauth20";
import User from "../models/User.js";


const opts = {
  clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/api/auth/google/redirect",
};
passport.use(
	new Strategy(opts, async (accessToken, refreshToken, profile, done) => {
    console.log('PROFIELEEE', profile)
    let user;
    try {
      user = await User.findOne({ 'authProviders.google.id': profile.id });
    } catch (err) {
      return done(err, null);
    }
    try {
      if (!user) {
        const newUser = new User({
          name: profile.displayName,
          username: profile.emails[0].value,
          email: profile.emails[0].value,
          authProviders: {
            google: {
              id: profile.id,
              email: profile.emails[0].value,
              profilePicture: profile.photos[0].value,
            }
          }
        });
        const newSavedUser = await newUser.save();
        return done(null, newSavedUser);
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  })
);

passport.serializeUser((user, done) => {
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