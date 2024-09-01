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
  return next();
}