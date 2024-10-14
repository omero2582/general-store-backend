import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import { NotFoundError } from '../errors/errors.js';

export const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({user: req.user}).populate('items.product');
  if(!cart){
    // This should never be reached, since it takes teh user id from the session,
    // AND carts are created in a transaction along with the user, when users are created
    throw new NotFoundError('Cart not found');
  }

  // Remove from the cart, products that have been deleted
  cart.items = cart.items.filter(item => item.product !== null);
  if (cart.isModified()) {
    await cart.save();
  }
  //
  return res.json({ cart });
})

// TODO add a .stock field to products, and then use withTransaction() here
// to make sure product has enough stock to add X quantity to your cart.
// If there is not enough stock, then add the max stock
export const addCartProduct = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const product = await Product.findOne({_id: productId, visibility: 'public'}).populate('createdBy');
  if(!product){
    throw new NotFoundError('Product not found');
  }
  
  const cart = await Cart.findOne({user: req.user}).populate('items.product');
  const productInCart = cart.items.find(item => product.equals(item.product));
  if(productInCart){
    productInCart.quantity += quantity;
    // If product already exists in my cart, then add X quantity to it.
    // TODO, Also in /Edit and delete, maybe throw errors if item is not in cart?
    // right now they just silently retunr the same cart... not sure
  }else{
    cart.items.push({product, quantity})
  }
  
  const newCart = await cart.save()
  return res.json({cart: newCart});
})


export const editCartProduct = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({user: req.user}).populate('items.product');

  const { productId, quantity } = req.body;
  const product = await Product.findOne({_id: productId, visibility: 'public'}).populate('createdBy');
  if(!product){
    throw new NotFoundError('Product not found');
  }

  const productInCart = cart.items.find(item => product.equals(item.product));
  if(!productInCart){
    throw new NotFoundError('Product not found in your Cart');
  }

  productInCart.quantity = quantity;

  const newCart = await cart.save()
  return res.json({cart: newCart});
})


export const deleteCartProduct = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({user: req.user}).populate('items.product');

  const { id } = req.params;
  const product = await Product.findOne({_id: id, visibility: 'public'}).populate('createdBy');
  if(!product){
    throw new NotFoundError('Product not found');
  }

  const productInCart = cart.items.find(item => product.equals(item.product));
  if(!productInCart){
    throw new NotFoundError('Product not found in your Cart');
  }

  cart.items = cart.items.filter(i => !product.equals(i.product));
  const newCart = await cart.save()
  return res.json({cart: newCart});

})