const nodemailer = require("nodemailer");
const Notificacion = require("../models/Notificacion");

const MAX_INTENTOS = 3;
// Bloqueo temporal de lanzamiento: se habilitará únicamente al aprobar la versión final.
const EMAIL_ROLLOUT_ENABLED = false;
let procesando = false;
let temporizador = null;

function emailHabilitado() {
  return EMAIL_ROLLOUT_ENABLED && process.env.EMAIL_ENABLED === "true";
}

function crearTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function encolarAsignacion(caso) {
  if (!emailHabilitado()) return null;
  return Notificacion.findOneAndUpdate(
    { caso: caso._id, tipo: "ASIGNACION" },
    {
      $setOnInsert: {
        destinatario: { nombre: caso.inspector.nombre, correo: caso.inspector.correo },
        asunto: `Nuevo caso asignado: ${caso.numeroCaso}`,
        contenido: `Se le asignó el caso ${caso.numeroCaso} de ${caso.nombrePatrono}.`,
        estado: "pendiente",
        proximoIntento: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function enviarDocumento(notificacion, transporter = crearTransporter()) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: notificacion.destinatario.correo,
      subject: notificacion.asunto,
      text: notificacion.contenido,
    });
    notificacion.estado = "enviada";
    notificacion.enviadaEn = new Date();
    notificacion.ultimoError = "";
  } catch (error) {
    notificacion.estado = "fallida";
    notificacion.ultimoError = String(error.message || error).slice(0, 500);
    const minutos = 5 * (2 ** Math.max(notificacion.intentos - 1, 0));
    notificacion.proximoIntento = new Date(Date.now() + minutos * 60 * 1000);
  }
  await notificacion.save();
  return notificacion;
}

async function reclamarSiguiente() {
  const bloqueoExpirado = new Date(Date.now() - 5 * 60 * 1000);
  return Notificacion.findOneAndUpdate(
    {
      intentos: { $lt: MAX_INTENTOS },
      $or: [
        { estado: { $in: ["pendiente", "fallida"] }, proximoIntento: { $lte: new Date() } },
        { estado: "procesando", updatedAt: { $lt: bloqueoExpirado } },
      ],
    },
    { $set: { estado: "procesando" }, $inc: { intentos: 1 } },
    { new: true, sort: { proximoIntento: 1 } },
  );
}

async function procesarPendientes() {
  if (!emailHabilitado() || procesando) return 0;
  procesando = true;
  let procesadas = 0;
  try {
    let notificacion = await reclamarSiguiente();
    while (notificacion) {
      await enviarDocumento(notificacion);
      procesadas += 1;
      notificacion = await reclamarSiguiente();
    }
    return procesadas;
  } finally {
    procesando = false;
  }
}

function programarProcesamiento() {
  setImmediate(() => procesarPendientes().catch((error) => {
    console.error("Error al procesar notificaciones:", error.message);
  }));
}

function iniciarProcesadorNotificaciones() {
  if (!emailHabilitado() || temporizador) return () => {};
  programarProcesamiento();
  temporizador = setInterval(programarProcesamiento, 60 * 1000);
  temporizador.unref();
  return () => {
    clearInterval(temporizador);
    temporizador = null;
  };
}

module.exports = {
  MAX_INTENTOS,
  EMAIL_ROLLOUT_ENABLED,
  emailHabilitado,
  encolarAsignacion,
  enviarDocumento,
  procesarPendientes,
  programarProcesamiento,
  iniciarProcesadorNotificaciones,
};
