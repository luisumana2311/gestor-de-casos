const mongoose = require("mongoose");

const ZONAS_VALIDAS = ["Pavas", "Montes de Oca", "Tibás", "San Sebastián", "Uruca"];
const TIPOS_VALIDOS = ["Inscripción Patronal", "Reanudación Patronal"];
const ESTADOS_VALIDOS = ["Pendiente", "Resuelto", "Sectorizado"];
const VIA_ADMIN_VALIDAS = ["Procedente", "Improcedente", ""]; // "" permitido al crear

const CasoSchema = new mongoose.Schema({
  numeroCaso: { 
    type: String, 
    required: true, 
    unique: true,          // 🔒 No se puede repetir
    trim: true 
  },

  nombrePatrono: { type: String, required: true, trim: true },

  tipoInvestigacion: { 
    type: String, 
    required: true,
    enum: TIPOS_VALIDOS     // 🔒 Valores permitidos únicamente
  },

  zona: { 
    type: String, 
    required: true,
    enum: ZONAS_VALIDAS     // 🔒 Solo zonas válidas
  },

  inspector: {
    nombre: { type: String, required: true },
    correo: { type: String, required: true }
  },

  estado: { 
    type: String, 
    default: "Pendiente",
    enum: ESTADOS_VALIDOS    // 🔒 Solo estados válidos
  },

  viaAdministrativa: { 
    type: String,
    default: "",
    enum: VIA_ADMIN_VALIDAS   // 🔒 Solo opciones válidas previamente
  },

  numeroResolucion: { type: String, default: "" },

  fechaAsignado: { type: Date, required: true },
  fechaResuelto: { type: Date, default: null },

  diasHabiles: { type: Number, default: null },

  notas: [
    {
      texto: { type: String, required: true, trim: true, maxlength: 1000 },
      fecha: { type: Date, default: Date.now }
    }
  ],

  fechaCreacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Caso", CasoSchema);
