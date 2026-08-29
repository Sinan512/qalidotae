var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, default: "", maxlength: 1200 },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    image: { type: String, required: true },
    category: { type: String, default: "Thobes", index: true },
    sizes: { type: [String], default: ["S", "M", "L", "XL"] },
    stock: { type: Number, default: 0, min: 0 },
    featured: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

productSchema.index({ active: 1, featured: 1, createdAt: -1 });
var userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
      index: true,
    },
  },
  { timestamps: true },
);

var orderSchema = new Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        price: Number,
        quantity: Number,
        size: String,
        image: String,
      },
    ],
    subtotal: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    shipping: {
      name: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      postalCode: String,
    },
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1, status: 1 });
module.exports = {
  Product: mongoose.models.Product || mongoose.model("Product", productSchema),
  User: mongoose.models.User || mongoose.model("User", userSchema),
  Order: mongoose.models.Order || mongoose.model("Order", orderSchema),
};
