const express = require("express");
const router = express.Router();
const verificarToken = require("../config/middleware/authMiddleware");
const { permitirRoles } = require("../config/middleware/authMiddleware");
const { verificarCuentaActiva } = require("../config/middleware/authMiddleware");

// CONTROLADORES
const {
  obtenerCasosPaginados,
  obtenerCasoPorId,
  crearCaso,
  editarCaso,
  cambiarEstado,
  actualizarGestion,
  agregarNota,
  eliminarCaso
} = require("../controllers/casosController");

router.use(verificarToken, verificarCuentaActiva);

// PAGINACIÓN
router.get("/", obtenerCasosPaginados);

// OBTENER UN CASO POR ID
router.get("/:id", obtenerCasoPorId);

// CREAR CASO
router.post("/", permitirRoles("admin", "supervisor"), crearCaso);

// EDITAR CAMPOS
router.put("/:id", permitirRoles("admin", "supervisor", "inspector"), editarCaso);

// CAMBIAR ESTADO
router.patch("/:id/estado", permitirRoles("admin", "supervisor", "inspector"), cambiarEstado);

// ACTUALIZAR GESTIÓN COMPLETA
router.patch("/:id/gestion", permitirRoles("admin", "supervisor", "inspector"), actualizarGestion);

// AGREGAR NOTAS
router.post("/:id/notas", permitirRoles("admin", "supervisor", "inspector"), agregarNota);

// ELIMINAR CASO
router.delete("/:id", permitirRoles("admin"), eliminarCaso);

module.exports = router;
