"use strict";

/* MySQL access for CitySmile Dental. Credentials come only from
   environment variables, never from code. On Hostinger these are set
   in the Node Web App settings. Locally they come from a .env file
   or the shell. */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function config() {
  const dbName = env("DB_NAME", "");
  if (!dbName) {
    throw new Error(
      "DB_NAME is not set. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME before starting."
    );
  }
  return {
    host: env("DB_HOST", "127.0.0.1"),
    port: Number(env("DB_PORT", "3306")),
    user: env("DB_USER", ""),
    password: env("DB_PASSWORD", ""),
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

let pool = null;

function getPool() {
  if (!pool) pool = mysql.createPool(config());
  return pool;
}

async function query(sql, params) {
  const rows = await getPool().execute(sql, params || []);
  return rows[0];
}

/* Create the tables if they do not exist, then seed the 6 services and
   3 dentists from db/seed-services.json when those tables are empty.
   Production starts empty for appointments, subscribers, messages
   and admins. */
async function initDb() {
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await getPool().query(statement);
  }
  const seedPath = path.join(__dirname, "..", "db", "seed-services.json");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const serviceCount = await query("SELECT COUNT(*) AS n FROM services");
  if (serviceCount[0].n === 0) {
    for (let i = 0; i < seed.services.length; i++) {
      const s = seed.services[i];
      await query(
        "INSERT INTO services (id, name, short, category, description, covers, good_to_know, image, focal, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          s.id,
          s.name,
          s.short,
          s.category,
          s.description,
          JSON.stringify(s.covers),
          s.good_to_know,
          s.image,
          s.focal,
          i + 1,
        ]
      );
    }
  }
  const dentistCount = await query("SELECT COUNT(*) AS n FROM dentists");
  if (dentistCount[0].n === 0) {
    for (let i = 0; i < seed.dentists.length; i++) {
      const d = seed.dentists[i];
      await query(
        "INSERT INTO dentists (id, role, focus, description, care, image, focal, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [d.id, d.role, d.focus, d.description, JSON.stringify(d.care), d.image, d.focal, i + 1]
      );
    }
  }
}

/* mysql2 already parses JSON columns into values, while a stored JSON
   string would need parsing. Accept both so the code works either way. */
function asArray(value) {
  return Array.isArray(value) ? value : JSON.parse(value);
}

function rowToService(row) {
  return {
    id: row.id,
    name: row.name,
    short: row.short,
    category: row.category,
    description: row.description,
    covers: asArray(row.covers),
    goodToKnow: row.good_to_know,
    image: row.image,
    focal: row.focal,
  };
}

function rowToDentist(row) {
  return {
    id: row.id,
    role: row.role,
    focus: row.focus,
    description: row.description,
    care: asArray(row.care),
    image: row.image,
    focal: row.focal,
  };
}

async function getServices() {
  const rows = await query("SELECT * FROM services ORDER BY sort_order ASC");
  return rows.map(rowToService);
}

async function getService(id) {
  const rows = await query("SELECT * FROM services WHERE id = ?", [id]);
  return rows.length ? rowToService(rows[0]) : null;
}

async function getDentists() {
  const rows = await query("SELECT * FROM dentists ORDER BY sort_order ASC");
  return rows.map(rowToDentist);
}

async function getDentist(id) {
  const rows = await query("SELECT * FROM dentists WHERE id = ?", [id]);
  return rows.length ? rowToDentist(rows[0]) : null;
}

/* Book an appointment. The service is always read from the database,
   never trusted from the request, so a changed service in the browser
   cannot book a visit that does not exist. Appointment numbers are
   CS-1001, CS-1002 and so on, from the row id. */
async function bookAppointment(booking) {
  const service = await getService(booking.serviceId);
  if (!service) throw new Error("Unknown service: " + booking.serviceId);
  const inserted = await query(
    "INSERT INTO appointments (patient_name, phone, service_id, service_name, appointment_date, appointment_time, status) VALUES (?, ?, ?, ?, ?, ?, 'New')",
    [
      booking.patientName,
      booking.phone,
      service.id,
      service.name,
      booking.date,
      booking.time,
    ]
  );
  const id = inserted.insertId;
  const appointmentNumber = "CS-" + (1000 + id);
  await query("UPDATE appointments SET appointment_number = ? WHERE id = ?", [
    appointmentNumber,
    id,
  ]);
  return { appointmentNumber, serviceName: service.name };
}

async function subscribe(email) {
  try {
    await query("INSERT INTO subscribers (email) VALUES (?)", [email]);
    return { subscribed: true, already: false };
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return { subscribed: true, already: true };
    }
    throw err;
  }
}

async function saveMessage(name, email, subject, message) {
  await query(
    "INSERT INTO messages (name, email, subject, message, status) VALUES (?, ?, ?, ?, 'New')",
    [name, email, subject, message]
  );
  return { saved: true };
}

async function getAdminData() {
  const statsRows = await query(
    "SELECT (SELECT COUNT(*) FROM appointments) AS appointments, (SELECT COUNT(*) FROM messages) AS messages, (SELECT COUNT(*) FROM subscribers) AS subscribers"
  );
  const appointments = await query(
    "SELECT id, appointment_number, patient_name, phone, service_id, service_name, appointment_date, appointment_time, status, created_at FROM appointments ORDER BY id DESC"
  );
  const messages = await query(
    "SELECT id, name, email, subject, message, status, created_at FROM messages ORDER BY id DESC"
  );
  const subscribers = await query(
    "SELECT id, email, created_at FROM subscribers ORDER BY id DESC"
  );
  return {
    stats: {
      appointments: statsRows[0].appointments,
      messages: statsRows[0].messages,
      subscribers: statsRows[0].subscribers,
    },
    appointments,
    messages,
    subscribers,
  };
}

async function setAppointmentStatus(id, status) {
  const allowed = ["New", "Confirmed", "Completed", "Cancelled"];
  if (allowed.indexOf(status) === -1) throw new Error("Bad appointment status");
  await query("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);
}

async function setMessageStatus(id, status) {
  const allowed = ["New", "Read", "Replied"];
  if (allowed.indexOf(status) === -1) throw new Error("Bad message status");
  await query("UPDATE messages SET status = ? WHERE id = ?", [status, id]);
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  config,
  query,
  initDb,
  getServices,
  getService,
  getDentists,
  getDentist,
  bookAppointment,
  subscribe,
  saveMessage,
  getAdminData,
  setAppointmentStatus,
  setMessageStatus,
  close,
};
