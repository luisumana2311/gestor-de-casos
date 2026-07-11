const express = require("express");
const router = express.Router();

const {
  login,
  registrarUsuario,
  listarUsuarios,
  cambiarEstadoUsuario,
  eliminarUsuario,
} = require("../controllers/authController");
const verificarToken = require("../config/middleware/authMiddleware");
const { permitirRoles } = require("../config/middleware/authMiddleware");
const { verificarCuentaActiva } = require("../config/middleware/authMiddleware");

// Público
router.post("/login", login);

// Protegido: solo con token
router.post("/register", verificarToken, verificarCuentaActiva, permitirRoles("admin"), registrarUsuario);
router.get("/users", verificarToken, verificarCuentaActiva, permitirRoles("admin"), listarUsuarios);
router.patch("/users/:id/status", verificarToken, verificarCuentaActiva, permitirRoles("admin"), cambiarEstadoUsuario);
router.delete("/users/:id", verificarToken, verificarCuentaActiva, permitirRoles("admin"), eliminarUsuario);

module.exports = router;
