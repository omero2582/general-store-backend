import mongoose from "mongoose";

const Schema = mongoose.Schema;

const ProductRatingSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true, validate: {
    validator: Number.isInteger,
    message: props => `${props.value} is not an Integer`
  }},
  review: { type: String, maxLength: 250 },
}, {
  timestamps: true,
});


// Compound index for efficient queries and to prevent duplicate ratings per user per product
ProductRatingSchema.index({ product: 1, user: 1 }, { unique: true });
const ProductRating = mongoose.model('ProductRating', ProductRatingSchema);
export default ProductRating;