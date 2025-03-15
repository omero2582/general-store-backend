import mongoose from "mongoose";
import { AuthorizationError, CustomError, NotFoundError, TransactionError } from "../errors/errors.js";
import Category from "../models/Category.js";
import asyncHandler from 'express-async-handler';
import Product from "../models/Product.js";

// Categories
// TODO just added userLevel checks on edit and delete to make sure owner categories
// cannot be dleeted by admin. test.
export const getCategoriesPublic = asyncHandler(async (req, res) => {
  const categories = await Category.find().populate('createdBy');
  return res.json({categories})
});

export const getCategories = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const categories = await Category.find().populate('createdBy');
  return res.json({categories})
});

export const addCategory = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const { name } = req.body;
  const categoryFound = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
  if(categoryFound){
    throw new CustomError(`Category '${categoryFound.name}' Already Exists`)
  }

  const newCategory = new Category({name, createdBy: req.user})
  const category = await newCategory.save();
  return res.json({category})
});

// Deletes Category + Removes Category from all Products that contain this category
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  // const { name } = req.body;
  // const category = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {

      const category = await Category.findById(id).populate('createdBy');
      if(!category){
        throw new NotFoundError(`Category Not Found`)
      }

      const userLevel = req.user.userLevel
      const creatorLevel = category.createdBy.userLevel;
      if(!req.user.isUserLevelMoreThanOrEqualTo(creatorLevel)){
        throw new AuthorizationError(`You do not have a higher user level than the product creator. ${userLevel} tried to delete product by ${creatorLevel}`);
      }

      const categoryDeleted = await category.deleteOne().session(session);

      await Product.updateMany(
        { categories: id },
        { $pull: { categories: id } }
      ).session(session);
      
      return res.json({category: categoryDeleted})
    });
  } catch (error) {
    const {message, errors, stack} = error;
    if(error instanceof CustomError){
      throw error;
    }
    throw new TransactionError(message);
  } finally {
    session.endSession();
  }
  
});

export const editCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  
  const categoryWithTargetName = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
  if(categoryWithTargetName){
    throw new CustomError(`Category '${categoryWithTargetName.name}' Already Exists`)
  }

  const category = await Category.findById(id).populate('createdBy');
  if(!category){
    throw new NotFoundError(`Category Not Found`)
  }

  const userLevel = req.user.userLevel
  const creatorLevel = category.createdBy.userLevel;
  if(!req.user.isUserLevelMoreThanOrEqualTo(creatorLevel)){
    throw new AuthorizationError(`You do not have a higher user level than the product creator. ${userLevel} tried to delete product by ${creatorLevel}`);
  }

  category.name = name;
  const newCategory = await category.save();
  return res.json({category: newCategory})
});