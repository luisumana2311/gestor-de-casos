const path = require("path");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const app = express();

// Render terminates HTTPS at one reverse-proxy hop and forwards the client IP.
// Trust exactly that hop so rate limiting keys requests by the real client.
app.set("trust proxy", 1);

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origen no permitido por CORS"));
  },
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { mensaje: "Demasiados intentos. Intente nuevamente más tarde." },
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "login.html"));
});

app.use("/auth/login", loginLimiter);
app.use("/auth", require("./routes/authRoutes"));
app.use("/casos", require("./routes/casosRoutes"));
app.use("/inspectores", require("./routes/inspectoresRoutes"));
app.use("/dashboard", require("./routes/dashboardRoutes"));

app.use((_req, res) => {
  res.status(404).json({ mensaje: "Recurso no encontrado." });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ mensaje: "Error interno del servidor." });
});

module.exports = app;
