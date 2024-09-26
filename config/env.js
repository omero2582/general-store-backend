import * as dotenv from 'dotenv'
// const envFileName = `.env.${process.env.NODE_ENV || "development"}`
// let envFileName = '.env.development'
let envFileName = '.env'
if (process.env.NODE_ENV === 'production'){
  envFileName = '.env.production'
}
dotenv.config({ path: envFileName });
console.log('NODE_ENV set to:', process.env.NODE_ENV);
// console.log('NODE_ENV set to:', app.get('env'));

// If I instead put this at the top of other files with other imports,
// then babel will transpile this to hoist all the import statements
// BEFORE running 'dotenv.config()'. This will be ERROR bc env vars would be
// undefined in those imports that get ran before 'dotenv.config()'

// so the following:
// import * as dotenv from 'dotenv'
// dotenv.config({ path: envFileName });
// import './configThatUsesEnvVariables

// would become:
// import * as dotenv from 'dotenv'
// import './configThatUsesEnvVariables <- ERROR HERE, env variables undefined
// dotenv.config({ path: envFileName });