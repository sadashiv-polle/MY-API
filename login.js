const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "password123") {
    // Redirect to dashboard
    res.redirect("/dashboard");
  } else {
    res.redirect("/login?error=Invalid credentials");
  }
});
