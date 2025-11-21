const Caso = require("../models/Caso");
const inspectores = require("../config/inspectores");
const calcularDiasHabiles = require("../utils/calcularDiasHabiles");
const feriados = require("../utils/feriados");
const nodemailer = require("nodemailer");

// ======================================================
// CONFIGURACIÓN DE CORREO
// ======================================================

// Cambiar a false para enviar correos reales
const TEST_MODE = false;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ======================================================
// VALIDACIONES
// ======================================================

const zonasValidas = ["Pavas", "Montes de Oca", "Tibás", "San Sebastián", "Uruca"];
const tiposValidos = ["Inscripción Patronal", "Reanudación Patronal"];

// ======================================================
// OBTENER TODOS LOS CASOS
// ======================================================

const obtenerCasos = async (req, res) => {
  try {
    const casos = await Caso.find().sort({ fechaCreacion: -1 });
    res.json(casos);
  } catch (error) {
    console.error("Error al obtener casos:", error);
    res.status(500).json({ error: "Error al obtener los casos." });
  }
};

// ======================================================
// OBTENER CASO POR ID
// ======================================================

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

// ======================================================
// CREAR CASO + ENVÍO DE CORREO
// ======================================================

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

    if (!zonasValidas.includes(zona)) {
      return res.status(400).json({
        error: `Zona inválida. Debe ser una de: ${zonasValidas.join(", ")}`
      });
    }

    if (!tiposValidos.includes(tipoInvestigacion)) {
      return res.status(400).json({
        error: `Tipo de investigación inválido. Debe ser una de: ${tiposValidos.join(", ")}`
      });
    }

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

    // ======================================================
    // ENVÍO DE CORREO
    // ======================================================

    const mensajeCorreo = `
Se le ha asignado una nueva investigación.

📌 Tipo: ${tipoInvestigacion}
📌 Patrono: ${nombrePatrono}
📌 Número de caso: ${numeroCaso}

Atentamente,
Sistema Gestor de Casos – CCSS
Mensaje generado automáticamente. No responder.
`;

    if (TEST_MODE) {
      console.log("📩 [MODO PRUEBA] CORREO NO ENVIADO");
      console.log("Destinatario:", correoInspector);
      console.log(mensajeCorreo);
    } else {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: correoInspector,
        subject: "Nuevo caso asignado",
        text: mensajeCorreo
      });

      console.log("📨 Correo enviado a:", correoInspector);
    }

    res.status(201).json(nuevoCaso);

  } catch (error) {
    console.error("Error al crear caso:", error);
    res.status(500).json({ error: "Error al crear el caso." });
  }
};

// ======================================================
// EDITAR CAMPOS PERMITIDOS
// ======================================================

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

// ======================================================
// CAMBIAR ESTADO
// ======================================================

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

// ======================================================
// AGREGAR NOTA
// ======================================================

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

// ======================================================
// ELIMINAR CASO
// ======================================================

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

// ======================================================
// PAGINACIÓN
// ======================================================

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

// ======================================================
// EXPORTAR
// ======================================================

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
