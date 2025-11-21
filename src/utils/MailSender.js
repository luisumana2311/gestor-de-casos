const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error) => {
  if (error) {
    console.error("❌ Error SMTP:", error);
  } else {
    console.log("📨 Servidor SMTP listo para enviar correos");
  }
});

module.exports = transporter;
