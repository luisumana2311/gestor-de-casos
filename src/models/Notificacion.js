const mongoose = require("mongoose");

const NotificacionSchema = new mongoose.Schema({
  caso: { type: mongoose.Schema.Types.ObjectId, ref: "Caso", required: true, index: true },
  tipo: { type: String, enum: ["ASIGNACION"], required: true },
  destinatario: {
    nombre: { type: String, required: true },
    correo: { type: String, required: true, lowercase: true, trim: true },
  },
  asunto: { type: String, required: true },
  contenido: { type: String, required: true },
  estado: {
    type: String,
    enum: ["pendiente", "procesando", "enviada", "fallida"],
    default: "pendiente",
    index: true,
  },
  intentos: { type: Number, default: 0 },
  ultimoError: { type: String, default: "" },
  proximoIntento: { type: Date, default: Date.now, index: true },
  enviadaEn: { type: Date, default: null },
}, { timestamps: true });

NotificacionSchema.index({ caso: 1, tipo: 1 }, { unique: true });
NotificacionSchema.index({ estado: 1, proximoIntento: 1 });
NotificacionSchema.index({ "destinatario.correo": 1, createdAt: -1 });

module.exports = mongoose.model("Notificacion", NotificacionSchema);
