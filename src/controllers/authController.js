const Usuario = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const ROLES_VALIDOS = ["admin", "supervisor", "inspector"];

exports.registrarUsuario = async (req, res) => {
  try {
    const nombre = req.body.nombre?.trim();
    const correo = req.body.correo?.trim().toLowerCase();
    const { password, rol = "inspector" } = req.body;

    if (!nombre || !correo || !password) {
      return res.status(400).json({ mensaje: "Todos los campos son obligatorios." });
    }

    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ mensaje: "El rol indicado no es válido." });
    }

    if (password.length < 10) {
      return res.status(400).json({ mensaje: "La contraseña debe tener al menos 10 caracteres." });
    }

    const existe = await Usuario.findOne({ correo });
    if (existe) {
      return res.status(400).json({ mensaje: "El usuario ya existe." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const nuevoUsuario = new Usuario({
      nombre,
      correo,
      password: passwordHash,
      rol
    });

    await nuevoUsuario.save();

    res.status(201).json({ mensaje: "Usuario creado correctamente." });
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    res.status(500).json({ mensaje: "Error al registrar usuario." });
  }
};

exports.login = async (req, res) => {
  try {
    const correo = req.body.correo?.trim().toLowerCase();
    const { password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ mensaje: "Correo y contraseña son obligatorios." });
    }

    const usuario = await Usuario.findOne({ correo });
    if (!usuario) {
      return res.status(400).json({ mensaje: "Credenciales inválidas." });
    }

    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) {
      return res.status(400).json({ mensaje: "Credenciales inválidas." });
    }

    const token = jwt.sign(
      {
        id: usuario._id,
        rol: usuario.rol,
        nombre: usuario.nombre,
        correo: usuario.correo
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      mensaje: "Inicio de sesión exitoso.",
      token,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol
      }
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    res.status(500).json({ mensaje: "Error al iniciar sesión." });
  }
};
