import express from 'express';
import * as dotenv from 'dotenv'
import cors from 'cors'
dotenv.config();

import indexRouter from './routes/index.js'

// import './config/passport.js'
// import './config/database.js'
import { errorHandler } from './middleware/errorMiddleware.js';

const app = express();

// // static files
// // need __dirname manually, since it is only available in CommonJS, and we changed to ES6 modules
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// app.use(express.static(baseUrlFrontend  || path.join(__dirname, '../frontend/build')));
// app.use(cors())
app.use(express.json());

// other routers, then
app.use('/api', indexRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const hostname = '0.0.0.0';

// app.listen(port, hostname, () => {
//   console.log(`Server running at http://${hostname}:${port}/`);
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});