import User from "../models/User.js";
import asyncHandler from 'express-async-handler'

export const changeUserLevel = asyncHandler(async (req, res) => {
  req.user.userLevel = req.validatedData.userLevel;
  const user = await req.user.save();
  res.json({message: 'success', user })
});

// TODO, prob just move the mandatoryAuth to be inside each controller function,
// not sure, but here it looks tarnge that we just assume the req.user exists,
// though it will 100% exists since we will call mandatoryAuth before this,
// but I dont like that we are dependent on that