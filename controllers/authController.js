import User from '../models/User.js';
import { signJWT } from '../utils/utils.js';
import bcrypt from 'bcryptjs'
import { getAllMembershipsCached } from '../config/database.js';
import asyncHandler from 'express-async-handler';
import { CustomError, DuplicateMongoError, AuthenticationError } from '../errors/errors.js';

export const login = asyncHandler(async (req, res, next) => {
  const {username, password} = req.validatedData;
  
  const user = await User.findOne({ username }).populate('membership');
  if (!user) {
    throw new AuthenticationError('User not found');
  };

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new AuthenticationError("Incorrect password");
  }

  // issue JWT
  const token_jwt = await signJWT(user);
  return res.json({ user, token_jwt })
})

export const signup = asyncHandler(async (req, res, next) => {
  // const {firstName, lastName, username, password} = req.body;
  const {firstName, lastName, username, password, email} = req.validatedData;
  //same as above but extra layer ensures ONLY data the passed vlidation sanitation is here

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 10);
  } catch (error) {
    throw new CustomError("Error hashing password")
  }
    
  // otherwise, store user with hashedPassword in DB
  let user;
  try {
    const newUser = new User({
      firstName,
      lastName,
      username,
      password: hashedPassword,
      email,
      membership: getAllMembershipsCached().find(m => m.tier === 0),
    });
    user = await newUser.save();
  } catch(err) {
    if (err.code === 11000){
      // code 11000 = duplicate
      throw new DuplicateMongoError(err);
    }
    throw new CustomError("Error Creating User", {...err});
  };

    const token_jwt = await signJWT(user);
    res.json({ user, token_jwt })
  }
)