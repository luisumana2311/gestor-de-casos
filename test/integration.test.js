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

  it("allows an inspector to read and update the assigned workflow", async () => {
    const listResponse = await authenticated("get", "/casos", inspectorToken);
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.total, 1);

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
