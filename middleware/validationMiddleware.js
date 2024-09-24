import { z } from "zod";
import { CustomError, ValidationError } from "../errors/errors.js";

export const validateFieldsZod = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  let zodErrors = {};
  if(!result.success){
    result.error.issues.forEach((issue) => {
      zodErrors = {...zodErrors, [issue.path[0]]: issue.message}
    })
    throw new ValidationError('Validation Error', {errors: zodErrors});
  }
  // Attach the validated/transformed data back to req.
  // Useful because sometimes we run .transform() on ZodSchema, and if we dont attach this, then req.body wont have the transformed data
  // Also by attaching it, I know 100% that I am accessing validated data 
  
  // req.body = {...req.body, ...result.data};
  // req.body = result.data;
  req.validatedData = {...result.data};
  // 3 methods above. 1- combine req.body and validated, 2- replace req.body, 3- create req.validatedData
  // I like methd 3 better because it gives me flexibility to choose whether I only want to access validated data
  // The only downside to option 3 that we use, is that the team needs to be aware to access req.validatedData

  return next();
}