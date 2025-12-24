const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { 
    type: String,
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  password: { 
    type: String,
    required: function() {
      return !this.isGoogleSignIn; // Password is not required for Google sign-in
    }
  },
  profilePicture: {
    type: String,
    default: ''
  },
  isGoogleSignIn: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", UserSchema);