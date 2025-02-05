import mongoose from "mongoose";

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  // adding field.select: false, prevents the field from being included when retrieveing the doc, unless sepcified
  // ip: { type: String, required: false, select: false },
  email: { type: String, unique: true, required: true, maxLength: 40 },
  username: { type: String, unique: true, required: true, maxLength: 40 },
  displayName: { type: String, required: true, maxLength: 40 },
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
// it is as shown below. We should 99% add this at some point, because
// we return users in many different locations, sometimes public for example
// if there are public profile pages or publibly on a product.createdBy.
// So we should have some fields that are excluded by default unless the
// controller specifies to include them. Below is the code:
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