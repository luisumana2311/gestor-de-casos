const express = require("express");
const router = express.Router();

// CONTROLADORES
const {
  obtenerCasosPaginados,
  obtenerCasoPorId,
  crearCaso,
  editarCaso,
  cambiarEstado,
  agregarNota,
  eliminarCaso
} = require("../controllers/casosController");

// =======================
// RUTAS SIN AUTENTICACIÓN (PARA PRUEBAS)
// =======================

// PAGINACIÓN
router.get("/", obtenerCasosPaginados);

// OBTENER UN CASO POR ID
router.get("/:id", obtenerCasoPorId);

// CREAR CASO
router.post("/", crearCaso);

// EDITAR CAMPOS
router.put("/:id", editarCaso);

// CAMBIAR ESTADO
router.patch("/:id/estado", cambiarEstado);

// AGREGAR NOTAS
router.post("/:id/notas", agregarNota);

// ELIMINAR CASO
router.delete("/:id", eliminarCaso);

module.exports = router;