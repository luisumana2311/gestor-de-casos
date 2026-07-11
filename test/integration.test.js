const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Usuario = require("../src/models/userModel");
const { migrateLegacyRoles } = require("../scripts/migrateRoles");
const { createInitialAdmin } = require("../scripts/bootstrapAdmin");

let mongoServer;
let app;
let adminToken;
let inspectorToken;
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
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

async function login(correo) {
  const response = await request(app).post("/auth/login").send({
    correo,
    password: "integration-password",
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  return response.body.token;
}

function authenticated(method, path, token) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

describe("case lifecycle", () => {
  it("allows an administrator to create a case", async () => {
    const response = await authenticated("post", "/casos", adminToken).send({
      numeroCaso: "INT-2026-001",
      nombrePatrono: "Patrono de prueba",
      tipoInvestigacion: "Inscripción Patronal",
      zona: "Pavas",
      inspector: "Marcela Fernandez Sequeira",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.estado, "Pendiente");
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
