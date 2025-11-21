// 📌 Feriados oficiales Costa Rica (fechas fijas)
const feriadosFijos = [
  "01-01", // Año Nuevo
  "04-11", // Batalla de Rivas (trasladable)
  "05-01", // Día del Trabajo
  "07-25", // Anexión del Partido de Nicoya
  "08-15", // Día de la Madre
  "09-15", // Independencia
  "12-25"  // Navidad
];

// 📌 Función para calcular Jueves y Viernes Santo de cualquier año
function calcularSemanaSanta(year) {
  // Algoritmo de Gauss — fecha exacta de Pascua
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);

  const fechaPascua = new Date(year, month - 1, day);

  // Jueves Santo = -3 días
  const juevesSanto = new Date(fechaPascua);
  juevesSanto.setDate(fechaPascua.getDate() - 3);

  // Viernes Santo = -2 días
  const viernesSanto = new Date(fechaPascua);
  viernesSanto.setDate(fechaPascua.getDate() - 2);

  return [
    juevesSanto.toISOString().slice(0, 10),
    viernesSanto.toISOString().slice(0, 10)
  ];
}

module.exports = function obtenerFeriados(year) {
  const feriados = [];

  // Agregar feriados fijos en formato YYYY-MM-DD
  feriadosFijos.forEach(diaMes => {
    feriados.push(`${year}-${diaMes}`);
  });

  // Agregar Semana Santa
  const semanaSanta = calcularSemanaSanta(year);
  feriados.push(...semanaSanta);

  return feriados;
};
