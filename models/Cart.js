import mongoose from "mongoose";

const Schema = mongoose.Schema;

// TOOD NEWWWWWWWWW
// This works well, maybe review a little
const reshapingOptions = {
  transform: function (doc, cart) {
    // delete ret._id;
    // return ret;
    // Calculate itemTotal for each item
    cart.items = cart.items.map(item => ({
      ...item,
      itemTotal: item.product.price * item.quantity,
    }));

    cart.total = cart.items.reduce((sum, cur) => {
      return sum + cur.itemTotal;
    }, 0)

    return cart;
    // asdasda throw new Error
  },
  getters:true,
};

const CartSchema = new Schema({
  user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  items: {
    type: [{
      _id: false,
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, default: 1, min: 1 }
    }],
    default: [],
  },
}, {
  toJSON: reshapingOptions,
  toObject: reshapingOptions
});

const Cart = mongoose.model('Cart', CartSchema);
export default Cart;

// maybe add some tranform (?) that if quntaity is less than 1, then remove item??