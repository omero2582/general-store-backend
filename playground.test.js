import { z } from "zod";

const req = {
  body : {
    name: "nameTest",
    // imageId: "myId",
    // description: undefined,
    price: 1,
    pizza: "hut", // if we want to include this, we can do productSchema.passthrough().safeParse(),
  }
}


const productSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(1, "Name is required"),
  imageId: z.string({ required_error: "imageID is required" }).min(1, "imageID is required"),
  description: z.string().optional(),
  price: z.number().int().optional(),
});


const middleware = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  let zodErrors = {};
  if(!result.success){
    result.error.issues.forEach((issue) => {
      zodErrors = {...zodErrors, [issue.path[0]]: issue.message}
    })
    return {errors: zodErrors};
  }
  return {success: true}
}

// const out = middleware(productSchema.omit({imageId: true}))(req);
// console.log(out);

