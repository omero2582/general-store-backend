import mongoose from 'mongoose';
import * as dotenv from 'dotenv'
dotenv.config();

async function dbStart(){
  try {
    await mongoose.connect(process.env.DB_URL);
    mongoose.connection.on('error', () => {
      console.log('Mongoose error event')
    })
    console.log('Connected to Database')
  } catch (error) {
    console.log('Mongoose error on intial connection')
  }
}

async function initialize(){
  await dbStart();
} 


await initialize();