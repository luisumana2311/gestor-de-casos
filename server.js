require("dotenv").config();

const express = require("express");
const path = require("path");
const app = express();

const conectarDB = require("./src/config/db");

conectarDB();

app.use(express.json());

// Servir carpeta public
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Rutas API
const authRoutes = require("./src/routes/authRoutes");
const casosRoutes = require("./src/routes/casosRoutes");
const inspectoresRoutes = require("./src/routes/inspectoresRoutes");

app.use("/auth", authRoutes);
app.use("/casos", casosRoutes);
app.use("/inspectores", inspectoresRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
