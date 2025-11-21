require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// CORS para Render
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
const conectarDB = require("./src/config/db");
conectarDB();

// Servir carpeta public (Frontend)
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Rutas API
app.use("/auth", require("./src/routes/authRoutes"));
app.use("/casos", require("./src/routes/casosRoutes"));
app.use("/inspectores", require("./src/routes/inspectoresRoutes"));

// Puerto dinámico de Render
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

