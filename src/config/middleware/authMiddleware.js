const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authorization = req.headers["authorization"];

  if (!authorization) {
    return res.status(401).json({ mensaje: "No autorizado." });
  }

  try {
    const token = authorization.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: "Token inválido." });
  }
};