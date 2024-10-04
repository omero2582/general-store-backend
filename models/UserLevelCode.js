import mongoose from "mongoose";

const Schema = mongoose.Schema;

// TODO - codes to obtain certain user levels, wont implement until
// very end probably, because at the moment we instead have a route to
// let users toggle between user levels of: user or admin
const UserLevelSchema = new Schema({
  code: { type: String, required: true, maxLength: 40 },
  createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  grantsUserLevel: { type: String, enum: ['owner', 'admin', 'user'], default: 'user' },
  expiresAt: Date
}, {
  timestamps: true
});

const UserLevel = mongoose.model('UserLevel', UserLevelSchema);
export default UserLevel;