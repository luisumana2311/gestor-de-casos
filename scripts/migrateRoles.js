const mongoose = require("mongoose");

async function migrateLegacyRoles({ dryRun = true } = {}) {
  const users = mongoose.connection.collection("usuarios");
  const legacyFilter = { rol: "cliente" };
  const legacyUsers = await users.countDocuments(legacyFilter);

  if (dryRun || legacyUsers === 0) {
    return { matched: legacyUsers, modified: 0, dryRun };
  }

  const result = await users.updateMany(legacyFilter, {
    $set: { rol: "inspector", updatedAt: new Date() },
  });

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    dryRun: false,
  };
}

async function run() {
  require("dotenv").config();

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no está configurado.");
  }

  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI);
  const result = await migrateLegacyRoles({ dryRun: !apply });

  console.log(
    apply
      ? `Migración completada: ${result.modified} usuario(s) actualizado(s).`
      : `Vista previa: ${result.matched} usuario(s) cambiarían de cliente a inspector.`,
  );

  if (!apply && result.matched > 0) {
    console.log("Ejecute `npm run migrate:roles -- --apply` para aplicar el cambio.");
  }
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("No se pudo ejecutar la migración:", error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { migrateLegacyRoles };
