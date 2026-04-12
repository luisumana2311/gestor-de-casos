const mongoose = require("mongoose");

const conectarDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("📦 Base de datos MongoDB Atlas conectada correctamente");
  } catch (error) {
    console.error("❌ Error al conectar la base de datos:", error.message);
    process.exit(1);
  }
};

module.exports = conectarDB;