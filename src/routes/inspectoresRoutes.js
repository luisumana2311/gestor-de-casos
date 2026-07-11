const express = require("express");
const Usuario = require("../models/userModel");
const inspectoresPrecargados = require("../config/inspectores");
const verificarToken = require("../config/middleware/authMiddleware");
const { verificarCuentaActiva } = require("../config/middleware/authMiddleware");

const router = express.Router();

router.get("/", verificarToken, verificarCuentaActiva, async (_req, res) => {
  try {
    const usuariosInspectores = await Usuario.find({ rol: "inspector", activo: { $ne: false } })
      .select("nombre correo")
      .sort({ nombre: 1 })
      .lean();

    const usuariosPorCorreo = new Map(
      usuariosInspectores.map((usuario) => [usuario.correo.toLowerCase(), usuario]),
    );
    const correosIncluidos = new Set();
    const inspectores = Object.entries(inspectoresPrecargados).map(([nombre, correo]) => {
      const correoNormalizado = correo.toLowerCase();
      const usuario = usuariosPorCorreo.get(correoNormalizado);
      correosIncluidos.add(correoNormalizado);
      return {
        assignmentKey: `catalog:${correo}`,
        _id: usuario?._id || null,
        nombre: usuario?.nombre || nombre,
        correo,
        vinculado: Boolean(usuario),
      };
    });

    for (const usuario of usuariosInspectores) {
      if (correosIncluidos.has(usuario.correo.toLowerCase())) continue;
      inspectores.push({
        assignmentKey: `user:${usuario._id}`,
        _id: usuario._id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        vinculado: true,
      });
    }

    inspectores.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    res.json(inspectores);
  } catch (error) {
    console.error("Error al cargar inspectores:", error);
    res.status(500).json({ mensaje: "No se pudieron cargar los inspectores." });
  }
});

module.exports = router;
