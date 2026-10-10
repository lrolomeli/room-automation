const { Router } = require("express");
const router = Router();

// 🔑 login
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // ⚠️ replace later with DB + hashed password
  if (username === "admin" && password === "1234") {
    req.session.user = { username };
    return res.json({ success: true });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

// 🚪 logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// 👤 check session
router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ user: null });
  }
  res.json({ user: req.session.user });
});

module.exports = router;