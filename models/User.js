import mongoose from "mongoose";

// TODO
// in the future, find out what is the best way to prevent some fields to be
// returned unless specified. We can maybe use the same 'reshapingOptions'
// apprach we used in 'Product' model, but I am 99% sure there was another way maybe (?)
// that was also here in the model, then when you called the model you could chain something if you 
// wanted to include it
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: { type: String, unique: true, required: true, maxLength: 40 },
  username: { type: String, unique: true, required: true, maxLength: 40 },
  name: { type: String, required: true, maxLength: 40 },
  nameFull: { firstName: String, lastName: String },
  profilePicture: { String },
  userLevel: { type: String, enum: ['owner', 'admin', 'user'], default: 'user' },
  authProviders: {
    google: {
      _id: false,
      id: String,
      email: String,
      displayName: String,
      nameFull: { firstName: String, lastName: String },
      profilePicture: String,
    },
    // Future providers (e.g. Github, Facebook, Twitter) can go here
  },
}, {
  timestamps: true,
  methods : {
    isUserLevelMoreThanOrEqualTo(userLevelString) {
      const roleRanks = {
        owner: 3,
        admin: 2,
        user: 1
      };
  
      return roleRanks[this.userLevel] >= roleRanks[userLevelString];
    }
  },
});

const User = mongoose.model('User', UserSchema);
export default User;


// TODO NEW after TODO above, I found the code to exclude by default,
// it is as shown below:
/**
 * 
 * you can exclude the field from the schema definition by adding the attribute

    excludedField : {
...
    select: false,
...
    }
whenever you want to add it to your result, add this to your find()

find().select('+excludedFiled')
 * 
 * 
 */