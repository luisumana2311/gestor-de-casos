document.addEventListener("DOMContentLoaded", () => {
  inicializarApp();
});

// ===============================
// CONFIGURACIÓN
// ===============================
const API = "http://localhost:4000/casos";
const API_INSPECTORES = "http://localhost:4000/inspectores";

let paginaActual = 1;
let totalPaginas = 1;
const LIMITE = 10;

// 🔥 NECESARIO: token correctamente definido SIN duplicarlo
let token = localStorage.getItem("token");


// ===============================
// FUNCIÓN GENÉRICA PARA FETCH CON TOKEN
// ===============================
async function fetchConToken(url, options = {}) {
  options.headers = {
    ...(options.headers || {}),
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json",
  };
  return fetch(url, options);
}

// ===============================
// CARGAR INSPECTORES
// ===============================
async function cargarInspectores() {
  try {
    const res = await fetchConToken(API_INSPECTORES);
    const lista = await res.json();

    console.log("Inspectores cargados:", lista);

    const select = document.getElementById("inspectorNombre");
    const correoInput = document.getElementById("inspectorCorreo");

    select.innerHTML = '<option value="">Seleccione un inspector...</option>';

    lista.forEach((ins) => {
      select.innerHTML += `
        <option value="${ins.nombre}" data-correo="${ins.correo}">
          ${ins.nombre}
        </option>
      `;
    });

    select.addEventListener("change", () => {
      const correo = select.selectedOptions[0].dataset.correo || "";
      correoInput.value = correo;
    });

  } catch (error) {
    console.error("Error cargando inspectores:", error);
  }
}

// ===============================
// REGISTRAR CASO
// ===============================
document.getElementById("formCaso").addEventListener("submit", async (e) => {
  e.preventDefault();

  const caso = {
    numeroCaso: document.getElementById("numeroCaso").value,
    nombrePatrono: document.getElementById("nombrePatrono").value,
    tipoInvestigacion: document.getElementById("tipoInvestigacion").value,
    zona: document.getElementById("zona").value,
    inspector: document.getElementById("inspectorNombre").value,
  };

  const res = await fetchConToken(API, {
    method: "POST",
    body: JSON.stringify(caso),
  });

  if (!res.ok) {
    const error = await res.json();
    alert("Error: " + (error.error || "No se pudo crear el caso"));
    return;
  }

  alert("Caso registrado correctamente");
  document.getElementById("formCaso").reset();
  cargarCasos(1);
});

// ===============================
// FORMATEAR FECHA
// ===============================
function formatearFecha(f) {
  if (!f) return "";
  return new Date(f).toLocaleDateString("es-CR");
}

// ===============================
// PINTAR TABLA
// ===============================
function pintarTabla(lista) {
  const tbody = document.getElementById("listaCasos");
  tbody.innerHTML = "";

  lista.forEach((caso) => {
    tbody.innerHTML += `
      <tr>
        <td>${caso._id}</td>
        <td>${caso.numeroCaso}</td>
        <td>${caso.nombrePatrono}</td>
        <td>${caso.tipoInvestigacion}</td>
        <td>${caso.zona}</td>
        <td>${caso.inspector?.nombre || caso.inspector}</td>
        <td>${caso.estado}</td>
        <td>${caso.viaAdministrativa || ""}</td>
        <td>${formatearFecha(caso.fechaAsignado)}</td>
        <td>${formatearFecha(caso.fechaResuelto)}</td>
        <td>${caso.diasHabiles ?? ""}</td>
        <td>${caso.numeroResolucion || ""}</td>

        <td>
          <button class="btn btn-warning btn-sm me-2" onclick="abrirEditar('${caso._id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarCaso('${caso._id}')">Eliminar</button>
        </td>
      </tr>
    `;
  });
}

// ===============================
// CARGAR CASOS (PAGINACIÓN)
// ===============================
async function cargarCasos(page = 1) {
  const res = await fetchConToken(`${API}?page=${page}&limit=${LIMITE}`);
  const data = await res.json();

  pintarTabla(data.casos);

  paginaActual = data.page;
  totalPaginas = data.totalPages;

  actualizarControlesPaginacion();
}

// ===============================
// CONTROLES DE PAGINACIÓN
// ===============================
function paginaAnterior() {
  if (paginaActual > 1) cargarCasos(paginaActual - 1);
}

function paginaSiguiente() {
  if (paginaActual < totalPaginas) cargarCasos(paginaActual + 1);
}

function actualizarControlesPaginacion() {
  document.getElementById("paginaActual").innerText = paginaActual;
  document.getElementById("totalPaginas").innerText = totalPaginas;
}

// ===============================
// ABRIR MODAL DE EDICIÓN
// ===============================
async function abrirEditar(id) {
  const res = await fetchConToken(`${API}/${id}`);
  const caso = await res.json();

  document.getElementById("editId").value = caso._id;
  document.getElementById("editVia").value = caso.viaAdministrativa || "";
  document.getElementById("editResolucion").value = caso.numeroResolucion || "";
  document.getElementById("editEstado").value = caso.estado;

  const modal = new bootstrap.Modal(document.getElementById("modalEditar"));
  modal.show();
}

// ===============================
// GUARDAR CAMBIOS
// ===============================
async function guardarCambios() {
  const id = document.getElementById("editId").value;

  const via = document.getElementById("editVia").value;
  const resolucion = document.getElementById("editResolucion").value;
  const estado = document.getElementById("editEstado").value;

  await fetchConToken(`${API}/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      viaAdministrativa: via,
      numeroResolucion: resolucion,
    }),
  });

  await fetchConToken(`${API}/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });

  alert("Cambios guardados correctamente");
  cargarCasos(paginaActual);

  const modal = bootstrap.Modal.getInstance(
    document.getElementById("modalEditar")
  );
  modal.hide();
}

// ===============================
// ELIMINAR CASO
// ===============================
async function eliminarCaso(id) {
  const confirmar = confirm(
    "¿Seguro que desea eliminar este caso? Esta acción no se puede deshacer."
  );

  if (!confirmar) return;

  const res = await fetchConToken(`${API}/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json();
    alert("Error: " + (error.error || "No se pudo eliminar el caso"));
    return;
  }

  alert("Caso eliminado correctamente");
  cargarCasos(paginaActual);
}

// ===============================
// FILTROS
// ===============================
async function filtrarCasos() {
  const estado = document.getElementById("filtroEstado").value;
  const via = document.getElementById("filtroVia").value;

  const res = await fetchConToken(`${API}?page=1&limit=50000`);
  const data = await res.json();

  let casos = data.casos;

  if (estado !== "") casos = casos.filter((c) => c.estado === estado);
  if (via !== "") casos = casos.filter((c) => c.viaAdministrativa === via);

  pintarTabla(casos);
}

function limpiarFiltros() {
  document.getElementById("filtroEstado").value = "";
  document.getElementById("filtroVia").value = "";
  cargarCasos(1);
}

// ===============================
// EJECUCIÓN INICIAL
// ===============================
function inicializarApp() {
  cargarInspectores();
  cargarCasos(1);
}
