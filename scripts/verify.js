"use strict";

/* End to end check for the CitySmile Dental backend rebuild. Run the
   server first (node server.js), then run: node scripts/verify.js
   It uses only the public API and pages, the same way a visitor and
   the owner would. It exits non-zero if any check fails. Run it on a
   clean database so the first appointment is CS-1001. */

const BASE = process.env.BASE_URL || "http://127.0.0.1:3001";

let failures = 0;
let checks = 0;

function check(name, ok, detail) {
  checks++;
  if (ok) {
    console.log("PASS  " + name);
  } else {
    failures++;
    console.log("FAIL  " + name + (detail ? "  " + detail : ""));
  }
}

async function req(path, options) {
  const res = await fetch(BASE + path, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}

async function main() {
  const health = await req("/api/health");
  check("health endpoint", health.status === 200 && health.json && health.json.ok);

  const home = await req("/");
  check("home page loads", home.status === 200 && home.text.indexOf('id="app"') !== -1 && home.text.indexOf('src="/app.js"') !== -1, "status " + home.status);
  check("home page has Admin Panel link", home.text.indexOf("Admin Panel") !== -1);
  check("home page has no cart or checkout", home.text.indexOf("checkout") === -1 && home.text.toLowerCase().indexOf("your bag") === -1);
  check("home page has no em dash", home.text.indexOf("—") === -1);

  const adminPage = await req("/admin.html");
  check("admin page loads", adminPage.status === 200 && adminPage.text.indexOf("Admin Panel") !== -1, "status " + adminPage.status);

  const services = await req("/api/services");
  check("services endpoint returns 6", services.status === 200 && Array.isArray(services.json) && services.json.length === 6, services.status + " count " + (services.json && services.json.length));
  const byId = {};
  if (Array.isArray(services.json)) {
    for (const s of services.json) byId[s.id] = s;
  }
  check("6 service names match Design 01",
    byId["general-checkup"] && byId["general-checkup"].name === "General Checkup" &&
    byId["teeth-cleaning"] && byId["teeth-cleaning"].name === "Teeth Cleaning" &&
    byId["teeth-whitening"] && byId["teeth-whitening"].name === "Teeth Whitening" &&
    byId["braces-aligners"] && byId["braces-aligners"].name === "Braces and Aligners" &&
    byId["dental-implants"] && byId["dental-implants"].name === "Dental Implants" &&
    byId["root-canal"] && byId["root-canal"].name === "Root Canal");
  check("every service has image, focal point, description and covers list",
    Array.isArray(services.json) && services.json.every((s) =>
      s.image && s.image.indexOf("/images/") === 0 && s.focal && s.description &&
      Array.isArray(s.covers) && s.covers.length >= 3 && s.goodToKnow));

  const detail = await req("/api/services/dental-implants");
  check("service detail endpoint", detail.status === 200 && detail.json && detail.json.name === "Dental Implants");
  check("unknown service returns 404", (await req("/api/services/no-such-service")).status === 404);

  const dentists = await req("/api/dentists");
  check("dentists endpoint returns 3", dentists.status === 200 && Array.isArray(dentists.json) && dentists.json.length === 3, dentists.status + " count " + (dentists.json && dentists.json.length));
  const dById = {};
  if (Array.isArray(dentists.json)) {
    for (const d of dentists.json) dById[d.id] = d;
  }
  check("3 dentist roles match Design 01",
    dById["general-cosmetic"] && dById["general-cosmetic"].role === "General and Cosmetic" &&
    dById["orthodontist"] && dById["orthodontist"].role === "Orthodontist" &&
    dById["pediatric-specialist"] && dById["pediatric-specialist"].role === "Pediatric Specialist");
  check("dentists have no invented names, only roles",
    Array.isArray(dentists.json) && dentists.json.every((d) => !d.name && d.role && d.image && d.focus));
  check("unknown dentist returns 404", (await req("/api/dentists/no-such-dentist")).status === 404);

  const images = [
    "/images/hero.jpg", "/images/general-checkup.jpg", "/images/teeth-cleaning.jpg",
    "/images/teeth-whitening.jpg", "/images/braces-aligners.jpg", "/images/dental-implants.jpg",
    "/images/root-canal.jpg", "/images/about.jpg", "/images/dentist-general.jpg",
    "/images/dentist-orthodontist.jpg", "/images/dentist-pediatric.jpg",
    "/images/story-1.jpg", "/images/story-2.jpg", "/images/story-3.jpg",
  ];
  for (const img of images) {
    const r = await req(img);
    check("image serves " + img, r.status === 200 && r.text.length > 5000, "status " + r.status + " bytes " + r.text.length);
  }

  const booking = await req("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientName: "Verify Test",
      phone: "03001234567",
      serviceId: "teeth-cleaning",
      date: "2026-11-25",
      time: "10:30",
    }),
  });
  check("booking saves an appointment", booking.status === 201 && booking.json && /^CS-\d+$/.test(booking.json.appointmentNumber), booking.status + " " + booking.text.slice(0, 120));
  check("appointment number is CS-1001 on a clean database", booking.json && booking.json.appointmentNumber === "CS-1001", "got " + (booking.json && booking.json.appointmentNumber));
  check("booking returns the booked service name", booking.json && booking.json.serviceName === "Teeth Cleaning");

  const badService = await req("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientName: "Verify Test", phone: "03001234567", serviceId: "no-such-service", date: "2026-11-25", time: "10:30" }),
  });
  check("unknown service is rejected", badService.status === 400);
  const badPhone = await req("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientName: "Verify Test", phone: "123", serviceId: "teeth-cleaning", date: "2026-11-25", time: "10:30" }),
  });
  check("short phone is rejected", badPhone.status === 400);
  const badDate = await req("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientName: "Verify Test", phone: "03001234567", serviceId: "teeth-cleaning", date: "25-11-2026", time: "10:30" }),
  });
  check("bad date format is rejected", badDate.status === 400);

  const newsEmail = "verify-" + Date.now() + "@example.com";
  const news = await req("/api/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: newsEmail }),
  });
  check("newsletter saves", news.status === 200 && news.json && news.json.subscribed);
  const newsAgain = await req("/api/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: newsEmail }),
  });
  check("newsletter duplicate is reported, not an error", newsAgain.status === 200 && newsAgain.json && newsAgain.json.already === true);

  const contact = await req("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Verify Test", email: "verify@example.com", subject: "Verify", message: "This is a verification message." }),
  });
  check("contact message saves", contact.status === 201 && contact.json && contact.json.saved);

  const status = await req("/api/admin/status");
  check("admin status endpoint", status.status === 200 && typeof status.json.hasAdmin === "boolean", JSON.stringify(status.json));

  const email = "admin-" + Date.now() + "@example.com";
  let token = null;
  if (status.json && !status.json.hasAdmin) {
    const shortPass = await req("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "short" }),
    });
    check("admin setup with a short password is refused", shortPass.status === 400);
    const setup = await req("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "verify-pass-123" }),
    });
    check("admin first use setup", setup.status === 201 && setup.json && setup.json.token, setup.status + " " + setup.text.slice(0, 120));
    token = setup.json && setup.json.token;
    const second = await req("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "other@example.com", password: "verify-pass-123" }),
    });
    check("second admin setup is refused", second.status === 409);
  } else {
    console.log("NOTE  admin already exists in this database, setup checks skipped");
  }

  const wrong = await req("/api/admin/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
  if (token) check("wrong admin password is rejected", wrong.status === 401);

  if (token) {
    const ok = await req("/api/admin/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "verify-pass-123" }),
    });
    check("correct admin password signs in", ok.status === 200 && ok.json && ok.json.token);
    token = ok.json.token;
  }

  const noAuth = await req("/api/admin/data");
  check("admin data without a token is refused", noAuth.status === 401);

  if (token) {
    const data = await req("/api/admin/data", {
      headers: { Authorization: "Bearer " + token },
    });
    check("admin data loads", data.status === 200 && data.json && data.json.stats, data.status);
    check("admin stats count the saved appointment, message and subscriber",
      data.json && data.json.stats.appointments >= 1 && data.json.stats.messages >= 1 && data.json.stats.subscribers >= 1,
      JSON.stringify(data.json && data.json.stats));
    const firstAppt = data.json && data.json.appointments && data.json.appointments[0];
    check("admin data lists the CS-1001 appointment", firstAppt && firstAppt.appointment_number === "CS-1001");
    if (firstAppt) {
      const patch = await req("/api/admin/appointments/" + firstAppt.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ status: "Confirmed" }),
      });
      check("appointment status change saves", patch.status === 200);
      const again = await req("/api/admin/data", {
        headers: { Authorization: "Bearer " + token },
      });
      const same = again.json.appointments.find((a) => a.id === firstAppt.id);
      check("appointment status change persists", same && same.status === "Confirmed");
    }
    const firstMessage = data.json && data.json.messages && data.json.messages[0];
    if (firstMessage) {
      const patch = await req("/api/admin/messages/" + firstMessage.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ status: "Read" }),
      });
      check("message status change saves", patch.status === 200);
      const again = await req("/api/admin/data", {
        headers: { Authorization: "Bearer " + token },
      });
      const same = again.json.messages.find((m) => m.id === firstMessage.id);
      check("message status change persists", same && same.status === "Read");
    }
    const signout = await req("/api/admin/signout", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({}),
    });
    check("admin sign out works", signout.status === 200);
    const afterOut = await req("/api/admin/data", {
      headers: { Authorization: "Bearer " + token },
    });
    check("signed out token is refused", afterOut.status === 401);
  }

  console.log("\n" + checks + " checks, " + failures + " failed.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("Verify run failed:", err.message);
  process.exit(1);
});
