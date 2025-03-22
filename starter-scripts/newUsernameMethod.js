import '../config/env.js'
import '../config/database.js';
import User from '../models/User.js'
import { nanoid } from 'nanoid';

async function newUsernameMethod() {
  const allUsers = await User.find();

  for (const user of allUsers) {
    // doing it drity multiple DB calls bc I just have 4 users (me :D)
    try {
      user.username = `${user.displayName.slice(0, 13)}-${nanoid(7)}`, 
      await user.save();
    } catch (err) {
      console.log('error mdoerinzing users', err);
    }
  };  
}

await newUsernameMethod();