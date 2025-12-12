// index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// routes
app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});