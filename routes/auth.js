const express = require("express");
const { OAuth2Client } = require('google-auth-library');
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    // Validate input
    if (!email || !password || !username) {
      return res.status(400).json({ message: "Please provide email, username, and password" });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      email,
      username,
      password: hashedPassword
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { id: user._id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = jwt.sign(
      { id: user._id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Google OAuth
router.post("/google", async (req, res) => {
  console.log('Google OAuth request received');
  
  try {
    const { credential } = req.body;
    console.log('Request body:', req.body);

    if (!credential) {
      console.error('Missing credential in request');
      return res.status(400).json({ 
        success: false,
        message: 'Missing Google credential' 
      });
    }

    console.log('Verifying Google ID token...');
    
    try {
      // Verify the Google ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      console.log('Google payload:', {
        email: payload.email,
        name: payload.name,
        email_verified: payload.email_verified
      });

      if (!payload.email_verified) {
        return res.status(400).json({
          success: false,
          message: 'Email not verified by Google'
        });
      }

      const { email, name, picture } = payload;

      // Check if user exists
      let user = await User.findOne({ email });
      console.log('User found in database:', user ? 'Yes' : 'No');

      if (!user) {
        console.log('Creating new user...');
        // Create new user if doesn't exist
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        
        user = new User({
          email,
          username: name,
          password: hashedPassword,
          profilePicture: picture,
          isGoogleSignIn: true
        });

        await user.save();
        console.log('New user created:', user._id);
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log('Authentication successful for user:', user.email);
      
      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          profilePicture: user.profilePicture
        }
      });
      
    } catch (googleError) {
      console.error('Google token verification error:', googleError);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
        error: googleError.message
      });
    }
  } catch (error) {
    console.error('Server error during Google auth:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during authentication',
      error: error.message 
    });
  }
});

// Get current user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;