import mongoose from "mongoose";

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: { type: String, required: true, maxLength: 40 },
  username: { type: String, unique: true, required: true, maxLength: 40 },
  email: { type: String, unique: true, required: true, maxLength: 40 },
  userLevel: { type: String, enum: ['owner', 'admin', 'user'], default: 'user' },
  authProviders: {
    google: {
      _id: false,
      id: String,
      email: String,
      profilePicture: String,
    },
    // Future providers (e.g. Github, Facebook, Twitter) can go here
  },
}, {
  timestamps: true
});

const User = mongoose.model('User', UserSchema);
export default User;