const express = require("express");
const router = express.Router();

const inspectores = require("../config/inspectores");

router.get("/", (req, res) => {
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
