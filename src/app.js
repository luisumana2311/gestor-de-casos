const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());

// ----------------------------
// SERVIR FRONTEND ESTÁTICO
// ----------------------------
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// ----------------------------
// RUTAS DE API
// ----------------------------

// Casos
const casosRoutes = require("./routes/casosRoutes");
app.use("/casos", casosRoutes);

// Inspectores
const inspectoresRoutes = require("./routes/inspectoresRoutes");
app.use("/inspectores", inspectoresRoutes);

// ----------------------------

module.exports = app;
const authRoutes = require("./routes/authRoutes");

app.use("/auth", authRoutes);
