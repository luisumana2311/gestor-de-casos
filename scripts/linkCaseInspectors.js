const mongoose = require("mongoose");
const Caso = require("../src/models/Caso");
const Usuario = require("../src/models/userModel");

async function linkLegacyCaseInspectors({ dryRun = true } = {}) {
  const casos = await Caso.find({ "inspector.usuarioId": null }).select("inspector").lean();
  const operations = [];

  for (const caso of casos) {
    const usuario = await Usuario.findOne({
      correo: caso.inspector?.correo?.toLowerCase(),
      rol: "inspector",
    }).select("_id").lean();
    if (usuario) {
      operations.push({
        updateOne: {
          filter: { _id: caso._id },
          update: { $set: { "inspector.usuarioId": usuario._id } },
        },
      });
    }
  }

  if (!dryRun && operations.length) await Caso.bulkWrite(operations);
  return { totalLegacy: casos.length, linkable: operations.length, unmatched: casos.length - operations.length, modified: dryRun ? 0 : operations.length, dryRun };
}

async function run() {
  require("dotenv").config();
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI no está configurado.");
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI);
  const result = await linkLegacyCaseInspectors({ dryRun: !apply });
  console.log(JSON.stringify(result, null, 2));
  if (!apply && result.linkable) console.log("Ejecute `npm run migrate:case-inspectors -- --apply` para aplicar los vínculos.");
}

if (require.main === module) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
}

module.exports = { linkLegacyCaseInspectors };
