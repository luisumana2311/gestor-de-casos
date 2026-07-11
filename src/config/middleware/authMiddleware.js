const jwt = require("jsonwebtoken");

function verificarToken(req, res, next) {
  const authorization = req.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ mensaje: "Token de acceso requerido." });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET no está configurado");
    }

    const token = authorization.slice("Bearer ".length).trim();
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ mensaje: "Token inválido o expirado." });
  }
}

function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: "No tiene permisos para esta acción." });
    }

    return next();
  };
}

module.exports = verificarToken;
module.exports.permitirRoles = permitirRoles;
