const { before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const express = require("express");
const verificarToken = require("../src/config/middleware/authMiddleware");
const { permitirRoles } = require("../src/config/middleware/authMiddleware");

before(() => {
  process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
});

function tokenFor(role) {
  return jwt.sign({ id: "test-user", rol: role }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });
}

function roleProtectedApp() {
  const roleApp = express();
  roleApp.use(express.json());
  roleApp.all("/admin-only", verificarToken, permitirRoles("admin"), (_req, res) => {
    res.status(204).end();
  });
  return roleApp;
}

describe("API security foundation", () => {
  it("exposes a public health check", async () => {
    const app = require("../src/app");
    const response = await request(app).get("/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
  });

  it("accepts Render forwarded client IPs for login rate limiting", async () => {
    const app = require("../src/app");
    const response = await request(app)
      .post("/auth/login")
      .set("X-Forwarded-For", "203.0.113.10")
      .send({});

    assert.equal(app.get("trust proxy"), 1);
    assert.equal(response.status, 400);
  });

  it("rejects case access without a token", async () => {
    const app = require("../src/app");
    const response = await request(app).get("/casos");

    assert.equal(response.status, 401);
  });

  it("rejects invalid bearer tokens", async () => {
    const app = require("../src/app");
    const response = await request(app)
      .get("/casos")
      .set("Authorization", "Bearer invalid-token");

    assert.equal(response.status, 401);
  });

  it("allows only administrators to delete cases", async () => {
    const response = await request(roleProtectedApp())
      .delete("/admin-only")
      .set("Authorization", `Bearer ${tokenFor("inspector")}`);

    assert.equal(response.status, 403);
  });

  it("allows only administrators to register users", async () => {
    const response = await request(roleProtectedApp())
      .post("/admin-only")
      .set("Authorization", `Bearer ${tokenFor("supervisor")}`)
      .send({});

    assert.equal(response.status, 403);
  });
});
