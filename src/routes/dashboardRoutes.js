const express = require("express");
const verificarToken = require("../config/middleware/authMiddleware");
const { verificarCuentaActiva } = require("../config/middleware/authMiddleware");
const { obtenerDashboard } = require("../controllers/dashboardController");

const router = express.Router();
router.get("/", verificarToken, verificarCuentaActiva, obtenerDashboard);
module.exports = router;
