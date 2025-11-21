const express = require("express");
const router = express.Router();

const { registrarUsuario, login } = require("../controllers/authController");

// Solo vos usarás esta ruta para crear usuarios
router.post("/register", registrarUsuario);

router.post("/login", login);

module.exports = router;
