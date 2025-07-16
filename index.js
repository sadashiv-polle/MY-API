const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const fs = require("fs");
const cookieSession = require("cookie-session");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
const http = require("http");
const https = require("https");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
const SESSION_KEY = process.env.SESSION_KEY;
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';

// Log environment variables for debugging
console.log("Environment Variables:", {
  EMAIL_USER: EMAIL_USER ? "Set" : "Not set",
  EMAIL_PASS: EMAIL_PASS ? "Set" : "Not set",
  DASHBOARD_PASSWORD: DASHBOARD_PASSWORD ? "Set" : "Not set",
  SESSION_KEY: SESSION_KEY ? "Set" : "Not set",
  NODE_ENV: process.env.NODE_ENV,
  ENABLE_HTTPS: ENABLE_HTTPS,
  PORT
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." }
}));

app.use(
  cookieSession({
    name: "session",
    keys: [SESSION_KEY || "fallback-secret-key"], // Fallback to prevent crashes
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'strict',
    secure: ENABLE_HTTPS // Use ENABLE_HTTPS instead of NODE_ENV
  })
);

app.use(express.static("public"));

app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// HTTP to HTTPS redirect (if ENABLE_HTTPS is true)
if (ENABLE_HTTPS) {
  app.use((req, res, next) => {
    if (req.protocol === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    res.redirect("/login?error=Please+log+in");
  }
}

// --- Helper: Remove email from file ---
function removeEmailFromFile(email, file) {
  if (!fs.existsSync(file)) return;
  let emails = fs.readFileSync(file, "utf-8").split("\n").map(e => e.trim()).filter(Boolean);
  emails = emails.filter(e => e !== email);
  fs.writeFileSync(file, emails.join("\n") + (emails.length ? "\n" : ""));
}

// --- Helper: Detect "address not found" SMTP error ---
function isAddressNotFoundError(error) {
  const msg = (error && (error.message || error.response || "")).toLowerCase();
  const code = error && error.responseCode ? error.responseCode.toString() : "";
  return (
    msg.includes("user not found") ||
    msg.includes("no such user") ||
    msg.includes("recipient address rejected") ||
    msg.includes("mailbox unavailable") ||
    msg.includes("550") ||
    code === "550"
  );
}

async function sendMotivationalEmail(tag = "Daily", toEmail = EMAIL_USER) {
  try {
    const response = await axios.get("https://zenquotes.io/api/random");
    const quoteData = response.data[0];
    const quote = `${quoteData.q} – ${quoteData.a}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: EMAIL_USER,
      to: toEmail,
      subject: `🌄 ${tag} Motivation`,
      text: `Hello!\n\n"${quote}"\n\nKeep thriving every day! 🌱 – Inspiration Express`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ ${tag} motivational email sent to ${toEmail}`);
    return quote;
  } catch (error) {
    console.error(`❌ Error in sendMotivationalEmail: ${error.message}`);
    throw error;
  }
}

async function sendFeedbackEmail(feedback, userEmail = "") {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: EMAIL_USER,
      to: EMAIL_USER,
      subject: "🌟 New User Feedback Received",
      text:
        `Feedback received:\n\n${feedback}\n\n` +
        (userEmail ? `User Email: ${userEmail}\n` : ""),
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Feedback email sent");
  } catch (error) {
    console.error("❌ Error sending feedback email:", error.message);
    throw error;
  }
}

// Scheduled daily motivational emails at 9:30 AM IST (Asia/Kolkata)
cron.schedule("30 9 * * *", async () => {
  try {
    if (!fs.existsSync("emails.txt")) {
      console.log("No emails.txt file found, skipping scheduled emails.");
      return;
    }
    const emails = fs.readFileSync("emails.txt", "utf-8")
      .split("\n")
      .map(email => email.trim())
      .filter(email => email);

    for (const email of emails) {
      try {
        await sendMotivationalEmail("Daily", email);
      } catch (error) {
        if (isAddressNotFoundError(error)) {
          removeEmailFromFile(email, "emails.txt");
          fs.appendFileSync("failed_emails.txt", email + "\n");
          console.error(`Moved undeliverable email to failed_emails.txt: ${email}`);
        } else {
          fs.appendFileSync("failed_emails.txt", email + "\n");
          console.error(`Logged failed scheduled email: ${email}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Scheduled email error:", error.message);
  }
}, {
  timezone: "Asia/Kolkata"
});

// ======= SUBSCRIBER COUNT API =======
app.get("/api/subscriber-count", (req, res) => {
  let count = 0;
  if (fs.existsSync("emails.txt")) {
    count = fs.readFileSync("emails.txt", "utf-8")
      .split("\n")
      .map(e => e.trim())
      .filter(Boolean).length;
  }
  res.json({ count: count + 10 });
});

// ======= HOMEPAGE =======
app.get("/", (req, res) => {
  let showSendToEmail = true;
  try {
    if (fs.existsSync("settings.json")) {
      showSendToEmail = JSON.parse(fs.readFileSync("settings.json", "utf-8")).showSendToEmail;
    }
  } catch (e) {
    showSendToEmail = true;
  }

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Motivica.space</title>
  <link rel="icon" type="image/png" href="/seo.png">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
    input[type="email"], input[type="text"], textarea {
      padding: 12px 16px;
      font-size: 1rem;
      border-radius: 8px;
      border: 1.5px solid #ccc;
      margin-right: 10px;
      width: 280px;
      max-width: 90vw;
    }
    textarea {
      width: 360px;
      min-height: 60px;
      margin-top: 10px;
      margin-bottom: 10px;
      resize: vertical;
    }
    .form-container {
      margin: 25px 0 50px;
    }
    #message {
      margin-top: 15px;
      font-weight: 600;
      color: #1e40af;
      white-space: pre-line;
      padding: 14px 20px;
      border-radius: 12px;
      max-width: 340px;
      background-color: #dbeafe;
      box-shadow: 0 4px 16px rgba(30, 64, 175, 0.13);
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.35s, transform 0.35s;
      pointer-events: none;
      user-select: none;
      margin-left: auto;
      margin-right: auto;
      text-align: center;
      font-size: 1.1rem;
    }
    #message.show {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px #1e40af22;
      padding: 24px 32px;
      margin: 25px auto 30px;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: max-width 0.4s, width 0.4s;
    }
    .card.wide {
      max-width: 440px !important;
      width: 96vw !important;
      transition: max-width 0.4s, width 0.4s;
    }
    .card h3 {
      color: #0e7490;
      margin-bottom: 8px;
      font-size: 1.3rem;
      font-weight: 600;
      word-break: break-word;
      word-wrap: break-word;
    }
    .card .count {
      font-size: 2.2rem;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 0;
    }
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0; top: 0;
      width: 100%; height: 100%;
      overflow: auto;
      background-color: rgba(0,0,0,0.5);
      align-items: center;
      justify-content: center;
    }
    .modal-content {
      background-color: #fff;
      margin: auto;
      border-radius: 10px;
      padding: 20px 30px;
      max-width: 450px;
      width: 90%;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      position: relative;
    }
    .modal-close {
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 24px;
      font-weight: bold;
      color: #aaa;
      cursor: pointer;
      transition: color 0.3s ease;
    }
    .modal-close:hover {
      color: #000;
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
      input[type="email"], input[type="text"], textarea {
        margin-bottom: 10px;
        margin-right: 0;
        width: 100%;
      }
      textarea { width: 100%; }
      .form-container {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      #message {
        max-width: 95vw;
        font-size: 1rem;
      }
      .card, .card.wide {
        width: 100% !important;
        max-width: 95vw !important;
      }
    }
  </style>
</head>
<body>
  <h1>🚀 Welcome to Your Daily Dose of Inspiration!</h1>
  <p><span class="highlight">Simple, powerful, and made just for you.</span></p>
  <div id="subscriberCard" class="card">
    <h3 id="subscriberHeader">Subscribers</h3>
    <div id="subscriberCount" class="count">...</div>
  </div>

  <div>
    <button id="helloBtn" class="btn" type="button">Tap Here For Message</button>
    <button id="getDailyMotivationBtn" class="btn" type="button">Get Daily Motivation</button>
    <button id="openFeedbackBtn" class="btn" type="button">Send Feedback</button>
    <button onclick="location.href='/login'" class="btn" type="button">Dashboard</button>
  </div>
  <div class="form-container">
    <input id="emailInput" type="email" placeholder="Enter email to send quote" required />
    ${showSendToEmail ? `<button id="sendEmailBtn" class="btn" type="button">Send to Email</button>` : ""}
    <button id="subscribeBtn" class="btn" type="button">Subscribe</button>
    <button id="unsubscribeBtn" class="btn" type="button">Unsubscribe</button>
    <div id="message"></div>
    <p style="margin-top:8px; color:#0e7490; font-weight:600; white-space: nowrap;">
      <span style="font-size:1.1em;">⏰ Daily lift emails are sent at <b>9:30 AM</b> (IST) to all subscribers.<span style="font-size:1.1em;">/<a href="/about">About</a></span><p>
    </span>
  </div>
  <!-- Feedback Modal -->
  <div id="feedbackModal" class="modal" aria-hidden="true" role="dialog" aria-labelledby="feedbackTitle">
    <div class="modal-content">
      <span class="modal-close" id="closeFeedbackModal" aria-label="Close">×</span>
      <h2 id="feedbackTitle" style="color:#1e40af; margin-bottom: 12px;">Send Feedback</h2>
      <form id="feedbackForm" autocomplete="off">
        <label for="feedbackBox" style="font-weight:600; display:block; margin-bottom:6px;">Your Feedback</label>
        <textarea id="feedbackBox" placeholder="Your feedback here..." required></textarea>
        <label for="feedbackEmail" style="font-weight:600; display:block; margin-bottom:6px;">Your Email And Name</label>
        <input type="email" id="feedbackEmail" placeholder="Your email" />
        <button type="submit" class="btn" style="margin-top:10px; width: 100%;">Send Feedback</button>
        <div id="feedbackMsg" style="margin-top:10px; font-weight:600; min-height: 24px;"></div>
      </form>
    </div>
  </div>
  <footer>
    <p>Powered by <a href="/yo.jpeg" target="_blank" rel="noopener noreferrer">Sadashiv Polle</a>
    </p>
  </footer>
  <script>
    const helloBtn = document.getElementById('helloBtn');
    const subscriberHeader = document.getElementById('subscriberHeader');
    const subscriberCount = document.getElementById('subscriberCount');
    const subscriberCard = document.getElementById('subscriberCard');
    const getDailyMotivationBtn = document.getElementById('getDailyMotivationBtn');
    const sendBtn = document.getElementById('sendEmailBtn');
    const subscribeBtn = document.getElementById('subscribeBtn');
    const unsubscribeBtn = document.getElementById('unsubscribeBtn');
    const emailInput = document.getElementById('emailInput');
    const messageDiv = document.getElementById('message');
    const feedbackModal = document.getElementById('feedbackModal');
    const openFeedbackBtn = document.getElementById('openFeedbackBtn');
    const closeFeedbackModal = document.getElementById('closeFeedbackModal');
    const feedbackForm = document.getElementById('feedbackForm');
    const feedbackBox = document.getElementById('feedbackBox');
    const feedbackEmail = document.getElementById('feedbackEmail');
    const feedbackMsg = document.getElementById('feedbackMsg');

    // Subscriber count updater
    async function updateSubscriberCount() {
      try {
        const res = await fetch('/api/subscriber-count');
        const data = await res.json();
        subscriberCount.textContent = data.count;
      } catch (e) {
        subscriberCount.textContent = 'N/A';
      }
    }
    updateSubscriberCount();

    function showMessage(text, color = '#1e40af', duration = 6000) {
      messageDiv.style.color = color;
      messageDiv.textContent = text;
      messageDiv.classList.add('show');
      if (messageDiv.hideTimeout) clearTimeout(messageDiv.hideTimeout);
      messageDiv.hideTimeout = setTimeout(() => {
        messageDiv.classList.remove('show');
      }, duration);
    }
    async function postData(url = '', data = {}) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await response.json();
      return { status: response.status, data: json };
    }

    // HELLO button logic
    helloBtn.addEventListener('click', async () => {
      helloBtn.disabled = true;
      helloBtn.textContent = 'Loading...';
      try {
        const res = await fetch('/api/hello');
        const data = await res.json();
        subscriberHeader.textContent = data.message;
        subscriberCount.style.display = "none";
        subscriberCard.classList.add("wide");
        if(window.subscriberMsgTimeout) clearTimeout(window.subscriberMsgTimeout);
        window.subscriberMsgTimeout = setTimeout(() => {
          subscriberHeader.textContent = 'Subscribers';
          subscriberCount.style.display = "";
          subscriberCard.classList.remove("wide");
        }, 6000);
      } catch (e) {
        showMessage('Error fetching message!', '#dc2626', 4000);
      }
      helloBtn.disabled = false;
      helloBtn.textContent = 'Tap Here For Message';
    });

    // Motivation button logic
    getDailyMotivationBtn.addEventListener('click', async () => {
      getDailyMotivationBtn.disabled = true;
      getDailyMotivationBtn.textContent = 'Loading...';
      try {
        const res = await fetch('/api/motivate');
        const data = await res.json();
        if (data.quote && data.author) {
          subscriberHeader.textContent = '"' + data.quote + '" — ' + data.author;
          subscriberCount.style.display = "none";
          subscriberCard.classList.add("wide");
          if(window.subscriberMsgTimeout) clearTimeout(window.subscriberMsgTimeout);
          window.subscriberMsgTimeout = setTimeout(() => {
            subscriberHeader.textContent = 'Subscribers';
            subscriberCount.style.display = "";
            subscriberCard.classList.remove("wide");
          }, 6000);
        } else {
          showMessage('Could not fetch a motivational quote right now.', '#dc2626', 4000);
        }
      } catch (e) {
        showMessage('Error fetching motivation!', '#dc2626', 4000);
      }
      getDailyMotivationBtn.disabled = false;
      getDailyMotivationBtn.textContent = 'Get Daily Motivation';
    });

    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
          showMessage('Please enter a valid email address.', '#dc2626', 4000);
          return;
        }
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        try {
          const { status, data } = await postData('/api/send-to-email', { email });
          if (status >= 200 && status < 300) {
            showMessage(data.status + "\\nQuote: " + data.quote, '#16a34a', 4000);
            emailInput.value = '';
          } else {
            showMessage(data.error || 'Failed to send email.', '#dc2626', 4000);
          }
        } catch (err) {
          showMessage('Error: ' + err.message, '#dc2626', 4000);
        } finally {
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send to Email';
        }
      });
    }
    subscribeBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email) {
        showMessage('Please enter a valid email address to subscribe.', '#dc2626', 4000);
        return;
      }
      subscribeBtn.disabled = true;
      subscribeBtn.textContent = 'Subscribing...';
      try {
        const { status, data } = await postData('/api/subscribe', { email });
        if (status >= 200 && status < 300) {
          showMessage(data.status, '#16a34a', 4000);
          emailInput.value = '';
          updateSubscriberCount();
        } else {
          showMessage(data.error || 'Failed to subscribe.', '#dc2626', 4000);
        }
      } catch (err) {
        showMessage('Error: ' + err.message, '#dc2626', 4000);
      } finally {
        subscribeBtn.disabled = false;
        subscribeBtn.textContent = 'Subscribe';
      }
    });
    unsubscribeBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email) {
        showMessage('Please enter a valid email address to unsubscribe.', '#dc2626', 4000);
        return;
      }
      unsubscribeBtn.disabled = true;
      unsubscribeBtn.textContent = 'Unsubscribing...';
      try {
        const { status, data } = await postData('/api/unsubscribe', { email });
        if (status >= 200 && status < 300) {
          showMessage(data.status, '#16a34a', 4000);
          emailInput.value = '';
          updateSubscriberCount();
        } else {
          showMessage(data.error || 'Failed to unsubscribe.', '#dc2626', 4000);
        }
      } catch (err) {
        showMessage('Error: ' + err.message, '#dc2626', 4000);
      } finally {
        unsubscribeBtn.disabled = false;
        unsubscribeBtn.textContent = 'Unsubscribe';
      }
    });
    openFeedbackBtn.addEventListener('click', () => {
      feedbackModal.style.display = 'flex';
      feedbackMsg.textContent = "";
      feedbackBox.value = "";
      feedbackEmail.value = "";
      feedbackBox.focus();
    });
    closeFeedbackModal.addEventListener('click', () => {
      feedbackModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
      if (e.target === feedbackModal) {
        feedbackModal.style.display = 'none';
      }
    });
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = feedbackBox.value.trim();
      const userEmail = feedbackEmail.value.trim();
      if (!feedback) {
        feedbackMsg.style.color = "#dc2626";
        feedbackMsg.textContent = "Please enter your feedback.";
        return;
      }
      feedbackMsg.style.color = "#1e40af";
      feedbackMsg.textContent = "Sending...";
      try {
        const { status, data } = await postData('/api/feedback', { feedback, userEmail });
        if (status >= 200 && status < 300) {
          feedbackMsg.style.color = "#16a34a";
          feedbackMsg.textContent = "Thank you for your feedback!";
          feedbackBox.value = "";
          feedbackEmail.value = "";
          setTimeout(() => {
            feedbackModal.style.display = 'none';
          }, 1500);
        } else {
          feedbackMsg.style.color = "#dc2626";
          feedbackMsg.textContent = data.error || "Failed to send feedback.";
        }
      } catch (err) {
        feedbackMsg.style.color = "#dc2626";
        feedbackMsg.textContent = "Error: " + err.message;
      }
    });
  </script>
</body>
</html>
  `);
});


// ======= TOGGLE ROUTE FOR SEND TO EMAIL BUTTON =======
app.post("/dashboard/toggle-send-to-email", requireLogin, (req, res) => {
  const show = req.body.showSendToEmail === "true" || req.body.showSendToEmail === "on";
  fs.writeFileSync("settings.json", JSON.stringify({ showSendToEmail: show }, null, 2));
  res.redirect("/dashboard");
});

// ======= FEEDBACK API =======
app.post("/api/feedback", async (req, res) => {
  const { feedback, userEmail } = req.body;
  if (!feedback || typeof feedback !== "string" || feedback.trim().length < 3) {
    return res.status(400).json({ error: "Feedback is too short." });
  }
  if (userEmail && !validator.isEmail(userEmail)) {
    return res.status(400).json({ error: "Invalid email address." });
  }
  try {
    await sendFeedbackEmail(feedback.trim(), userEmail ? userEmail.trim() : "");
    res.json({ status: "Feedback sent!" });
  } catch (e) {
    res.status(500).json({ error: "Failed to send feedback." });
  }
});

// ======= DASHBOARD, EMAIL MANAGEMENT, API ENDPOINTS =======
function getListFile(list) {
  if (list === "subscribed") return "emails.txt";
  if (list === "unsubscribed") return "unsubscribed.txt";
  if (list === "failed") return "failed_emails.txt";
  return null;
}

function parseBulkEmails(text) {
  return text
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

app.get("/login", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Dashboard Login</title>
      <style>
      <link rel="icon" type="image/png" href="/seo.png">
        body { font-family: sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; height: 100vh; }
        form { background: #fff; padding: 2rem; border-radius: 10px; box-shadow: 0 2px 8px #0001; }
        input, button { font-size: 1.1rem; padding: 8px; border-radius: 6px; border: 1px solid #ccc; margin-bottom: 1rem; width: 100%; }
        button { background: #1e40af; color: #fff; border: none; cursor: pointer; }
        button:hover { background: #3b82f6; }
        .error { color: red; font-weight: 600; }
      </style>
    </head>
    <body>
      <form method="POST" action="/login">
        <h2>Dashboard Login</h2>
        <input type="password" name="password" placeholder="Enter dashboard password" required />
        <button type="submit">Login</button>
        ${req.query.error ? `<div class="error">${decodeURIComponent(req.query.error)}</div>` : ''}
      </form>
    </body>
    </html>
  `);
});

app.post("/login", (req, res) => {
  const { password } = req.body;
  console.log("Login attempt - Password received:", password);
  console.log("DASHBOARD_PASSWORD:", DASHBOARD_PASSWORD);
  console.log("Session before:", req.session);
  if (!DASHBOARD_PASSWORD) {
    console.error("DASHBOARD_PASSWORD is not set in .env");
    return res.redirect("/login?error=Server+configuration+error");
  }
  if (!password) {
    console.log("No password provided");
    return res.redirect("/login?error=No+password+provided");
  }
  if (password === DASHBOARD_PASSWORD) {
    req.session.loggedIn = true;
    console.log("Password correct, session set:", req.session);
    return res.redirect("/dashboard");
  } else {
    console.log("Password incorrect");
    return res.redirect("/login?error=Incorrect+password");
  }
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.get("/dashboard", requireLogin, (req, res) => {
  let showSendToEmail = true;
  try {
    if (fs.existsSync("settings.json")) {
      showSendToEmail = JSON.parse(fs.readFileSync("settings.json", "utf-8")).showSendToEmail;
    }
  } catch (e) {
    showSendToEmail = true;
  }

  const readList = (file) =>
    fs.existsSync(file)
      ? fs.readFileSync(file, "utf-8").split("\n").filter(Boolean)
      : [];
  const subscribed = readList("emails.txt");
  const unsubscribed = readList("unsubscribed.txt");
  const failed = readList("failed_emails.txt");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f0f4f8;
          padding: 0;
          margin: 0;
          min-height: 100vh;
        }
        .top-bar {
          background: #1e40af;
          color: #fff;
          padding: 1.2rem 0.5rem 1.2rem 2.4rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .top-bar h1 {
          margin: 0;
          font-size: 2rem;
          letter-spacing: 1px;
        }
        .top-bar .actions {
          margin-right: 2.4rem;
        }
        .top-bar a.button {
          margin-left: 0.7rem;
        }
        .dashboard-container {
          max-width: 1100px;
          margin: 32px auto;
          padding: 0 1rem 2rem;
        }
        .toggle-row {
          margin: 30px 0 18px 0;
          padding: 18px 1rem;
          background: #f0f7fe;
          border-radius: 12px;
          font-size: 1.08rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #dbeafe;
        }
        .email-cards {
          display: flex;
          flex-wrap: wrap;
          gap: 2rem;
          margin-bottom: 2.2rem;
        }
        .email-card {
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 7px 18px 0 rgba(30, 64, 175, 0.09), 0 0.5px 2.5px #123d8835;
          flex: 1 1 300px;
          min-width: 310px;
          max-width: 390px;
          padding: 1.4rem 1.3rem;
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .email-card h2 {
          font-size: 1.33rem;
          margin: 0 0 0.9rem 0;
          color: #1e40af;
          letter-spacing: 0.1px;
          font-weight: 700;
        }
        .count-badge {
          background: #dbeafe;
          color: #1e40af;
          border-radius: 6px;
          font-size: 1.13rem;
          font-weight: 700;
          padding: 6px 18px 7px 18px;
          margin-bottom: 1.14rem;
          display: inline-block;
          min-width: 34px;
          text-align: center;
        }
        .email-list {
          list-style-type: none;
          padding: 0 0 0 2px;
          margin: 0 0 9px 0;
          max-height: 220px;
          overflow-y: auto;
          width: 100%;
        }
        .email-list li {
          margin: 0 0 0.5rem 0;
          background: #f9fafb;
          border-radius: 7px;
          padding: 8px 9px;
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: background 0.2s;
          border: 1px solid #e6eaff;
        }
        .email-list li:hover {
          background: #e0edfb;
        }
        form.inline {
          display: inline;
          margin: 0;
        }
        .button, a.button {
          display: inline-block;
          background: #2563eb;
          color: #fff !important;
          padding: 8px 18px;
          border-radius: 8px;
          border: none;
          text-decoration: none;
          font-size: 1.08rem;
          font-weight: 600;
          margin: 3px 0 3px 5px;
          cursor: pointer;
          transition: background 0.18s;
        }
        .button:hover, a.button:hover {
          background: #1e40af;
        }
        .mini-btn {
          padding: 4px 13px !important;
          font-size: 0.97rem !important;
          border-radius: 7px;
        }
        .form-block {
          width: 100%;
          margin: 15px 0 6px 0;
          background: #f4f7fe;
          border-radius: 8px;
          padding: 12px 8px 12px 15px;
          border: 1px solid #d2dffc;
          box-sizing: border-box;
        }
        .form-block label {
          font-weight: 600;
          margin-right: 8px;
        }
        .form-block input[type="text"], .form-block textarea {
          width: 92%;
          max-width: 410px;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1.2px solid #cdddfa;
          margin-bottom: 5px;
          margin-right: 0;
          font-size: 1rem;
        }
        .form-block textarea {
          min-height: 36px;
          resize: vertical;
          font-family: inherit;
        }
        @media (max-width: 1050px) {
          .dashboard-container { max-width: 99vw; }
          .email-cards { gap: 1rem;}
        }
        @media (max-width: 720px) {
          .dashboard-container { padding: 0.3rem; }
          .email-cards { flex-direction: column; }
          .email-card { min-width: 95vw; max-width: 99vw; }
        }
        @media (max-width: 480px) {
          .top-bar, .dashboard-container { padding: 0 !important; }
          .top-bar .actions { margin-right: 7px; }
          .dashboard-container { margin: 8px 0; }
          .toggle-row { flex-direction: column; gap: 7px;}
          .email-card { padding: 12px 5px; }
        }
      </style>
    </head>
    <body>
      <div class="top-bar">
        <h1>Dashboard</h1>
        <div class="actions">
          <a class="button" href="/logout" tabindex="1">Logout</a>
          <a class="button" href="/" tabindex="2">Back to Home</a>
        </div>
      </div>
      <div class="dashboard-container">
        <form method="POST" action="/dashboard/toggle-send-to-email" class="toggle-row">
          <label style="font-weight:600;">
            <input type="checkbox" name="showSendToEmail" value="true" ${showSendToEmail ? "checked" : ""} onchange="this.form.submit()" />
            Show "Send to Email" on Homepage
          </label>
        </form>
        <div class="email-cards">
        ${["Subscribed", "Unsubscribed", "Failed"].map((title, idx) => {
          const list = [subscribed, unsubscribed, failed][idx];
          const listId = ["subscribed", "unsubscribed", "failed"][idx];
          const prettyTitle = title + " Emails";
          return `
          <div class="email-card" aria-labelledby="heading-${listId}">
            <h2 id="heading-${listId}">${prettyTitle}</h2>
            <div class="count-badge">${list.length}</div>
            <ul class="email-list" id="list-${listId}">
              ${list.map(e =>
                `<li>
                  <span style="word-break: break-all;">${e}</span>
                  <form class="inline" method="POST" action="/dashboard/delete">
                    <input type="hidden" name="email" value="${e}" />
                    <input type="hidden" name="list" value="${listId}" />
                    <button class="button mini-btn" type="submit" title="Delete" aria-label="Delete email address">&times; Delete</button>
                  </form>
                </li>`).join("") || "<li style='color:#444;'>None</li>"}
            </ul>
            <div class="form-block">
              <form method="POST" action="/dashboard/add" style="display:inline-block; width: 100%;">
                <label for="add-${listId}">Add Email:</label>
                <input type="text" id="add-${listId}" name="email" placeholder="Add single email" required autocomplete="off" />
                <input type="hidden" name="list" value="${listId}" />
                <button class="button mini-btn" type="submit">Add</button>
              </form>
            </div>
            <div class="form-block">
              <form method="POST" action="/dashboard/bulkadd" style="display:inline-block; width:100%;">
                <label for="bulkadd-${listId}">Bulk Add:</label><br>
                <textarea id="bulkadd-${listId}" name="emails" placeholder="Emails: one per line or comma separated" style="margin-top:5px; width:97%;"></textarea>
                <input type="hidden" name="list" value="${listId}" />
                <button class="button mini-btn" type="submit" style="margin-top:7px;">Bulk Add</button>
              </form>
            </div>
            <div class="form-block">
              <form method="POST" action="/dashboard/bulkdelete" style="display:inline-block; width:100%;">
                <label for="bulkdel-${listId}">Bulk Delete:</label><br>
                <textarea id="bulkdel-${listId}" name="emails" placeholder="Emails: one per line or comma separated" style="margin-top:5px; width:97%;"></textarea>
                <input type="hidden" name="list" value="${listId}" />
                <button class="button mini-btn" type="submit" style="margin-top:7px;background:#dc2626;">Bulk Delete</button>
              </form>
            </div>
          </div>
          `;
        }).join("")}
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get("/about", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>About | Motivica.space</title>
      <link rel="icon" type="image/png" href="/seo.png">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f8fafc;
          color: #232323;
          margin: 0;
          padding: 0;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .container {
          max-width: 700px;
          margin: 30px auto;
          padding: 2.2rem 1.2rem 2.2rem 1.2rem;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 4px 18px 0 rgba(30, 64, 175, 0.09), 0 0.5px 2.5px #123d8835;
        }
        h1 {
          color: #1e40af;
          margin-top: 0;
          font-size: 2rem;
          margin-bottom: 14px;
        }
        a {
          color: #1e40af;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .backlink {
          display: block;
          margin: 0 0 18px 0;
        }
        @media (max-width: 700px) {
          .container { max-width: 97vw; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <a class="backlink" href="/">&larr; Back to Home</a>
        <h1>About This Project</h1>
        <p>
          <b>Motivica.space</b> is a simple, open-source web service  created by sadashiv polle that delivers daily motivation quotes to your inbox and offers a minimal API to inspire anyone at any time.<br><br>
          You can subscribe to daily email lifts, get instant motivation, and manage your subscription—all privacy-friendly and free.<br><br>
          <b>Features:</b>
          <ul>
            <li>Daily motivational quotes delivered to your email at 9:30 AM (IST)</li>
            <li>Tap to see instant web-based motivational messages</li>
            <li>Easy subscribe/unsubscribe and one-click personal quote emails</li>
            <li><b>Everything is privacy-friendly, simple, and user-focused</b></li>
          </ul>
          <b>Stack:</b> Node.js, Express, Nodemailer<br>
          <b>Made by:</b> <a href="https://github.com/sadashivpolle" target="_blank">Sadashiv Polle</a>
        </p>
        <p>
          <b>Source code:</b> <a href="https://github.com/YOUR_GITHUB_URL">GitHub</a>
        </p>
        <hr>
        <!--<p style="font-size:1rem; color:#495;">Contact: 
          <a href="mailto:polle.sadashiv@gmail.com">polle.sadashiv@gmail.com</a>
        </p>-->
      </div>
    </body>
    </html>
  `);
});


app.post("/dashboard/add", requireLogin, (req, res) => {
  const { email, list } = req.body;
  const file = getListFile(list);
  if (!file || !email || !validator.isEmail(email)) return res.redirect("/dashboard");
  let emails = [];
  if (fs.existsSync(file)) {
    emails = fs.readFileSync(file, "utf-8").split("\n").map(e => e.trim()).filter(Boolean);
  }
  if (!emails.includes(email)) {
    fs.appendFileSync(file, email + "\n");
  }
  res.redirect("/dashboard");
});

app.post("/dashboard/delete", requireLogin, (req, res) => {
  const { email, list } = req.body;
  const file = getListFile(list);
  if (!file || !email) return res.redirect("/dashboard");
  if (!fs.existsSync(file)) return res.redirect("/dashboard");
  let emails = fs.readFileSync(file, "utf-8").split("\n").map(e => e.trim()).filter(Boolean);
  emails = emails.filter(e => e !== email);
  fs.writeFileSync(file, emails.join("\n") + (emails.length ? "\n" : ""));
  res.redirect("/dashboard");
});

app.post("/dashboard/bulkadd", requireLogin, (req, res) => {
  const { emails, list } = req.body;
  const file = getListFile(list);
  if (!file || !emails) return res.redirect("/dashboard");
  let current = [];
  if (fs.existsSync(file)) {
    current = fs.readFileSync(file, "utf-8").split("\n").map(e => e.trim()).filter(Boolean);
  }
  const toAdd = parseBulkEmails(emails);
  const newEmails = toAdd.filter(e => validator.isEmail(e) && !current.includes(e));
  if (newEmails.length) {
    fs.appendFileSync(file, newEmails.join("\n") + "\n");
  }
  res.redirect("/dashboard");
});

app.post("/dashboard/bulkdelete", requireLogin, (req, res) => {
  const { emails, list } = req.body;
  const file = getListFile(list);
  if (!file || !emails) return res.redirect("/dashboard");
  if (!fs.existsSync(file)) return res.redirect("/dashboard");
  let current = fs.readFileSync(file, "utf-8").split("\n").map(e => e.trim()).filter(Boolean);
  const toDelete = parseBulkEmails(emails);
  current = current.filter(e => !toDelete.includes(e));
  fs.writeFileSync(file, current.join("\n") + (current.length ? "\n" : ""));
  res.redirect("/dashboard");
});

app.get("/api/hello", (req, res) => {
  res.json({
    message:
      "Hello! 👋 Welcome to Sadashiv's Custom Node.js API. We're thrilled to have you here. Feel free to explore and interact with the API!",
  });
});

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

app.post("/api/send-to-email", async (req, res) => {
  const { email } = req.body;
  if (!email || !validator.isEmail(email)) {
    fs.appendFileSync("failed_emails.txt", (email || '') + "\n");
    return res.status(400).json({ error: "Invalid email address." });
  }
  try {
    const quote = await sendMotivationalEmail("Personal", email);
    res.json({ status: `✅ Motivation sent to ${email}!`, quote });
  } catch (error) {
    if (isAddressNotFoundError(error)) {
      removeEmailFromFile(email, "emails.txt");
      fs.appendFileSync("failed_emails.txt", email + "\n");
      console.error(`Moved undeliverable email to failed_emails.txt: ${email}`);
    } else {
      fs.appendFileSync("failed_emails.txt", email + "\n");
      console.error("❌ Error sending personal email:", error.message);
    }
    res.status(500).json({ error: "Failed to send email." });
  }
});

app.post("/api/subscribe", (req, res) => {
  const { email } = req.body;
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: "Invalid email." });
  }
  try {
    if (!fs.existsSync("emails.txt")) {
      fs.writeFileSync("emails.txt", "");
    }
    const emails = fs.readFileSync("emails.txt", "utf-8")
      .split("\n")
      .map(e => e.trim())
      .filter(Boolean);

    if (emails.includes(email)) {
      return res.json({ status: "⚠️ Email already subscribed." });
    }

    fs.appendFileSync("emails.txt", email + "\n");
    res.json({ status: "✅ Subscribed successfully." });
  } catch (err) {
    console.error("❌ Subscribe error:", err.message);
    res.status(500).json({ error: "Failed to subscribe." });
  }
});

app.post("/api/unsubscribe", (req, res) => {
  const { email } = req.body;
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: "Invalid email." });
  }
  try {
    if (!fs.existsSync("emails.txt")) {
      return res.json({ status: "⚠️ No subscribers yet." });
    }
    let emails = fs.readFileSync("emails.txt", "utf-8")
      .split("\n")
      .map(e => e.trim())
      .filter(Boolean);

    if (!emails.includes(email)) {
      return res.json({ status: "⚠️ Email not found in subscription list." });
    }

    emails = emails.filter(e => e !== email);
    fs.writeFileSync("emails.txt", emails.join("\n") + (emails.length ? "\n" : ""));

    fs.appendFileSync("unsubscribed.txt", email + "\n");

    res.json({ status: "✅ Unsubscribed successfully." });
  } catch (err) {
    console.error("❌ Unsubscribe error:", err.message);
    res.status(500).json({ error: "Failed to unsubscribe." });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Server setup
if (ENABLE_HTTPS) {
  const httpsOptions = {
    key: fs.readFileSync("/home/certs/privkey.pem"),
    cert: fs.readFileSync("/home/certs/fullchain.pem")
  };
  const httpServer = http.createServer(app);
  const httpsServer = https.createServer(httpsOptions, app);
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP server running at http://94.136.188.46:${PORT}`);
  });
  httpsServer.listen(443, "0.0.0.0", () => {
    console.log(`HTTPS server running at https://94.136.188.46:443`);
  });
} else {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API running at http://94.136.188.46:${PORT}`);
  });
}