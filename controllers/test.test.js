import '../config/cloudinary.js'
import '../config/database.js'
import {v2 as cloudinary} from 'cloudinary'
import Product from '../models/Product.js';

//https://cloudinary.com/documentation/admin_api#delete_resources
const deleteImagesArr = async () => {
  // arr can be up to 100
  const out = await cloudinary.api.delete_resources(['abc','xhgzrv39t9j4qrfposay']);
  // {
  //   deleted: { abcs: 'not_found', xhgzrv39t9j4qrfposay: 'deleted' },
  //   deleted_counts: { abcs: { original: 0, derived: 0 } },
  //   partial: false,
  //   rate_limit_allowed: 500,
  //   rate_limit_reset_at: 2024-09-22T17:00:00.000Z,        
  //   rate_limit_remaining: 499
  // }
  const hasDeletedAtLeastOne =  Object.values(out.deleted).some(value => value === 'deleted');
  if(hasDeletedAtLeastOne){
    console.log('DELETED AT LEAST ONE')
  }else{
    console.log('NOTHING WAS DELETED')
  }
  return out;
}

// Maybe use below for when deleting all images of all products
// Think would only make sense if our app had different 'stores' within the general store
// Then all images of products from a store when uploaded, woudl receive a tag with their storeName
// However, if our app doesn't have this idea of 'stores within a store', then it makes
// no sense to delete by tags, and we would instead just call:
// cloudinary.api.delete_resources(true) , which deletes all images
const deleteImagesByTag = async () => {
  const out = await cloudinary.api.delete_resources_by_tag('myTag')
  let deleted = [];
  let notDeleted = [];
  for (const obj of Object.entries(out.deleted)) {
    const [publicId, deletedStatusString] = obj;
    if(deletedStatusString === 'deleted'){
      deleted.push(obj);
    }else{
      notDeleted.push(obj)
    }
  }

  if(deleted.length > 0){
    console.log('deleted at least one')
  }else{
    console.log('did not delete at least one')
  }
  return out;
}

// const out = await deleteImagesArr();
// console.log(out)


const _convertDBImageToImages = async () => {
  const products = await Product.find();
  for(const p of products) {
    if(p.image !== undefined){
      p.images = [p.image];
      p.image = undefined;
      await p.save();
    }
  };
  console.log('DONE')
}

const newPromise = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(1), 1000);
  });
}

const newPromiseReject = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject({key: "errr"}), 1000);
  });
}

const sandbox = async () => {
  console.time('promises');
  const arr =  new Array(10).fill(newPromise()); 
  const allPromise = await Promise.all(arr); 
  console.timeEnd('promises')
  console.log(allPromise); 
}

const sandboxSuccessReject = async () => {
  const arr = [newPromise(), newPromiseReject(), newPromiseReject(), newPromise()];
  const allResponses = await Promise.allSettled(arr);

  // Separate successful and failed responses
  let allResponsesSuccess = [], allResponsesFail = [];
  allResponses.forEach(response => {
    if(response.status === 'fulfilled'){
      allResponsesSuccess.push(response.value);
    }else{
      allResponsesFail.push(response.reason)
    }
  })

   console.log('success', allResponsesSuccess)
   console.log('fail', allResponsesFail)
}

const out = await Promise.allSettled([].map(() => 'r'));
console.log(out);