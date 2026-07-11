const Caso = require("../models/Caso");

function filtroVisibilidad(req) {
  if (req.usuario.rol !== "inspector") return {};
  return { $or: [{ "inspector.usuarioId": req.usuario.id }, { "inspector.correo": req.usuario.correo }] };
}

async function obtenerDashboard(req, res) {
  try {
    const limiteAtraso = new Date();
    limiteAtraso.setDate(limiteAtraso.getDate() - 30);
    const [resumen] = await Caso.aggregate([
      { $match: filtroVisibilidad(req) },
      { $facet: {
        estados: [{ $group: { _id: "$estado", total: { $sum: 1 } } }],
        zonas: [{ $group: { _id: "$zona", total: { $sum: 1 } } }, { $sort: { total: -1, _id: 1 } }],
        inspectores: [
          { $group: { _id: { correo: "$inspector.correo", nombre: "$inspector.nombre" }, total: { $sum: 1 }, pendientes: { $sum: { $cond: [{ $eq: ["$estado", "Pendiente"] }, 1, 0] } } } },
          { $sort: { total: -1, "_id.nombre": 1 } },
        ],
        rendimiento: [{ $match: { estado: "Resuelto", diasHabiles: { $ne: null } } }, { $group: { _id: null, promedioDias: { $avg: "$diasHabiles" } } }],
        recientes: [{ $sort: { fechaCreacion: -1 } }, { $limit: 5 }, { $project: { numeroCaso: 1, nombrePatrono: 1, estado: 1, fechaAsignado: 1, "inspector.nombre": 1 } }],
        atrasados: [{ $match: { estado: { $ne: "Resuelto" }, fechaAsignado: { $lt: limiteAtraso } } }, { $count: "total" }],
        total: [{ $count: "total" }],
      } },
    ]);
    const porEstado = Object.fromEntries(resumen.estados.map((item) => [item._id, item.total]));
    const total = resumen.total[0]?.total || 0;
    const resueltos = porEstado.Resuelto || 0;
    res.json({
      alcance: req.usuario.rol === "inspector" ? "personal" : "global",
      generadoEn: new Date(),
      indicadores: { total, pendientes: porEstado.Pendiente || 0, resueltos, sectorizados: porEstado.Sectorizado || 0, atrasados: resumen.atrasados[0]?.total || 0, tasaResolucion: total ? Math.round((resueltos / total) * 100) : 0, promedioDias: Number((resumen.rendimiento[0]?.promedioDias || 0).toFixed(1)) },
      porZona: resumen.zonas.map((item) => ({ zona: item._id, total: item.total })),
      porInspector: resumen.inspectores.map((item) => ({ nombre: item._id.nombre, correo: item._id.correo, total: item.total, pendientes: item.pendientes })),
      casosRecientes: resumen.recientes,
    });
  } catch (error) {
    console.error("Error al generar dashboard:", error);
    res.status(500).json({ error: "No se pudieron calcular las métricas." });
  }
}

module.exports = { obtenerDashboard };
