// Import required modules
const express = require('express');

// Create an Express application
const app = express();

// Define the port for the application
const PORT = process.env.PORT || 3001;  // Using process.env.PORT for flexibility in deployment

// Middleware to log request details (optional but useful)
app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// Serve static HTML file
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to My API</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background-color: #f4f4f9;
        }
        h1 {
          color: #333;
        }
        p {
          font-size: 1.2em;
          color: #555;
        }
        .btn {
          background-color: #007bff;
          color: white;
          padding: 10px 20px;
          border: none;
          cursor: pointer;
          border-radius: 5px;
          text-decoration: none;
        }
        .btn:hover {
          background-color: #0056b3;
        }
      </style>
    </head>
    <body>
    <h1>SADASHIV'S TEST API</h1>
      <h1>Welcome to My Custom Node.js API</h1>
      <p>This API serves dynamic content along with a simple HTML page.</p>
      <p>To interact with the API, visit <a href="/api/hello" class="btn">/api/hello</a></p>
    </body>
    </html>
  `);
});

// Define API routes
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from custom Node.js API!' });
});

// Start the server and listen on all network interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running at http://94.136.188.46:${PORT}`);
});

// Error handling for unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});
