const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Usuario = require("../src/models/userModel");
const { migrateLegacyRoles } = require("../scripts/migrateRoles");
const { createInitialAdmin } = require("../scripts/bootstrapAdmin");
const { linkLegacyCaseInspectors } = require("../scripts/linkCaseInspectors");
const Caso = require("../src/models/Caso");
const Notificacion = require("../src/models/Notificacion");

let mongoServer;
let app;
let adminToken;
let inspectorToken;
let inspectorId;
let caseId;

before(async () => {
  process.env.JWT_SECRET = "integration-secret-with-at-least-32-characters";
  process.env.EMAIL_ENABLED = "false";

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = require("../src/app");

  const passwordHash = await bcrypt.hash("integration-password", 4);
  await Usuario.create({
    nombre: "Admin Test",
    correo: "admin@example.com",
    password: passwordHash,
    rol: "admin",
  });

  adminToken = await login("admin@example.com");

  const registrationResponse = await authenticated("post", "/auth/register", adminToken).send({
    nombre: "Inspector Test",
    correo: "inspector@example.com",
    password: "integration-password",
    rol: "inspector",
  });
  assert.equal(registrationResponse.status, 201);

  inspectorToken = await login("inspector@example.com");
  inspectorId = String((await Usuario.findOne({ correo: "inspector@example.com" }))._id);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

async function login(correo) {
  return loginWithPassword(correo, "integration-password");
}

async function loginWithPassword(correo, password) {
  const response = await request(app).post("/auth/login").send({
    correo,
    password,
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  return response.body.token;
}

function authenticated(method, path, token) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

describe("user account management", () => {
  it("lists users without exposing password hashes", async () => {
    const response = await authenticated("get", "/auth/users", adminToken);
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 2);
    assert.equal(response.body.some((user) => Object.hasOwn(user, "password")), false);
  });

  it("deactivates an account and immediately revokes its active token", async () => {
    const statusResponse = await authenticated(
      "patch",
      `/auth/users/${inspectorId}/status`,
      adminToken,
    ).send({ activo: false });
    assert.equal(statusResponse.status, 200);

    const existingSessionResponse = await authenticated("get", "/casos", inspectorToken);
    assert.equal(existingSessionResponse.status, 401);

    const loginResponse = await request(app).post("/auth/login").send({
      correo: "inspector@example.com",
      password: "integration-password",
    });
    assert.equal(loginResponse.status, 403);
  });

  it("reactivates an account and allows it to log in again", async () => {
    const response = await authenticated(
      "patch",
      `/auth/users/${inspectorId}/status`,
      adminToken,
    ).send({ activo: true });
    assert.equal(response.status, 200);
    inspectorToken = await login("inspector@example.com");
  });

  it("prevents administrators from disabling or deleting themselves", async () => {
    const adminId = String((await Usuario.findOne({ correo: "admin@example.com" }))._id);
    const disableResponse = await authenticated(
      "patch",
      `/auth/users/${adminId}/status`,
      adminToken,
    ).send({ activo: false });
    assert.equal(disableResponse.status, 400);

    const deleteResponse = await authenticated("delete", `/auth/users/${adminId}`, adminToken);
    assert.equal(deleteResponse.status, 400);
  });

  it("deletes another account", async () => {
    const passwordHash = await bcrypt.hash("temporary-password", 4);
    const temporaryUser = await Usuario.create({
      nombre: "Temporary User",
      correo: "temporary@example.com",
      password: passwordHash,
      rol: "supervisor",
    });

    const response = await authenticated(
      "delete",
      `/auth/users/${temporaryUser._id}`,
      adminToken,
    );
    assert.equal(response.status, 200);
    assert.equal(await Usuario.exists({ _id: temporaryUser._id }), null);
  });
});

describe("case lifecycle", () => {
  it("keeps preloaded inspectors visible and adds account inspectors without duplicates", async () => {
    const response = await authenticated("get", "/inspectores", adminToken);
    assert.equal(response.status, 200);
    assert.ok(response.body.length >= 13);
    assert.equal(response.body.filter((item) => item.correo === "mfernans@ccss.sa.cr").length, 1);
    assert.ok(response.body.some((item) => item.correo === "inspector@example.com"));
  });

  it("allows assigning a case to a preloaded inspector without a user account", async () => {
    const response = await authenticated("post", "/casos", adminToken).send({
      numeroCaso: "CATALOG-2026-001",
      nombrePatrono: "Patrono del catalogo",
      tipoInvestigacion: "Inscripción Patronal",
      zona: "Pavas",
      inspector: "catalog:mfernans@ccss.sa.cr",
      fechaAsignado: "2026-07-01",
    });

    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.inspector.correo, "mfernans@ccss.sa.cr");
    assert.equal(response.body.inspector.usuarioId, null);
    await Caso.findByIdAndDelete(response.body._id);
  });

  it("allows an administrator to create a case", async () => {
    const response = await authenticated("post", "/casos", adminToken).send({
      numeroCaso: "INT-2026-001",
      nombrePatrono: "Patrono de prueba",
      tipoInvestigacion: "Inscripción Patronal",
      zona: "Pavas",
      inspector: inspectorId,
      fechaAsignado: "2026-07-01",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.estado, "Pendiente");
    assert.equal(response.body.inspector.usuarioId, inspectorId);
    assert.equal(response.body.historial[0].tipo, "CREACION");
    assert.match(response.body.fechaAsignado, /^2026-07-01/);
    caseId = response.body._id;
  });

  it("provides global dashboard metrics to administrators", async () => {
    const response = await authenticated("get", "/dashboard", adminToken);
    assert.equal(response.status, 200);
    assert.equal(response.body.alcance, "global");
    assert.equal(response.body.indicadores.total, 1);
    assert.equal(response.body.indicadores.pendientes, 1);
    assert.equal(response.body.porInspector[0].correo, "inspector@example.com");
    assert.equal(response.body.casosRecientes[0].numeroCaso, "INT-2026-001");
  });

  it("filters cases on the server while keeping global summary metrics", async () => {
    const secondCase = await Caso.create({
      numeroCaso: "FILTER-2026-002",
      nombrePatrono: "Comercio Sectorizado",
      tipoInvestigacion: "Inscripción Patronal",
      zona: "Uruca",
      inspector: { nombre: "Inspector Test", correo: "inspector@example.com", usuarioId: inspectorId },
      estado: "Sectorizado",
      viaAdministrativa: "Procedente",
      fechaAsignado: new Date("2026-06-01T12:00:00Z"),
    });

    const response = await authenticated(
      "get",
      "/casos?q=Comercio&estado=Sectorizado&via=Procedente&zona=Uruca&page=1&limit=10",
      adminToken,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 1);
    assert.equal(response.body.casos[0].numeroCaso, "FILTER-2026-002");
    assert.deepEqual(response.body.resumen, {
      total: 2,
      pendientes: 1,
      resueltos: 0,
      sectorizados: 1,
    });

    await Caso.findByIdAndDelete(secondCase._id);
  });

  it("rejects invalid server-side filters", async () => {
    const response = await authenticated("get", "/casos?estado=Inventado", adminToken);
    assert.equal(response.status, 400);
    assert.match(response.body.error, /inválido/i);
  });

  it("limits inspector dashboard metrics to assigned cases", async () => {
    const response = await authenticated("get", "/dashboard", inspectorToken);
    assert.equal(response.status, 200);
    assert.equal(response.body.alcance, "personal");
    assert.equal(response.body.indicadores.total, 1);
  });

  it("allows an inspector to read and update the assigned workflow", async () => {
    const listResponse = await authenticated("get", "/casos", inspectorToken);
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.total, 1);
    assert.equal(listResponse.body.resumen.total, 1);

    const statusResponse = await authenticated(
      "patch",
      `/casos/${caseId}/estado`,
      inspectorToken,
    ).send({ estado: "Resuelto" });

    assert.equal(statusResponse.status, 200);
    assert.equal(statusResponse.body.estado, "Resuelto");
    assert.ok(statusResponse.body.fechaResuelto);
    assert.equal(statusResponse.body.historial.length, 2);
    assert.equal(statusResponse.body.historial[1].usuario.rol, "inspector");
  });

  it("updates case management atomically and records internal notes", async () => {
    const managementResponse = await authenticated(
      "patch",
      `/casos/${caseId}/gestion`,
      inspectorToken,
    ).send({
      estado: "Sectorizado",
      viaAdministrativa: "Procedente",
      numeroResolucion: "RES-2026-001",
    });
    assert.equal(managementResponse.status, 200);
    assert.equal(managementResponse.body.estado, "Sectorizado");
    assert.equal(managementResponse.body.viaAdministrativa, "Procedente");
    assert.equal(managementResponse.body.numeroResolucion, "RES-2026-001");
    assert.equal(managementResponse.body.fechaResuelto, null);
    assert.equal(managementResponse.body.historial.at(-1).tipo, "ACTUALIZACION_GESTION");

    const noteResponse = await authenticated(
      "post",
      `/casos/${caseId}/notas`,
      inspectorToken,
    ).send({ texto: "Se coordinó visita de seguimiento con el patrono." });
    assert.equal(noteResponse.status, 200);
    assert.equal(noteResponse.body.notas.length, 1);
    assert.equal(noteResponse.body.notas[0].autor.rol, "inspector");
    assert.equal(noteResponse.body.historial.at(-1).tipo, "NOTA");
  });

  it("validates complete case management updates", async () => {
    const response = await authenticated(
      "patch",
      `/casos/${caseId}/gestion`,
      adminToken,
    ).send({ estado: "Inventado", viaAdministrativa: "Otra", numeroResolucion: "" });
    assert.equal(response.status, 400);
  });

  it("prevents another inspector from seeing an unassigned case", async () => {
    const passwordHash = await bcrypt.hash("other-inspector-password", 4);
    await Usuario.create({
      nombre: "Other Inspector",
      correo: "other-inspector@example.com",
      password: passwordHash,
      rol: "inspector",
    });
    const otherToken = await loginWithPassword(
      "other-inspector@example.com",
      "other-inspector-password",
    );
    const response = await authenticated("get", "/casos", otherToken);
    assert.equal(response.status, 200);
    assert.equal(response.body.total, 0);

    const detailResponse = await authenticated("get", `/casos/${caseId}`, otherToken);
    assert.equal(detailResponse.status, 404);
  });

  it("prevents an inspector from deleting a case", async () => {
    const response = await authenticated("delete", `/casos/${caseId}`, inspectorToken);
    assert.equal(response.status, 403);
  });

  it("allows an administrator to delete a case", async () => {
    const response = await authenticated("delete", `/casos/${caseId}`, adminToken);
    assert.equal(response.status, 200);

    const listResponse = await authenticated("get", "/casos", adminToken);
    assert.equal(listResponse.body.total, 0);
  });
});

describe("notification center", () => {
  it("lists delivery history according to role visibility", async () => {
    const assignedCase = await Caso.create({
      numeroCaso: "NOTIFY-001",
      nombrePatrono: "Patrono notificado",
      tipoInvestigacion: "Inscripción Patronal",
      zona: "Pavas",
      inspector: { usuarioId: inspectorId, nombre: "Inspector Test", correo: "inspector@example.com" },
      fechaAsignado: new Date("2026-05-01T12:00:00Z"),
    });
    const catalogCase = await Caso.create({
      numeroCaso: "NOTIFY-002",
      nombrePatrono: "Patrono catálogo",
      tipoInvestigacion: "Inscripción Patronal",
      zona: "Uruca",
      inspector: { nombre: "Inspector Catálogo", correo: "catalog@example.com" },
      fechaAsignado: new Date("2026-05-01T12:00:00Z"),
    });
    await Notificacion.create([
      {
        caso: assignedCase._id,
        tipo: "ASIGNACION",
        destinatario: assignedCase.inspector,
        asunto: "Asignación 1",
        contenido: "Contenido 1",
        estado: "enviada",
      },
      {
        caso: catalogCase._id,
        tipo: "ASIGNACION",
        destinatario: catalogCase.inspector,
        asunto: "Asignación 2",
        contenido: "Contenido 2",
        estado: "fallida",
        intentos: 3,
        ultimoError: "SMTP no disponible",
      },
    ]);

    const adminResponse = await authenticated("get", "/notificaciones", adminToken);
    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.body.total, 2);
    assert.equal(adminResponse.body.resumen.enviadas, 1);
    assert.equal(adminResponse.body.resumen.fallidas, 1);
    assert.equal(adminResponse.body.emailHabilitado, false);
    assert.deepEqual(
      adminResponse.body.notificaciones.map((item) => item.caso.numeroCaso).sort(),
      ["NOTIFY-001", "NOTIFY-002"],
    );

    const inspectorResponse = await authenticated("get", "/notificaciones", inspectorToken);
    assert.equal(inspectorResponse.status, 200);
    assert.equal(inspectorResponse.body.total, 1);
    assert.equal(inspectorResponse.body.notificaciones[0].destinatario.correo, "inspector@example.com");

    const failedNotification = await Notificacion.findOne({ caso: catalogCase._id });
    const retryResponse = await authenticated(
      "post",
      `/notificaciones/${failedNotification._id}/reintentar`,
      adminToken,
    );
    assert.equal(retryResponse.status, 503);

    await Notificacion.deleteMany({ caso: { $in: [assignedCase._id, catalogCase._id] } });
    await Caso.deleteMany({ _id: { $in: [assignedCase._id, catalogCase._id] } });
  });

  it("prevents inspectors from scheduling notification retries", async () => {
    const response = await authenticated(
      "post",
      `/notificaciones/${new mongoose.Types.ObjectId()}/reintentar`,
      inspectorToken,
    );
    assert.equal(response.status, 403);
  });
});

describe("legacy role migration", () => {
  it("previews and migrates cliente users to inspector", async () => {
    await mongoose.connection.collection("usuarios").insertOne({
      nombre: "Legacy User",
      correo: "legacy@example.com",
      password: "unused",
      rol: "cliente",
    });

    const preview = await migrateLegacyRoles();
    assert.deepEqual(preview, { matched: 1, modified: 0, dryRun: true });

    const result = await migrateLegacyRoles({ dryRun: false });
    assert.equal(result.modified, 1);

    const migrated = await Usuario.findOne({ correo: "legacy@example.com" }).lean();
    assert.equal(migrated.rol, "inspector");
  });
});

describe("legacy case assignment migration", () => {
  it("previews and links legacy cases by inspector email", async () => {
    const legacyCase = await Caso.create({
      numeroCaso: "LEGACY-001",
      nombrePatrono: "Legacy Patron",
      tipoInvestigacion: "Inscripción Patronal",
      zona: "Pavas",
      inspector: { nombre: "Inspector Test", correo: "inspector@example.com" },
      fechaAsignado: new Date(),
    });

    const preview = await linkLegacyCaseInspectors();
    assert.equal(preview.linkable, 1);
    assert.equal(preview.modified, 0);

    const result = await linkLegacyCaseInspectors({ dryRun: false });
    assert.equal(result.modified, 1);
    const migratedCase = await Caso.findById(legacyCase._id).lean();
    assert.equal(String(migratedCase.inspector.usuarioId), inspectorId);
    await legacyCase.deleteOne();
  });
});

describe("administrator bootstrap", () => {
  it("refuses to create a second administrator", async () => {
    await assert.rejects(
      createInitialAdmin({
        nombre: "Second Admin",
        correo: "second-admin@example.com",
        password: "another-secure-password",
      }),
      /Ya existe un administrador/,
    );
  });
});
