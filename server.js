require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// CORS configuration for multiple environments
const normalizeOrigin = (origin) =>
  typeof origin === 'string' ? origin.replace(/\/$/, '') : origin;

const additionalOrigins = process.env.CORS_ADDITIONAL_ORIGINS
  ? process.env.CORS_ADDITIONAL_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://movie-site-mu-five.vercel.app',
  'https://movie-review-backend-gg0v.onrender.com',  
  'https://accounts.google.com',
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null,
  ...additionalOrigins
].filter(Boolean)  // Remove any null/undefined values
  .map(normalizeOrigin);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

const corsMiddleware = cors(corsOptions);
app.use(corsMiddleware);

// Handle preflight requests globally without triggering path-to-regexp wildcard errors
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return corsMiddleware(req, res, () => res.sendStatus(200));
  }
  next();
});

// Middleware
app.use(express.json());

// MongoDB Connection
if (!process.env.MONGODB_URI) {
  console.error("Missing MONGODB_URI environment variable. Set it before starting the server.");
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch(err => {
    console.error("MongoDB Connection Error:", err.message);
    process.exit(1); // Exit if we can't connect to MongoDB
  });

// API Routes
app.use("/auth", require("./routes/auth"));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: 'OK',
    message: 'Movie Review API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files from the React app in production
// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder if the frontend build is present
  const frontendPath = path.join(__dirname, '../front_end/dist');

  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));

    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(frontendPath, 'index.html'));
    });
  } else {
    console.log('No frontend build found at', frontendPath, '- skipping static file hosting.');
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
