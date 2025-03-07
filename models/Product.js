import mongoose from "mongoose";

const Schema = mongoose.Schema;

// transform applied when we call .toObject or .toJSON
// explained at 3rd-4th comment https://stackoverflow.com/questions/31756673/what-is-the-difference-between-mongoose-toobject-and-tojson
const reshapingOptions = {
  virtuals: true, // include .id (it's a virtual)  
  versionKey: false,  // exclude .__v
  // exclude ._id
  transform: function (doc, ret) {
      delete ret._id;
      return ret;
  },
  getters:true,
};

const ProductSchema = new Schema({
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  minUserLevelForActions: { type: String, enum: ['owner', 'admin', 'user'], default: 'admin' },
  price: {  // stored in cents
    type: Number,
    validate: {
      validator: Number.isInteger,
      message: props => `${props.value} is not an Integer`
    },
    set: function(value) {
      // Convert the price to integer in cents
      return Math.floor(value * 100);
    },
    get: function(value) {
      // Convert the stored integer cents back to a number up to 2 decimal places
      return Number((value / 100).toFixed(2));
    }
   },
  categories: {
    type : [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    default: []
  },
  visibility : { type: String, enum: ['public', 'private'], default: 'public' },

  // TODO these 2 will be calculated anytime a rating is added, edited, or removed
  rating: { 
    type: Number, 
    default: 0,
    get: function(value) {
      return Number(value.toFixed(1));
    }
  },
  numRatings: { type: Number, default: 0 },
  //
  images: { 
    type: [{
      publicId: { type: String, required: true },
      url: { type: String, required: true },
      order: { type: Number, required: true},
      _id: false,
    }],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length > 0;
      },
      message: 'Images array must contain at least one image.'
    }
  },
}, {
  timestamps: true,
  methods : {
  },
  statics: {
    
  },
  toJSON: reshapingOptions,
  toObject: reshapingOptions
});

ProductSchema.index({ rating: -1 });
const Product = mongoose.model('Product', ProductSchema);
export default Product;
