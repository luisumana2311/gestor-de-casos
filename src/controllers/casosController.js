const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Caso = require("../models/Caso");
const Usuario = require("../models/userModel");
const calcularDiasHabiles = require("../utils/calcularDiasHabiles");
const feriados = require("../utils/feriados");

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true";
const zonasValidas = ["Pavas", "Montes de Oca", "Tibás", "San Sebastián", "Uruca"];
const tiposValidos = ["Inscripción Patronal", "Reanudación Patronal"];
const estadosValidos = ["Pendiente", "Resuelto", "Sectorizado"];
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function validarId(id, res) {
  if (mongoose.isValidObjectId(id)) return true;
  res.status(400).json({ error: "Identificador de caso inválido." });
  return false;
}

function actor(req) {
  return {
    usuarioId: req.usuario.id,
    nombre: req.usuario.nombre,
    correo: req.usuario.correo,
    rol: req.usuario.rol,
  };
}

function filtroVisibilidad(req) {
  if (req.usuario.rol !== "inspector") return {};
  return {
    $or: [
      { "inspector.usuarioId": req.usuario.id },
      { "inspector.correo": req.usuario.correo },
    ],
  };
}

async function buscarCasoVisible(req, id) {
  return Caso.findOne({ _id: id, ...filtroVisibilidad(req) });
}

function registrarEvento(caso, req, tipo, descripcion, cambios = {}) {
  caso.historial.push({ tipo, descripcion, usuario: actor(req), cambios });
}

async function obtenerCasoPorId(req, res) {
  try {
    if (!validarId(req.params.id, res)) return;
    const caso = await buscarCasoVisible(req, req.params.id);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado." });
    res.json(caso);
  } catch (error) {
    console.error("Error al obtener caso:", error);
    res.status(500).json({ error: "Error al obtener el caso." });
  }
}

async function crearCaso(req, res) {
  try {
    const { numeroCaso, nombrePatrono, tipoInvestigacion, zona, inspector, fechaAsignado } = req.body;
    if (!numeroCaso || !nombrePatrono || !tipoInvestigacion || !zona || !inspector) {
      return res.status(400).json({ error: "Todos los campos obligatorios deben completarse." });
    }
    if (!zonasValidas.includes(zona) || !tiposValidos.includes(tipoInvestigacion)) {
      return res.status(400).json({ error: "La zona o el tipo de investigación no es válido." });
    }
    if (!mongoose.isValidObjectId(inspector)) {
      return res.status(400).json({ error: "Debe seleccionar un inspector válido." });
    }

    const usuarioInspector = await Usuario.findOne({
      _id: inspector,
      rol: "inspector",
      activo: { $ne: false },
    });
    if (!usuarioInspector) return res.status(400).json({ error: "El inspector no existe o está inactivo." });

    const fecha = fechaAsignado ? new Date(`${fechaAsignado}T12:00:00`) : new Date();
    if (Number.isNaN(fecha.getTime())) return res.status(400).json({ error: "Fecha de asignación inválida." });

    const nuevoCaso = new Caso({
      numeroCaso: numeroCaso.trim(),
      nombrePatrono: nombrePatrono.trim(),
      tipoInvestigacion,
      zona,
      inspector: { usuarioId: usuarioInspector._id, nombre: usuarioInspector.nombre, correo: usuarioInspector.correo },
      fechaAsignado: fecha,
      estado: "Pendiente",
    });
    registrarEvento(nuevoCaso, req, "CREACION", "Caso creado y asignado", {
      inspector: { nombre: usuarioInspector.nombre, correo: usuarioInspector.correo },
    });
    await nuevoCaso.save();

    if (EMAIL_ENABLED) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: usuarioInspector.correo,
        subject: `Nuevo caso asignado: ${numeroCaso}`,
        text: `Se le asignó el caso ${numeroCaso} de ${nombrePatrono}.`,
      });
    }
    res.status(201).json(nuevoCaso);
  } catch (error) {
    console.error("Error al crear caso:", error);
    const status = error.code === 11000 ? 409 : 500;
    res.status(status).json({ error: error.code === 11000 ? "El número de caso ya existe." : "Error al crear el caso." });
  }
}

async function editarCaso(req, res) {
  try {
    if (!validarId(req.params.id, res)) return;
    const caso = await buscarCasoVisible(req, req.params.id);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado." });
    const cambios = {};
    for (const campo of ["viaAdministrativa", "numeroResolucion"]) {
      if (req.body[campo] !== undefined && caso[campo] !== req.body[campo]) {
        cambios[campo] = { anterior: caso[campo], nuevo: req.body[campo] };
        caso[campo] = req.body[campo];
      }
    }
    if (Object.keys(cambios).length) registrarEvento(caso, req, "EDICION", "Datos administrativos actualizados", cambios);
    await caso.save();
    res.json(caso);
  } catch (error) {
    console.error("Error al editar caso:", error);
    res.status(500).json({ error: "Error al editar el caso." });
  }
}

async function cambiarEstado(req, res) {
  try {
    if (!validarId(req.params.id, res)) return;
    if (!estadosValidos.includes(req.body.estado)) return res.status(400).json({ error: "Estado inválido." });
    const caso = await buscarCasoVisible(req, req.params.id);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado." });
    const anterior = caso.estado;
    caso.estado = req.body.estado;
    if (caso.estado === "Resuelto") {
      caso.fechaResuelto = new Date();
      caso.diasHabiles = calcularDiasHabiles(caso.fechaAsignado, caso.fechaResuelto, feriados);
    } else if (anterior === "Resuelto") {
      caso.fechaResuelto = null;
      caso.diasHabiles = null;
    }
    if (anterior !== caso.estado) registrarEvento(caso, req, "CAMBIO_ESTADO", `${anterior} → ${caso.estado}`, { estado: { anterior, nuevo: caso.estado } });
    await caso.save();
    res.json(caso);
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    res.status(500).json({ error: "Error al cambiar el estado." });
  }
}

async function agregarNota(req, res) {
  try {
    if (!validarId(req.params.id, res)) return;
    const texto = req.body.texto?.trim();
    if (!texto || texto.length > 1000) return res.status(400).json({ error: "La nota debe contener entre 1 y 1000 caracteres." });
    const caso = await buscarCasoVisible(req, req.params.id);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado." });
    caso.notas.push({ texto, autor: { usuarioId: req.usuario.id, nombre: req.usuario.nombre, rol: req.usuario.rol } });
    registrarEvento(caso, req, "NOTA", "Nueva nota agregada");
    await caso.save();
    res.json(caso);
  } catch (error) {
    console.error("Error al agregar nota:", error);
    res.status(500).json({ error: "Error al agregar la nota." });
  }
}

async function eliminarCaso(req, res) {
  try {
    if (!validarId(req.params.id, res)) return;
    const caso = await Caso.findByIdAndDelete(req.params.id);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado." });
    res.json({ mensaje: "Caso eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar caso:", error);
    res.status(500).json({ error: "Error al eliminar el caso." });
  }
}

async function obtenerCasosPaginados(req, res) {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = filtroVisibilidad(req);
    const [total, casos] = await Promise.all([
      Caso.countDocuments(filter),
      Caso.find(filter).sort({ fechaCreacion: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    res.json({ casos, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error en paginación:", error);
    res.status(500).json({ error: "Error al obtener los casos." });
  }
}

module.exports = {
  obtenerCasoPorId,
  crearCaso,
  editarCaso,
  cambiarEstado,
  agregarNota,
  eliminarCaso,
  obtenerCasosPaginados,
};
