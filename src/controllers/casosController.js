const mongoose = require("mongoose");
const Caso = require("../models/Caso");
const Usuario = require("../models/userModel");
const inspectoresPrecargados = require("../config/inspectores");
const calcularDiasHabiles = require("../utils/calcularDiasHabiles");
const feriados = require("../utils/feriados");
const { encolarAsignacion, programarProcesamiento } = require("../services/notificacionesService");

const zonasValidas = ["Pavas", "Montes de Oca", "Tibás", "San Sebastián", "Uruca"];
const tiposValidos = ["Inscripción Patronal", "Reanudación Patronal"];
const estadosValidos = ["Pendiente", "Resuelto", "Sectorizado"];
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

function escaparRegex(valor) {
  return String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function construirFiltroCasos(req) {
  const condiciones = [];
  const visibilidad = filtroVisibilidad(req);
  if (Object.keys(visibilidad).length) condiciones.push(visibilidad);

  const { q, estado, via, zona, inspector, desde, hasta, atrasados } = req.query;
  if (estado && !estadosValidos.includes(estado)) {
    return { error: "Estado de filtro inválido." };
  }
  if (via && !["Procedente", "Improcedente"].includes(via)) {
    return { error: "Vía administrativa de filtro inválida." };
  }
  if (zona && !zonasValidas.includes(zona)) {
    return { error: "Zona de filtro inválida." };
  }

  if (q?.trim()) {
    const expresion = new RegExp(escaparRegex(q.trim()), "i");
    condiciones.push({
      $or: [
        { numeroCaso: expresion },
        { nombrePatrono: expresion },
        { "inspector.nombre": expresion },
      ],
    });
  }
  if (estado) condiciones.push({ estado });
  if (via) condiciones.push({ viaAdministrativa: via });
  if (zona) condiciones.push({ zona });
  if (inspector?.trim()) condiciones.push({ "inspector.correo": inspector.trim().toLowerCase() });

  if (desde || hasta) {
    const rango = {};
    if (desde) {
      const fechaDesde = new Date(`${desde}T00:00:00.000Z`);
      if (Number.isNaN(fechaDesde.getTime())) return { error: "Fecha inicial inválida." };
      rango.$gte = fechaDesde;
    }
    if (hasta) {
      const fechaHasta = new Date(`${hasta}T23:59:59.999Z`);
      if (Number.isNaN(fechaHasta.getTime())) return { error: "Fecha final inválida." };
      rango.$lte = fechaHasta;
    }
    condiciones.push({ fechaAsignado: rango });
  }

  if (atrasados === "true") {
    const limiteAtraso = new Date();
    limiteAtraso.setUTCDate(limiteAtraso.getUTCDate() - 30);
    condiciones.push({ estado: { $ne: "Resuelto" }, fechaAsignado: { $lt: limiteAtraso } });
  }

  if (!condiciones.length) return { filter: {} };
  return { filter: condiciones.length === 1 ? condiciones[0] : { $and: condiciones } };
}

async function buscarCasoVisible(req, id) {
  return Caso.findOne({ _id: id, ...filtroVisibilidad(req) });
}

function registrarEvento(caso, req, tipo, descripcion, cambios = {}) {
  caso.historial.push({ tipo, descripcion, usuario: actor(req), cambios });
}

async function resolverInspector(valor) {
  const seleccion = String(valor || "");
  const idUsuario = seleccion.startsWith("user:") ? seleccion.slice(5) : seleccion;

  if (mongoose.isValidObjectId(idUsuario)) {
    const usuario = await Usuario.findOne({
      _id: idUsuario,
      rol: "inspector",
      activo: { $ne: false },
    });
    if (!usuario) return null;
    return { usuarioId: usuario._id, nombre: usuario.nombre, correo: usuario.correo };
  }

  if (!seleccion.startsWith("catalog:")) return null;
  const correoSeleccionado = seleccion.slice(8).trim().toLowerCase();
  const entrada = Object.entries(inspectoresPrecargados).find(
    ([, correo]) => correo.toLowerCase() === correoSeleccionado,
  );
  if (!entrada) return null;

  const [nombre, correo] = entrada;
  const usuario = await Usuario.findOne({
    correo: correoSeleccionado,
    rol: "inspector",
    activo: { $ne: false },
  });
  return { usuarioId: usuario?._id || null, nombre: usuario?.nombre || nombre, correo };
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
    const usuarioInspector = await resolverInspector(inspector);
    if (!usuarioInspector) return res.status(400).json({ error: "El inspector no existe o está inactivo." });

    const fecha = fechaAsignado ? new Date(`${fechaAsignado}T12:00:00`) : new Date();
    if (Number.isNaN(fecha.getTime())) return res.status(400).json({ error: "Fecha de asignación inválida." });

    const nuevoCaso = new Caso({
      numeroCaso: numeroCaso.trim(),
      nombrePatrono: nombrePatrono.trim(),
      tipoInvestigacion,
      zona,
      inspector: usuarioInspector,
      fechaAsignado: fecha,
      estado: "Pendiente",
    });
    registrarEvento(nuevoCaso, req, "CREACION", "Caso creado y asignado", {
      inspector: { nombre: usuarioInspector.nombre, correo: usuarioInspector.correo },
    });
    await nuevoCaso.save();

    try {
      const notificacion = await encolarAsignacion(nuevoCaso);
      if (notificacion) programarProcesamiento();
    } catch (error) {
      console.error("No se pudo encolar la notificación:", error.message);
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
    const resultadoFiltro = construirFiltroCasos(req);
    if (resultadoFiltro.error) return res.status(400).json({ error: resultadoFiltro.error });
    const filter = resultadoFiltro.filter;
    const visibilityFilter = filtroVisibilidad(req);
    const [total, casos, resumenEstados] = await Promise.all([
      Caso.countDocuments(filter),
      Caso.find(filter).sort({ fechaCreacion: -1 }).skip((page - 1) * limit).limit(limit),
      Caso.aggregate([
        { $match: visibilityFilter },
        { $group: { _id: "$estado", total: { $sum: 1 } } },
      ]),
    ]);
    const porEstado = Object.fromEntries(resumenEstados.map((item) => [item._id, item.total]));
    const resumen = {
      total: resumenEstados.reduce((suma, item) => suma + item.total, 0),
      pendientes: porEstado.Pendiente || 0,
      resueltos: porEstado.Resuelto || 0,
      sectorizados: porEstado.Sectorizado || 0,
    };
    res.json({ casos, total, page, totalPages: Math.ceil(total / limit), resumen });
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
