const mongoose = require("mongoose");
const Notificacion = require("../models/Notificacion");
const { emailHabilitado, programarProcesamiento } = require("../services/notificacionesService");

function filtroVisibilidad(req) {
  return req.usuario.rol === "inspector"
    ? { "destinatario.correo": req.usuario.correo.toLowerCase() }
    : {};
}

async function listarNotificaciones(req, res) {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = filtroVisibilidad(req);
    const [total, notificaciones, estados] = await Promise.all([
      Notificacion.countDocuments(filter),
      Notificacion.find(filter)
        .populate("caso", "numeroCaso nombrePatrono fechaAsignado estado")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notificacion.aggregate([
        { $match: filter },
        { $group: { _id: "$estado", total: { $sum: 1 } } },
      ]),
    ]);
    const porEstado = Object.fromEntries(estados.map((item) => [item._id, item.total]));
    res.json({
      notificaciones,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      resumen: {
        pendientes: (porEstado.pendiente || 0) + (porEstado.procesando || 0),
        enviadas: porEstado.enviada || 0,
        fallidas: porEstado.fallida || 0,
      },
      emailHabilitado: emailHabilitado(),
    });
  } catch (error) {
    console.error("Error al listar notificaciones:", error);
    res.status(500).json({ mensaje: "No se pudieron cargar las notificaciones." });
  }
}

async function reintentarNotificacion(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ mensaje: "Identificador de notificación inválido." });
    }
    if (!emailHabilitado()) {
      return res.status(503).json({ mensaje: "El envío de correos está deshabilitado." });
    }
    const existente = await Notificacion.findById(req.params.id);
    if (!existente) return res.status(404).json({ mensaje: "Notificación no encontrada." });
    if (existente.estado !== "fallida") {
      return res.status(409).json({ mensaje: "Solo las notificaciones fallidas pueden reintentarse." });
    }
    existente.estado = "pendiente";
    existente.intentos = 0;
    existente.proximoIntento = new Date();
    existente.ultimoError = "";
    const notificacion = await existente.save();
    programarProcesamiento();
    res.json({ mensaje: "Notificación programada para reintento.", notificacion });
  } catch (error) {
    console.error("Error al reintentar notificación:", error);
    res.status(500).json({ mensaje: "No se pudo reintentar la notificación." });
  }
}

module.exports = { listarNotificaciones, reintentarNotificacion };
