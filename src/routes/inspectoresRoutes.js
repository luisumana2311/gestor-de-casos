const express = require("express");
const router = express.Router();

const inspectores = require("../config/inspectores");
const verificarToken = require("../config/middleware/authMiddleware");
const { verificarCuentaActiva } = require("../config/middleware/authMiddleware");

router.get("/", verificarToken, verificarCuentaActiva, (req, res) => {
  try {
    const lista = Object.entries(inspectores).map(([nombre, correo]) => ({
      nombre,
      correo,
    }));

    res.json(lista);
  } catch (error) {
    res.status(500).json({ mensaje: "Error cargando inspectores" });
  }
});

module.exports = router;
