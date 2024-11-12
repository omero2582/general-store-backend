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
  name: { type: String, required: true, unique: true },
}, {
  timestamps: true,
  methods : {
  },
  statics: {
    
  },
  toJSON: reshapingOptions,
  toObject: reshapingOptions
});

const Category = mongoose.model('Category', CategorySchema);
export default Category;
