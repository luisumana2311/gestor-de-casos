require("dotenv").config();

const conectarDB = require("./src/config/db");
const app = require("./src/app");
const { iniciarProcesadorNotificaciones } = require("./src/services/notificacionesService");

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  validateEnvironment();
  await conectarDB();
  iniciarProcesadorNotificaciones();

  app.listen(PORT, () => {
    console.log(`Servidor disponible en el puerto ${PORT}`);
  });
}

function validateEnvironment() {
  const requiredVariables = ["MONGO_URI", "JWT_SECRET"];
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);

  if (missingVariables.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missingVariables.join(", ")}`);
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres.");
  }

  if (process.env.EMAIL_ENABLED === "true") {
    for (const variable of ["EMAIL_USER", "EMAIL_PASS"]) {
      if (!process.env[variable]) throw new Error(`${variable} es obligatoria cuando EMAIL_ENABLED=true.`);
    }
  }
}

start().catch((error) => {
  console.error("No se pudo iniciar la aplicación:", error.message);
  process.exit(1);
});
