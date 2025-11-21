const obtenerFeriados = require("./feriados");

function calcularDiasHabiles(inicio, fin) {
  const inicioDate = new Date(inicio);
  const finDate = new Date(fin);

  let diasHabiles = 0;
  const year = inicioDate.getFullYear();

  const feriados = obtenerFeriados(year);

  let actual = new Date(inicioDate);

  while (actual <= finDate) {
    const diaSemana = actual.getDay(); // 0=Domingo, 6=Sábado
    const formato = actual.toISOString().slice(0, 10);

    if (
      diaSemana !== 0 &&      // No domingo
      diaSemana !== 6 &&      // No sábado
      !feriados.includes(formato) // No feriados
    ) {
      diasHabiles++;
    }

    actual.setDate(actual.getDate() + 1);
  }

  return diasHabiles;
}

module.exports = calcularDiasHabiles;
