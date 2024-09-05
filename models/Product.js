import mongoose from "mongoose";

const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number },  // in cents
  image: { 
    type: {
      publicId: { type: String, required: true },
      url: { type: String, required: true },
      _id: false,
    },
    required: true
  },
  visibility : { type: String, enum: ['public', 'private'], default: 'public' },

  // TODO calculated anytime a rating is added, edited, or removed
  averageRating: { type: Number, default: 0 },
  numRatings: { type: Number, default: 0 }
}, {
  timestamps: true,
  methods : {
  },
  statics: {
    
  }
});

ProductSchema.index({ averageRating: -1 });
const Product = mongoose.model('Product', ProductSchema);
export default Product;
