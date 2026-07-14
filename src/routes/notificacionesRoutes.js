const express = require("express");
const verificarToken = require("../config/middleware/authMiddleware");
const { permitirRoles, verificarCuentaActiva } = require("../config/middleware/authMiddleware");
const { listarNotificaciones, reintentarNotificacion } = require("../controllers/notificacionesController");

const router = express.Router();
router.use(verificarToken, verificarCuentaActiva);
router.get("/", listarNotificaciones);
router.post("/:id/reintentar", permitirRoles("admin", "supervisor"), reintentarNotificacion);

module.exports = router;
