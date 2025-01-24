import '../config/cloudinary.js'
import {v2 as cloudinary} from 'cloudinary'
import { CustomError } from '../errors/errors.js';

//https://cloudinary.com/documentation/update_assets
//https://cloudinary.com/documentation/image_upload_api_reference#explicit
// TODO test if this errors out if the parent function catches this correectly with async handler
// This function accomplished 2 things: 1 it marks them as uploaded, 2 it confirms that the
// image is actually in our cloudinary storage by returning its info if found
export const markAsUploaded = async (images) => {
  // const out = await cloudinary.uploader.remove_tag('unlinked', [publicId]);
  // above just returns an array  like: "public_ids": ["omero_vs_yassuo_old_icon_NAMES_CLOSER_1_vpntlt"]
  // if(out.public_ids.length === 0){
  //   throw new Error('image not found')
  // }
  // I prefer context instead of tags, like below, because maybe in the future maybe I want to
  // allow tags input, and then it would be problematic to keep them here
  // I would be forced to use uploader.remove_tag, then api.resource (2 calls),
  // Or i would have to trust the client to send in the approporate tags
    
  let responsesAllSettled = await Promise.allSettled(
    images.map(async (image) => {
      try {
        let cloudinaryResponse = await cloudinary.uploader.explicit(image.publicId, {
          type:'upload',
          context: 'linked=true'  
          // this deletes all other context besides this, right now we dont have any
        })
        return {...image, cloudinaryResponse}
        // we need the inner async awaits inside the .map above, because we need the result in the object we return
      } catch (error) {
        throw {...image, cloudinaryResponse: error}
      }
    })
  );

  // Separate successful and failed responses
  let responsesSuccessful = [];
  let responsesFailed = [];
  responsesAllSettled.forEach((promise) => {
    if(promise.status === 'fulfilled'){
      responsesSuccessful.push(promise.value);
    }else{
      responsesFailed.push(promise.reason)
    }
  });

  // If some failed to add tag on explicit(), then take all the successful ones, and revert them to 'linked=false
  // Since above we set 'linked=true', then we know that the assets DO exist, so if below throws error, its a network problem
  if(responsesFailed.length > 0){
    await Promise.allSettled( // if these result in errors, then network problem
      responsesSuccessful.map(({cloudinaryResponse}) => {
        return cloudinary.uploader.explicit(cloudinaryResponse.public_id, {
          type:'upload',
          context: 'linked=false'  
        })
      })
    )
    // TODO allSettled() above can result in err responses too, not much we can do. We are forced to add a second cron job,
    // which will look up all the product images in our database, then compare them to our cloudinary images,
    // and then delete the ones that arent used in any products. Not sure tho bc in the future we might wish
    // to just show the user all their cloudinary images, and let them handle it. We'd just show them their storage limits
    throw new CustomError('Error setting context tags for image assets', {responsesFailed})
  }

  return {responsesAllSettled, responsesSuccessful, responsesFailed}
}

// options for upload:
//https://cloudinary.com/documentation/image_upload_api_reference#upload_optional_parameters
export const generatePreSignedUrl = async () => {
  try {
    const options = {
      timestamp: Math.round(new Date().getTime() / 1000),
      asset_folder: 'products',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'jfif'],
      use_filename: true,
      context: 'linked=false|test=true'
      // to add more context, separate them with pipe, for ex: 'linked=false|abc=true'
      // not sure how else to add multiple contexts . Object doesnt work
    }
    // tags: 'unlinked',
    // eager: 'c_pad,h_300,w_400|c_crop,h_200,w_260',
    // access_mode: can be public or authenticated. defaults to public
    // access_control
    // context
    // metadata

    // context, metadata, and tags are all types of metadata:
    // https://cloudinary.com/documentation/custom_metadata
    // The main differeneces are:
    // tags = array of string
    // context = array of key/value pairs
    // metadata = same as context, but the fields are defined GLOBALLY on a project
    // not sure if I should add metadata besides tags. If I do, I could
    // add things like 'title' and 'description'. But I will already be 
    // addding this to the database, where I prefer it, so I don't see the point
    // of adding it here too, since we will always be browsing products by looking
    // at our database and each prducts url there, not by browsing cloudinary
    
    const signature = cloudinary.utils.api_sign_request({
    ...options
    },  cloudinary.config().api_secret);

    return { 
      cloudname: cloudinary.config().cloud_name,
      options: {
        api_key: cloudinary.config().api_key,
        signature,
        ...options
      }
    }
  } catch (err) {
    throw new CustomError('Failed to generate pre-signed URL');
  }
}