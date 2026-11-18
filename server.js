"use strict";

/* CitySmile Dental backend. Express serves the clinic frontend from
   public/ and provides the JSON API the site and the Admin Panel use.
   The same app serves the pages and the API, so a Hostinger Node Web
   App runs it as one process. Entry file: server.js. Start:
   node server.js. */

require("dotenv").config();

const path = require("path");
const express = require("express");
const db = require("./src/db");
const auth = require("./src/auth");

const app = express();
const PORT = Number(process.env.PORT || "3001");

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

function isEmail(value) {
  return typeof value === "string" && value.indexOf("@") > 0 && value.indexOf(".") > value.indexOf("@");
}

function sendError(res, err) {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: "Something went wrong. Please try again." });
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "citysmile-backend" });
});

app.get("/api/services", async (req, res) => {
  try {
    res.json(await db.getServices());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/services/:id", async (req, res) => {
  try {
    const service = await db.getService(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.json(service);
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/dentists", async (req, res) => {
  try {
    res.json(await db.getDentists());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/dentists/:id", async (req, res) => {
  try {
    const dentist = await db.getDentist(req.params.id);
    if (!dentist) return res.status(404).json({ error: "Dentist not found" });
    res.json(dentist);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/appointments", async (req, res) => {
  try {
    const body = req.body || {};
    const patientName = String(body.patientName || "").trim();
    const phone = String(body.phone || "").trim();
    const serviceId = String(body.serviceId || "").trim();
    const date = String(body.date || "").trim();
    const time = String(body.time || "").trim();
    if (patientName.length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (phone.replace(/[^0-9]/g, "").length < 7) return res.status(400).json({ error: "Please enter a phone number." });
    if (!serviceId) return res.status(400).json({ error: "Please choose a service." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Please choose a date." });
    if (!/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: "Please choose a time." });
    const saved = await db.bookAppointment({ patientName, phone, serviceId, date, time });
    res.status(201).json(saved);
  } catch (err) {
    if (err && /Unknown service/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    sendError(res, err);
  }
});

app.post("/api/newsletter", async (req, res) => {
  try {
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    res.json(await db.subscribe(email));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    if (name.length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (!isEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    if (message.length < 4) return res.status(400).json({ error: "Please write a short message." });
    res.status(201).json(await db.saveMessage(name, email, subject, message));
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/status", async (req, res) => {
  try {
    res.json({ hasAdmin: await auth.hasAdmin() });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/admin/setup", async (req, res) => {
  try {
    const body = req.body || {};
    const token = await auth.setupAdmin(
      String(body.email || "").trim().toLowerCase(),
      String(body.password || "")
    );
    res.status(201).json({ token });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/admin/signin", async (req, res) => {
  try {
    const body = req.body || {};
    const token = await auth.signIn(
      String(body.email || "").trim().toLowerCase(),
      String(body.password || "")
    );
    res.json({ token });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/admin/signout", auth.requireAdmin, async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    await auth.signOut(header.slice(7));
    res.json({ signedOut: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/data", auth.requireAdmin, async (req, res) => {
  try {
    res.json(await db.getAdminData());
  } catch (err) {
    sendError(res, err);
  }
});

app.patch("/api/admin/appointments/:id", auth.requireAdmin, async (req, res) => {
  try {
    await db.setAppointmentStatus(Number(req.params.id), String((req.body || {}).status || ""));
    res.json({ updated: true });
  } catch (err) {
    if (err && /Bad appointment status/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    sendError(res, err);
  }
});

app.patch("/api/admin/messages/:id", auth.requireAdmin, async (req, res) => {
  try {
    await db.setMessageStatus(Number(req.params.id), String((req.body || {}).status || ""));
    res.json({ updated: true });
  } catch (err) {
    if (err && /Bad message status/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    sendError(res, err);
  }
});

/* Clinic pages are rendered by the single page app, so any other page
   request serves the clinic. API routes above are matched first. */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function start() {
  await db.initDb();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log("CitySmile Dental backend listening on port " + PORT);
  });
}

if (require.main === module) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("CitySmile Dental backend could not start:", err.message);
    process.exit(1);
  });
}

module.exports = app;
