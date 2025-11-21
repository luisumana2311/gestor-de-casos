const Usuario = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.registrarUsuario = async (req, res) => {
  try {
    const { nombre, correo, password, rol } = req.body;

    // Verifica si ya existe
    const existe = await Usuario.findOne({ correo });
    if (existe) {
      return res.status(400).json({ mensaje: "El usuario ya existe." });
    }

    // Hashear contraseña
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const nuevoUsuario = new Usuario({
      nombre,
      correo,
      password: passwordHash,
      rol
    });

    await nuevoUsuario.save();

    res.json({ mensaje: "Usuario creado correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al registrar usuario." });
  }
};


exports.login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    const usuario = await Usuario.findOne({ correo });
    if (!usuario) {
      return res.status(400).json({ mensaje: "Credenciales inválidas." });
    }

    // Comparar contraseña
    const valido = bcrypt.compareSync(password, usuario.password);
    if (!valido) {
      return res.status(400).json({ mensaje: "Contraseña incorrecta." });
    }

    // Crear token
    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      mensaje: "Inicio de sesión exitoso.",
      token,
      usuario
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al iniciar sesión." });
  }
};
