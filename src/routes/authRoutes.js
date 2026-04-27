const express = require("express");
const router = express.Router();

const { login, registrarUsuario } = require("../controllers/authController");
const verificarToken = require("../middlewares/authMiddleware");

// Público
router.post("/login", login);

// Protegido: solo con token
router.post("/register", verificarToken, registrarUsuario);

module.exports = router;