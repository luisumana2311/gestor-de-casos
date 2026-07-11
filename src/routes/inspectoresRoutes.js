const express = require("express");
const Usuario = require("../models/userModel");
const verificarToken = require("../config/middleware/authMiddleware");
const { verificarCuentaActiva } = require("../config/middleware/authMiddleware");

const router = express.Router();

router.get("/", verificarToken, verificarCuentaActiva, async (_req, res) => {
  try {
    const inspectores = await Usuario.find({ rol: "inspector", activo: { $ne: false } })
      .select("nombre correo")
      .sort({ nombre: 1 })
      .lean();

    res.json(inspectores);
  } catch (error) {
    console.error("Error al cargar inspectores:", error);
    res.status(500).json({ mensaje: "No se pudieron cargar los inspectores." });
  }
});

module.exports = router;
