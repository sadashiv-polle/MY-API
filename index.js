// Import required modules
const express = require("express");

// Create an Express application
const app = express();

// Define the port for the application
const PORT = process.env.PORT || 3001; // Using process.env.PORT for flexibility in deployment

// Serve static files (like images, CSS, JS) from the 'public' directory
app.use(express.static("public"));

// Middleware to log request details (optional but useful)
app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// Serve static HTML file with enhanced design
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to My API</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          text-align: center;
          background-color: #f0f2f5;
          padding: 50px 20px;
        }
        h1 {
          color: #333;
          font-size: 2.5rem;
          margin-bottom: 20px;
        }
        p {
          font-size: 1.2rem;
          color: #555;
          margin-bottom: 20px;
        }
        .btn {
          background-color: #007bff;
          color: white;
          padding: 12px 25px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          font-size: 1rem;
          transition: background-color 0.3s ease;
        }
        .btn:hover {
          background-color: #0056b3;
        }
        footer {
          margin-top: 30px;
          font-size: 0.9rem;
          color: #888;
        }
        footer a {
          color: #007bff;
          text-decoration: none;
        }
        footer a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <h1>Welcome to SADASHIV'S TEST API</h1>
      <p>This API serves dynamic content and a simple HTML page.</p>
      <p>To interact with the API, visit the link below:</p>
      <a href="/api/hello" class="btn">Tap Here For Message</a>
      
      <footer>
        <p>Powered by <a href="/yo.jpeg" target="_blank">Sadashiv Polle</a></p>
      </footer>
    </body>
    </html>
  `);
});

// Define API routes
app.get("/api/hello", (req, res) => {
  res.json({
    message:
      "Hello! 👋 Welcome to Sadashiv's Custom Node.js API. We're thrilled to have you here. Feel free to explore and interact with the API!",
  });
});

// Start the server and listen on all network interfaces
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running at http://94.136.188.46:${PORT}`);
});

// Error handling for unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});
