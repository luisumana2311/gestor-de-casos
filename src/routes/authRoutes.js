const express = require("express");
const router = express.Router();

const { login, registrarUsuario } = require("../controllers/authController");
const verificarToken = require("../config/middleware/authMiddleware");
const { permitirRoles } = require("../config/middleware/authMiddleware");

// Público
router.post("/login", login);

// Protegido: solo con token
router.post("/register", verificarToken, permitirRoles("admin"), registrarUsuario);

module.exports = router;
