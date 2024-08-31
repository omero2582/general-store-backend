import {v2 as cloudinary} from 'cloudinary'
import * as dotenv from 'dotenv'
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

console.log('config loaded: cloudinary',{
  name: cloudinary.config().cloud_name,
  key: cloudinary.config().api_key,
  secret: cloudinary.config().api_secret
});