const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON body (for POST requests)
app.use(express.json());

// Serve static files from 'public' if needed
app.use(express.static("public"));

// Log requests
app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// Reusable email sender function (email parameter added)
async function sendMotivationalEmail(tag = "Daily", toEmail = "sadashivpolle3@gmail.com") {
  const response = await axios.get("https://zenquotes.io/api/random");
  const quoteData = response.data[0];
  const quote = `${quoteData.q} – ${quoteData.a}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "sadashivpolle3@gmail.com",      // 👈 Replace this
      pass: "ufmc yiiu masi jojb",         // 👈 Use Gmail App Password
    },
  });

  const mailOptions = {
    from: "sadashivpolle3@gmail.com",
    to: toEmail,
    subject: `🌄 ${tag} Motivation`,
    text: `Hello!\n\n"${quote}"\n\nStay strong and inspired! 💪 – Sadashiv's API`,
  };

  await transporter.sendMail(mailOptions);
  console.log(`✅ ${tag} motivational email sent to ${toEmail}`);
  return quote;
}

// Schedule daily email at 8:00 AM
cron.schedule("0 8 * * *", async () => {
  try {
    await sendMotivationalEmail("Daily");
  } catch (error) {
    console.error("❌ Scheduled email error:", error.message);
  }
});

// Serve HTML with email form and buttons
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to My API</title>
    <style>
      * {
        margin: 0; padding: 0; box-sizing: border-box;
      }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f0f2f5;
        color: #222;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
        text-align: center;
      }
      h1 {
        font-size: 2.5rem;
        margin-bottom: 20px;
        color: #1e40af;
      }
      p {
        font-size: 1.2rem;
        color: #555;
        margin-bottom: 30px;
        max-width: 480px;
      }
      .btn {
        background-color: #1e40af;
        color: white;
        font-weight: 600;
        padding: 14px 36px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 1.1rem;
        margin: 10px 15px;
        transition: background-color 0.3s ease;
        user-select: none;
      }
      .btn:hover,
      .btn:focus {
        background-color: #3b82f6;
        outline: none;
      }
      input[type="email"] {
        padding: 12px 16px;
        font-size: 1rem;
        border-radius: 8px;
        border: 1.5px solid #ccc;
        margin-right: 10px;
        width: 280px;
        max-width: 90vw;
      }
      .form-container {
        margin: 25px 0 50px;
      }
      #message {
        margin-top: 15px;
        font-weight: 600;
        color: #1e40af;
      }
      footer {
        margin-top: 50px;
        font-size: 0.9rem;
        color: #777;
      }
      footer a {
        color: #1e40af;
        text-decoration: none;
        font-weight: 600;
      }
      footer a:hover {
        text-decoration: underline;
      }
      @media (max-width: 500px) {
        .btn {
          width: 100%;
          max-width: 280px;
          margin: 10px 0;
        }
        p {
          font-size: 1rem;
        }
        input[type="email"] {
          margin-bottom: 10px;
          margin-right: 0;
          width: 100%;
        }
        .form-container {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
      }
    </style>
  </head>
  <body>
    <h1>Welcome to SADASHIV'S TEST API</h1>
    <p>This API serves dynamic content and a simple HTML page.</p>
    <div>
      <button onclick="location.href='/api/hello'" class="btn" type="button">Tap Here For Message</button>
      <button onclick="location.href='/api/motivate'" class="btn" type="button">Get Daily Motivation</button>
      <button onclick="location.href='/api/send-motivation'" class="btn" type="button">Send Motivation Now</button>
    </div>

    <div class="form-container">
      <input id="emailInput" type="email" placeholder="Enter email to send quote" required />
      <button id="sendEmailBtn" class="btn" type="button">Send to Email</button>
      <div id="message"></div>
    </div>

    <footer>
      <p>Powered by <a href="/yo.jpeg" target="_blank" rel="noopener noreferrer">Sadashiv Polle</a></p>
    </footer>

    <script>
      const btn = document.getElementById('sendEmailBtn');
      const emailInput = document.getElementById('emailInput');
      const messageDiv = document.getElementById('message');

      btn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        messageDiv.textContent = '';
        if (!email) {
          messageDiv.style.color = 'red';
          messageDiv.textContent = 'Please enter a valid email address.';
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
          const res = await fetch('/api/send-to-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });

          const data = await res.json();

          if (res.ok) {
            messageDiv.style.color = 'green';
            messageDiv.textContent = data.status + "\\nQuote: " + data.quote;
            emailInput.value = '';
          } else {
            messageDiv.style.color = 'red';
            messageDiv.textContent = data.error || 'Failed to send email.';
          }
        } catch (error) {
          messageDiv.style.color = 'red';
          messageDiv.textContent = 'Error: ' + error.message;
        } finally {
          btn.disabled = false;
          btn.textContent = 'Send to Email';
        }
      });
    </script>
  </body>
  </html>
  `);
});

// Welcome message route
app.get("/api/hello", (req, res) => {
  res.json({
    message:
      "Hello! 👋 Welcome to Sadashiv's Custom Node.js API. We're thrilled to have you here. Feel free to explore and interact with the API!",
  });
});

// Get a motivational quote
app.get("/api/motivate", async (req, res) => {
  try {
    const response = await axios.get("https://zenquotes.io/api/random");
    const quote = response.data[0];
    res.json({
      quote: quote.q,
      author: quote.a,
      message: `“${quote.q}” – ${quote.a}`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

// Manually send motivational email to default recipient
app.get("/api/send-motivation", async (req, res) => {
  try {
    const quote = await sendMotivationalEmail("Manual");
    res.json({
      status: "✅ Manual motivational email sent!",
      quote: quote,
    });
  } catch (error) {
    console.error("❌ Manual email error:", error.message);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// New POST route to send motivation to an email provided by client
app.post("/api/send-to-email", async (req, res) => {
  const { email } = req.body;

  // Basic email validation (you can improve this)
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  try {
    const quote = await sendMotivationalEmail("Personal", email);
    res.json({ status: `✅ Motivation sent to ${email}!`, quote });
  } catch (error) {
    console.error("❌ Error sending personal email:", error.message);
    res.status(500).json({ error: "Failed to send email." });
  }
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running at http://94.136.188.46:${PORT}`);
});
