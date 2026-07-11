const Usuario = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

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

    if (usuario.activo === false) {
      return res.status(403).json({ mensaje: "Esta cuenta se encuentra inactiva. Contacte al administrador." });
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

exports.listarUsuarios = async (_req, res) => {
  try {
    const usuarios = await Usuario.find()
      .select("nombre correo rol activo createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    res.json(usuarios.map((usuario) => ({ ...usuario, activo: usuario.activo !== false })));
  } catch (error) {
    console.error("Error al listar usuarios:", error);
    res.status(500).json({ mensaje: "No se pudieron cargar los usuarios." });
  }
};

exports.cambiarEstadoUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (!mongoose.isValidObjectId(id) || typeof activo !== "boolean") {
      return res.status(400).json({ mensaje: "Solicitud de estado inválida." });
    }

    if (String(req.usuario.id) === id) {
      return res.status(400).json({ mensaje: "No puede cambiar el estado de su propia cuenta." });
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) return res.status(404).json({ mensaje: "Usuario no encontrado." });

    if (!activo && usuario.rol === "admin") {
      const administradoresActivos = await Usuario.countDocuments({ rol: "admin", activo: { $ne: false } });
      if (administradoresActivos <= 1) {
        return res.status(409).json({ mensaje: "No se puede desactivar el último administrador activo." });
      }
    }

    usuario.activo = activo;
    await usuario.save();
    res.json({ mensaje: activo ? "Usuario activado correctamente." : "Usuario desactivado correctamente." });
  } catch (error) {
    console.error("Error al cambiar estado de usuario:", error);
    res.status(500).json({ mensaje: "No se pudo actualizar el usuario." });
  }
};

exports.eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ mensaje: "Identificador inválido." });
    if (String(req.usuario.id) === id) return res.status(400).json({ mensaje: "No puede eliminar su propia cuenta." });

    const usuario = await Usuario.findById(id);
    if (!usuario) return res.status(404).json({ mensaje: "Usuario no encontrado." });

    if (usuario.rol === "admin") {
      const administradores = await Usuario.countDocuments({ rol: "admin" });
      if (administradores <= 1) return res.status(409).json({ mensaje: "No se puede eliminar el último administrador." });
    }

    await usuario.deleteOne();
    res.json({ mensaje: "Usuario eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ mensaje: "No se pudo eliminar el usuario." });
  }
};
