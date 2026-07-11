const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Usuario = require("../src/models/userModel");

async function createInitialAdmin({ nombre, correo, password }) {
  if (!nombre || !correo || !password) {
    throw new Error("Nombre, correo y contraseña son obligatorios.");
  }

  if (password.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  }

  if (await Usuario.exists({ rol: "admin" })) {
    throw new Error("Ya existe un administrador. Use el flujo autenticado para crear usuarios.");
  }

  if (await Usuario.exists({ correo })) {
    throw new Error("Ya existe un usuario con ese correo.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return Usuario.create({ nombre, correo, password: passwordHash, rol: "admin" });
}

async function run() {
  require("dotenv").config();

  const nombre = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const correo = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!process.env.MONGO_URI || !nombre || !correo || !password) {
    throw new Error(
      "Configure MONGO_URI, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD.",
    );
  }

  await mongoose.connect(process.env.MONGO_URI);
  await createInitialAdmin({ nombre, correo, password });
  console.log("Administrador inicial creado correctamente.");
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("No se pudo crear el administrador:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { createInitialAdmin };
