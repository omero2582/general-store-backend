import mongoose from "mongoose";

const Schema = mongoose.Schema;

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

const CategorySchema = new Schema({
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
}, {
  timestamps: true,
  methods : {
  },
  statics: {
    
  },
  toJSON: reshapingOptions,
  toObject: reshapingOptions
});

// // Apply a collation for case insensitivity
CategorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
// TODO Just using this as a backup.
// But currently in our category add and edit, we alwasy check if a document exist with the
// same .name field value regardless of upper/lower case
// Why? explained in notes.txt, but basically setting up a coallition index means when we
// receive the error, we can no longer extract the original value of that field,
// it will instead be an internal 'Coalitiojn Key' value in binary/hex.
// And since we DO want to extract the value in the duplicate error, we are
// forced to instead query the DB to find if duplicate exist + its original value

const Category = mongoose.model('Category', CategorySchema);
export default Category;
