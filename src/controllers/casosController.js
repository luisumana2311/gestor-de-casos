const Caso = require("../models/Caso");
const inspectores = require("../config/inspectores");
const calcularDiasHabiles = require("../utils/calcularDiasHabiles");
const feriados = require("../utils/feriados");
const nodemailer = require("nodemailer");

// -----------------------------
// VALIDACIONES
// -----------------------------

const zonasValidas = ["Pavas", "Montes de Oca", "Tibás", "San Sebastián", "Uruca"];
const tiposValidos = ["Inscripción Patronal", "Reanudación Patronal"];

// -----------------------------
// TRANSPORT EMAIL (MODO PRUEBA)
// -----------------------------

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -----------------------------
// OBTENER TODOS LOS CASOS
// -----------------------------

const obtenerCasos = async (req, res) => {
  try {
    const casos = await Caso.find().sort({ fechaCreacion: -1 });
    res.json(casos);
  } catch (error) {
    console.error("Error al obtener casos:", error);
    res.status(500).json({ error: "Error al obtener los casos." });
  }
};

// -----------------------------
// OBTENER CASO POR ID
// -----------------------------

const obtenerCasoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const caso = await Caso.findById(id);

    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });

    res.json(caso);
  } catch (error) {
    console.error("Error al obtener caso:", error);
    res.status(500).json({ error: "Error al obtener el caso." });
  }
};

// -----------------------------
// CREAR CASO
// -----------------------------

const crearCaso = async (req, res) => {
  try {
    const {
      numeroCaso,
      nombrePatrono,
      tipoInvestigacion,
      zona,
      inspector
    } = req.body;

    if (!numeroCaso || !nombrePatrono || !tipoInvestigacion || !zona || !inspector) {
      return res.status(400).json({ error: "Todos los campos obligatorios deben completarse." });
    }

    // Validación de zona
    if (!zonasValidas.includes(zona)) {
      return res.status(400).json({
        error: `Zona inválida. Debe ser una de: ${zonasValidas.join(", ")}`
      });
    }

    // Validación de tipo de investigación
    if (!tiposValidos.includes(tipoInvestigacion)) {
      return res.status(400).json({
        error: `Tipo de investigación inválido. Debe ser uno de: ${tiposValidos.join(", ")}`
      });
    }

    // Validación de inspector
    const correoInspector = inspectores[inspector];
    if (!correoInspector) {
      return res.status(400).json({
        error: "Inspector no válido o no existente en la lista oficial"
      });
    }

    const nuevoCaso = new Caso({
      numeroCaso,
      nombrePatrono,
      tipoInvestigacion,
      zona,
      inspector: {
        nombre: inspector,
        correo: correoInspector
      },
      fechaAsignado: new Date(),
      estado: "Pendiente"
    });

    await nuevoCaso.save();

    // -----------------------------
    // CORREO (SOLO PRUEBA - NO ENVÍA)
    // -----------------------------
    console.log("📩 [MODO PRUEBA] Se habría enviado correo a:", correoInspector);
    console.log(`
Asunto: Caso asignado

Se le ha asignado la ${tipoInvestigacion} del patrono ${nombrePatrono},
con número de solicitud de estudio ${numeroCaso}.

Atentamente,
Sistema Gestor de Casos – CCSS
Mensaje generado automáticamente. No responder.
    `);

    res.status(201).json(nuevoCaso);

  } catch (error) {
    console.error("Error al crear caso:", error);
    res.status(500).json({ error: "Error al crear el caso." });
  }
};

// -----------------------------
// EDITAR (SOLO CAMPOS PERMITIDOS)
// -----------------------------

const editarCaso = async (req, res) => {
  try {
    const { id } = req.params;
    const caso = await Caso.findById(id);

    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });

    const camposEditables = ["viaAdministrativa", "numeroResolucion"];

    Object.keys(req.body).forEach(campo => {
      if (camposEditables.includes(campo)) {
        caso[campo] = req.body[campo];
      }
    });

    await caso.save();
    res.json(caso);

  } catch (error) {
    console.error("Error al editar:", error);
    res.status(500).json({ error: "Error al editar el caso" });
  }
};

// -----------------------------
// CAMBIAR ESTADO
// -----------------------------

const cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const caso = await Caso.findById(id);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });

    caso.estado = estado;

    if (estado === "Resuelto") {
      const hoy = new Date();
      caso.fechaResuelto = hoy;
      caso.diasHabiles = calcularDiasHabiles(caso.fechaAsignado, hoy, feriados);
    }

    await caso.save();
    res.json(caso);

  } catch (error) {
    console.error("Error estado:", error);
    res.status(500).json({ error: "Error al cambiar el estado" });
  }
};

// -----------------------------
// AGREGAR NOTA
// -----------------------------

const agregarNota = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;

    const caso = await Caso.findById(id);
    if (!caso) return res.status(404).json({ error: "Caso no encontrado" });

    caso.notas.push({ texto });
    await caso.save();

    res.json(caso);

  } catch (error) {
    console.error("Error nota:", error);
    res.status(500).json({ error: "Error al agregar nota" });
  }
};
const eliminarCaso = async (req, res) => {
  try {
    const { id } = req.params;

    const caso = await Caso.findById(id);
    if (!caso) {
      return res.status(404).json({ error: "Caso no encontrado" });
    }

    await Caso.findByIdAndDelete(id);

    res.json({ mensaje: "Caso eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar caso:", error);
    res.status(500).json({ error: "Error al eliminar el caso" });
  }
};
const obtenerCasosPaginados = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await Caso.countDocuments();
    const casos = await Caso.find()
      .sort({ fechaCreacion: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      casos,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Error en paginación:", error);
    res.status(500).json({ error: "Error al obtener casos paginados." });
  }
};

// -----------------------------
// EXPORTAR
// -----------------------------

module.exports = {
  obtenerCasos,
  obtenerCasoPorId,
  crearCaso,
  editarCaso,
  cambiarEstado,
  agregarNota,
  eliminarCaso,
  obtenerCasosPaginados,
};
