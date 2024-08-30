import mongoose from "mongoose";

const Schema = mongoose.Schema;

const ProductRatingSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
}, {
  timestamps: true,
});


ProductRatingSchema.index({ product: 1 });
const ProductRating = mongoose.model('ProductRating', ProductRatingSchema);
export default ProductRating;