const express = require("express");
const router = express.Router();

// MIDDLEWARE DE AUTENTICACIÓN
const auth = require("../config/middleware/authMiddleware");


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
// RUTAS PROTEGIDAS
// =======================

// PAGINACIÓN (ruta principal)
router.get("/", auth, obtenerCasosPaginados);

// OBTENER UN CASO POR ID
router.get("/:id", auth, obtenerCasoPorId);

// CREAR CASO
router.post("/", auth, crearCaso);

// EDITAR CAMPOS PERMITIDOS
router.put("/:id", auth, editarCaso);

// CAMBIAR ESTADO DE CASO
router.patch("/:id/estado", auth, cambiarEstado);

// AGREGAR NOTAS
router.post("/:id/notas", auth, agregarNota);

// ELIMINAR CASO
router.delete("/:id", auth, eliminarCaso);

module.exports = router;
