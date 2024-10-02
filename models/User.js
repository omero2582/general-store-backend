import mongoose from "mongoose";

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
  timestamps: true
});

const User = mongoose.model('User', UserSchema);
export default User;