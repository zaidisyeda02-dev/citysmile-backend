"use strict";

/* DOM execution check for the CitySmile Dental backend rebuild. Runs
   the real clinic frontend (public/app.js) in jsdom against the
   running server, the way a visitor would use it. Run the server
   first (node server.js), then run: node scripts/dom-check.js
   Run it on a clean database: it books one appointment, subscribes
   one email, sends one message and creates one admin account. It
   exits non-zero if any check fails. */

const { JSDOM, VirtualConsole, ResourceLoader } = require("jsdom");

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (fn()) return true;
    } catch (e) {}
    await sleep(100);
  }
  console.log("TIMEOUT waiting for: " + label);
  return false;
}

function setInput(window, el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function submitForm(window, form) {
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

function click(window, el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

/* Only same-origin resources (the app's own scripts). Google Fonts and
   any other outside URL is blocked, so the check does not depend on it. */
class SameOriginLoader extends ResourceLoader {
  fetch(url, options) {
    if (url.startsWith(BASE)) return super.fetch(url, options);
    return Promise.resolve(Buffer.alloc(0));
  }
}

async function makeDom(path) {
  const res = await fetch(BASE + path);
  const html = await res.text();
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on("jsdomError", (err) => {
    const msg = String((err && err.message) || err);
    if (/Could not load|not implemented/i.test(msg)) return;
    errors.push(msg);
    console.log("jsdom error: " + msg);
  });
  const dom = new JSDOM(html, {
    url: BASE + path,
    runScripts: "dangerously",
    resources: new SameOriginLoader(),
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.scrollTo = function () {};
      if (window.Element && window.Element.prototype) {
        window.Element.prototype.scrollIntoView = function () {};
      }
      window.fetch = function (input, init) {
        const url = typeof input === "string" ? input : input.url;
        const full = url.indexOf("/") === 0 ? BASE + url : url;
        return fetch(full, init);
      };
    },
  });
  dom.errors = errors;
  return dom;
}

async function main() {
  const dom = await makeDom("/");
  const window = dom.window;
  const document = window.document;

  await waitFor(() => !!document.getElementById("intro-skip"), 2000, "intro Skip button to appear");
  check("intro shows with Skip intro and by Interlinkz", !!document.getElementById("intro-skip") && document.getElementById("intro-root").textContent.indexOf("by Interlinkz") !== -1);

  const skip = document.getElementById("intro-skip");
  if (skip) click(window, skip);
  await waitFor(() => !document.getElementById("intro-root").textContent.trim(), 3000, "intro to lift");
  check("Skip intro dismisses the intro", document.getElementById("intro-root").textContent.trim() === "");

  await waitFor(() => document.getElementById("app").textContent.indexOf("Your Smile,") !== -1, 5000, "hero to render");
  check("hero Your Smile, Our Passion renders", document.getElementById("app").textContent.indexOf("Your Smile,") !== -1);
  check("hero has a Book Appointment button", document.getElementById("app").textContent.indexOf("Book Appointment") !== -1);
  check("hero photo loads", !!document.querySelector(".hero-photo img") && document.querySelector(".hero-photo img").getAttribute("src") === "/images/hero.jpg");

  const serviceNames = ["General Checkup", "Teeth Cleaning", "Teeth Whitening", "Braces and Aligners", "Dental Implants", "Root Canal"];
  check("home shows all 6 services", serviceNames.every((n) => document.getElementById("app").textContent.indexOf(n) !== -1));
  check("home shows all 3 dentist roles", ["General and Cosmetic", "Orthodontist", "Pediatric Specialist"].every((n) => document.getElementById("app").textContent.indexOf(n) !== -1));
  check("home shows the 3 patient stories", document.getElementById("app").textContent.indexOf("incredibly gentle and kind") !== -1 && document.getElementById("app").textContent.indexOf("Best dental experience") !== -1 && document.getElementById("app").textContent.indexOf("Warm and welcoming environment") !== -1);
  check("home shows the booking form", !!document.getElementById("booking-form"));
  check("footer shows CitySmile Dental by Interlinkz", document.body.textContent.indexOf("CitySmile Dental by Interlinkz") !== -1);
  check("contact details are marked Not provided yet", (document.body.textContent.match(/Not provided yet/g) || []).length >= 4);

  // Every service detail page, by direct click.
  const serviceIds = ["general-checkup", "teeth-cleaning", "teeth-whitening", "braces-aligners", "dental-implants", "root-canal"];
  for (const id of serviceIds) {
    const btn = document.querySelector('[data-open-service="' + id + '"]');
    check("service card has a View Details button for " + id, !!btn);
    if (!btn) continue;
    click(window, btn);
    const name = serviceNames[serviceIds.indexOf(id)];
    await waitFor(() => document.getElementById("app").textContent.indexOf("What this visit covers") !== -1, 3000, "detail page for " + id);
    const ok = document.getElementById("app").textContent.indexOf(name) !== -1 &&
      document.getElementById("app").textContent.indexOf("What this visit covers") !== -1 &&
      document.getElementById("app").textContent.indexOf("Home") !== -1 &&
      !!document.querySelector(".detail-banner img");
    check("service detail page opens for " + name, ok);
    const back = document.querySelector("[data-back]");
    if (back) click(window, back);
    await waitFor(() => !!document.getElementById("booking-form"), 3000, "back to home after " + id);
  }

  // Every dentist detail page, by direct click.
  const dentistIds = ["general-cosmetic", "orthodontist", "pediatric-specialist"];
  const dentistRoles = ["General and Cosmetic", "Orthodontist", "Pediatric Specialist"];
  for (let i = 0; i < dentistIds.length; i++) {
    const btn = document.querySelector('[data-open-dentist="' + dentistIds[i] + '"]');
    check("dentist card has a View Details button for " + dentistIds[i], !!btn);
    if (!btn) continue;
    click(window, btn);
    await waitFor(() => document.getElementById("app").textContent.indexOf("What this dentist looks after") !== -1, 3000, "dentist detail for " + dentistIds[i]);
    const ok = document.getElementById("app").textContent.indexOf(dentistRoles[i]) !== -1 &&
      document.getElementById("app").textContent.indexOf("Not provided yet") !== -1 &&
      !!document.querySelector(".detail-banner img");
    check("dentist detail page opens for " + dentistRoles[i], ok);
    const back = document.querySelector("[data-back]");
    if (back) click(window, back);
    await waitFor(() => !!document.getElementById("booking-form"), 3000, "back to home after " + dentistIds[i]);
  }

  // Header search: "implant" finds Dental Implants.
  click(window, document.getElementById("search-toggle-btn"));
  await waitFor(() => document.getElementById("search-bar").classList.contains("open"), 2000, "search bar to open");
  check("search toggle opens the search bar", document.getElementById("search-bar").classList.contains("open"));
  setInput(window, document.getElementById("site-search"), "implant");
  await waitFor(() => document.getElementById("search-results").textContent.indexOf("Dental Implants") !== -1, 3000, "implant suggestion");
  check("search implant suggests Dental Implants with a photo", document.getElementById("search-results").textContent.indexOf("Dental Implants") !== -1 && !!document.querySelector("#search-results img"));
  submitForm(window, document.getElementById("site-search-form"));
  await waitFor(() => document.getElementById("app").textContent.indexOf("Showing 1 result") !== -1, 3000, "search results page");
  check("search page shows 1 result for implant", document.getElementById("app").textContent.indexOf("Showing 1 result") !== -1);

  // Search "orthodontist" finds the dentist.
  click(window, document.getElementById("search-toggle-btn"));
  setInput(window, document.getElementById("site-search"), "orthodontist");
  submitForm(window, document.getElementById("site-search-form"));
  await waitFor(() => document.getElementById("app").textContent.indexOf("Orthodontist") !== -1, 3000, "orthodontist search");
  check("search orthodontist finds the dentist", document.getElementById("app").textContent.indexOf("Dentist, Orthodontist") !== -1);

  // Empty search lists everything.
  click(window, document.getElementById("search-toggle-btn"));
  setInput(window, document.getElementById("site-search"), "");
  submitForm(window, document.getElementById("site-search-form"));
  await waitFor(() => document.getElementById("app").textContent.indexOf("Showing 9 results") !== -1, 3000, "empty search results");
  check("empty search lists all 9 services and dentists", document.getElementById("app").textContent.indexOf("Showing 9 results") !== -1);

  // Back home, then book an appointment.
  const homeBack = document.querySelector("[data-back]");
  if (homeBack) click(window, homeBack);
  await waitFor(() => !!document.getElementById("booking-form"), 3000, "back home for booking");
  setInput(window, document.getElementById("bk-name"), "DOM Test");
  setInput(window, document.getElementById("bk-phone"), "03001234567");
  document.getElementById("bk-service").value = "teeth-cleaning";
  document.getElementById("bk-date").value = "2026-11-26";
  document.getElementById("bk-time").value = "11:00";
  submitForm(window, document.getElementById("booking-form"));
  await waitFor(() => document.getElementById("app").textContent.indexOf("Appointment requested") !== -1, 5000, "booking confirmation");
  check("booking form saves and shows Appointment requested", document.getElementById("app").textContent.indexOf("Appointment requested") !== -1);
  check("booking confirmation shows a CS appointment number", /CS-\d+/.test(document.getElementById("app").textContent));

  // Newsletter.
  setInput(window, document.getElementById("newsletter-email"), "dom-news-" + Date.now() + "@example.com");
  submitForm(window, document.getElementById("newsletter-form"));
  await waitFor(() => document.getElementById("newsletter-done").textContent.indexOf("You are on the list") !== -1, 5000, "newsletter confirmation");
  check("newsletter shows You are on the list", document.getElementById("newsletter-done").textContent.indexOf("You are on the list") !== -1);

  // About page.
  const aboutBtn = document.querySelector('[data-nav-page="about"]');
  if (aboutBtn) click(window, aboutBtn);
  await waitFor(() => document.getElementById("app").textContent.indexOf("About Our Clinic") !== -1, 3000, "about page");
  check("About page shows About Our Clinic and by Interlinkz", document.getElementById("app").textContent.indexOf("About Our Clinic") !== -1 && document.getElementById("app").textContent.indexOf("by Interlinkz") !== -1);

  // Contact page through history navigation.
  window.history.pushState({}, "", "/contact");
  window.dispatchEvent(new window.PopStateEvent("popstate"));
  await waitFor(() => !!document.getElementById("contact-form"), 3000, "contact form");
  check("Contact page shows the contact form", !!document.getElementById("contact-form"));
  setInput(window, document.getElementById("ct-name"), "DOM Test");
  setInput(window, document.getElementById("ct-email"), "dom-test@example.com");
  setInput(window, document.getElementById("ct-subject"), "DOM check");
  setInput(window, document.getElementById("ct-message"), "This is a DOM verification message.");
  submitForm(window, document.getElementById("contact-form"));
  await waitFor(() => document.getElementById("app").textContent.indexOf("Message sent") !== -1, 5000, "contact sent");
  check("contact form shows Message sent", document.getElementById("app").textContent.indexOf("Message sent") !== -1);

  // Mobile menu drawer.
  click(window, document.getElementById("menu-open-btn"));
  await waitFor(() => document.getElementById("drawer").classList.contains("open"), 2000, "drawer opens");
  const drawerText = (document.querySelector(".drawer-panel") || {}).textContent || "";
  check("menu drawer lists About, Contact and Admin Panel", drawerText.indexOf("About") !== -1 && drawerText.indexOf("Contact") !== -1 && drawerText.indexOf("Admin Panel") !== -1);

  check("no jsdom errors were recorded", dom.errors.length === 0, dom.errors.join("; "));

  window.close();

  // Admin Panel in its own DOM.
  const adminDom = await makeDom("/admin.html");
  const aWindow = adminDom.window;
  const aDocument = aWindow.document;
  await waitFor(() => aDocument.getElementById("admin-root").textContent.indexOf("Set up the Admin Panel") !== -1, 5000, "admin setup form");
  check("Admin Panel shows first-use setup", aDocument.getElementById("admin-root").textContent.indexOf("Set up the Admin Panel") !== -1);
  aDocument.getElementById("admin-email").value = "dom-admin@example.com";
  aDocument.getElementById("admin-password").value = "dom-pass-123";
  submitForm(aWindow, aDocument.getElementById("admin-auth-form"));
  await waitFor(() => aDocument.getElementById("admin-root").textContent.indexOf("Appointments") !== -1 && aDocument.getElementById("admin-root").textContent.indexOf("Messages") !== -1, 5000, "admin dashboard");
  check("Admin Panel dashboard shows Appointments, Messages and Subscribers stats", aDocument.getElementById("admin-root").textContent.indexOf("Appointments") !== -1 && aDocument.getElementById("admin-root").textContent.indexOf("Messages") !== -1 && aDocument.getElementById("admin-root").textContent.indexOf("Subscribers") !== -1);
  check("Admin Panel dashboard lists the booked appointment", /CS-\d+/.test(aDocument.getElementById("admin-root").textContent));

  // Wrong password is rejected on the sign in form.
  click(aWindow, aDocument.getElementById("sign-out-btn"));
  await waitFor(() => aDocument.getElementById("admin-root").textContent.indexOf("Admin sign in") !== -1, 5000, "admin sign in form");
  aDocument.getElementById("admin-email").value = "dom-admin@example.com";
  aDocument.getElementById("admin-password").value = "wrong-password";
  submitForm(aWindow, aDocument.getElementById("admin-auth-form"));
  await waitFor(() => {
    const err = aDocument.getElementById("admin-error");
    return err && err.style.display !== "none" && err.textContent.length > 0;
  }, 5000, "wrong password error");
  check("Admin Panel shows an error for a wrong password", (aDocument.getElementById("admin-error") || {}).textContent.indexOf("Wrong email or password") !== -1);
  aWindow.close();

  console.log("\n" + checks + " checks, " + failures + " failed.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("DOM check failed:", err.message);
  process.exit(1);
});
