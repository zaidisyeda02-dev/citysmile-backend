"use strict";

/* CitySmile Dental frontend. Single page app for the Design 01
   landing page: hero, services, about, dentists, patient stories,
   booking form and contact. Services and dentists load from the API.
   Detail pages open with direct click plus pushState, with a
   breadcrumb and a back link. All storage access is guarded so the
   page can never crash on a blocked storage read. */

var INTRO_KEY = "citysmile-intro-seen";

function storageGet(key) {
  try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { window.sessionStorage.setItem(key, value); } catch (e) {}
}

var services = [];
var dentists = [];
var dataLoaded = false;
var dataPromise = null;

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(message) {
  var root = document.getElementById("toast-root");
  if (!root) return;
  var el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  root.appendChild(el);
  window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
}

function api(path, options) {
  var opts = options || {};
  opts.headers = { "Content-Type": "application/json" };
  return fetch(path, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (body) {
      if (!r.ok) throw new Error(body.error || "Request failed");
      return body;
    });
  });
}

function loadData() {
  if (dataPromise) return dataPromise;
  dataPromise = Promise.all([
    fetch("/api/services").then(function (r) { return r.json(); }),
    fetch("/api/dentists").then(function (r) { return r.json(); })
  ]).then(function (parts) {
    services = Array.isArray(parts[0]) ? parts[0] : [];
    dentists = Array.isArray(parts[1]) ? parts[1] : [];
    dataLoaded = true;
  }).catch(function () {
    services = [];
    dentists = [];
    dataLoaded = true;
  });
  return dataPromise;
}

function serviceById(id) {
  for (var i = 0; i < services.length; i++) if (services[i].id === id) return services[i];
  return null;
}
function dentistById(id) {
  for (var i = 0; i < dentists.length; i++) if (dentists[i].id === id) return dentists[i];
  return null;
}

/* ---------- intro ---------- */
function showIntro() {
  var root = document.getElementById("intro-root");
  if (!root) return;
  if (storageGet(INTRO_KEY)) return;
  root.innerHTML =
    '<div class="intro" id="intro">' +
    '<div class="intro-tooth" aria-hidden="true">&#x1F9B7;</div>' +
    '<p class="intro-word">CITYSMILE DENTAL</p>' +
    '<div class="intro-line"></div>' +
    '<p class="intro-tag">Your Smile, Our Passion</p>' +
    '<p class="intro-by">by Interlinkz</p>' +
    '<button type="button" class="intro-skip" id="intro-skip">Skip intro</button>' +
    "</div>";
  var done = false;
  function dismiss() {
    if (done) return;
    done = true;
    storageSet(INTRO_KEY, "1");
    var el = document.getElementById("intro");
    if (el) {
      el.classList.add("lift");
      window.setTimeout(function () { root.innerHTML = ""; }, 650);
    } else {
      root.innerHTML = "";
    }
  }
  var skip = document.getElementById("intro-skip");
  if (skip) skip.addEventListener("click", dismiss);
  window.setTimeout(dismiss, 2600);
  window.setTimeout(function () {
    var el = document.getElementById("intro");
    if (el && !done) dismiss();
  }, 5000);
}

/* ---------- routing ---------- */
function scrollToTop() {
  var top = document.getElementById("top");
  if (top && top.scrollIntoView) top.scrollIntoView();
  try { window.scrollTo(0, 0); } catch (e) {}
  var main = document.getElementById("app");
  if (main) main.scrollTop = 0;
}

function go(path) {
  window.history.pushState({}, "", path);
  render();
}

function route() {
  var path = window.location.pathname;
  var m = path.match(/^\/service\/([\w-]+)$/);
  if (m) return { page: "service", id: m[1] };
  m = path.match(/^\/dentist\/([\w-]+)$/);
  if (m) return { page: "dentist", id: m[1] };
  if (path === "/about") return { page: "about" };
  if (path === "/contact") return { page: "contact" };
  if (path === "/search") return { page: "search", q: new URLSearchParams(window.location.search).get("q") || "" };
  return { page: "home" };
}

function serviceCard(s) {
  return '<article class="card">' +
    '<div class="card-photo service"><img src="' + esc(s.image) + '" alt="' + esc(s.name) + '" loading="lazy" style="object-position:' + esc(s.focal || "center 40%") + '" /></div>' +
    '<div class="card-body"><h3>' + esc(s.name) + '</h3><p>' + esc(s.description) + '</p>' +
    '<div class="card-links"><button type="button" class="btn btn-primary" data-open-service="' + esc(s.id) + '">View Details</button>' +
    '<button type="button" class="link-more" data-open-service="' + esc(s.id) + '">Learn More</button></div></div></article>';
}

function dentistCard(d) {
  return '<article class="card">' +
    '<div class="card-photo person"><img src="' + esc(d.image) + '" alt="Dentist, ' + esc(d.role) + '" loading="lazy" style="object-position:' + esc(d.focal || "center 30%") + '" /></div>' +
    '<div class="card-body"><p class="role">Dentist</p><h3>' + esc(d.role) + '</h3><p>' + esc(d.focus) + '</p>' +
    '<div class="card-links"><button type="button" class="btn btn-primary" data-open-dentist="' + esc(d.id) + '">View Details</button>' +
    '<button type="button" class="link-more" data-open-dentist="' + esc(d.id) + '">Learn More</button></div></div></article>';
}

function homeHtml() {
  var serviceCards = services.map(serviceCard).join("");
  var dentistCards = dentists.map(dentistCard).join("");
  var stories = [
    { img: "/images/story-1.jpg", alt: "Smiling woman with curly hair", quote: "The staff was incredibly gentle and kind", focal: "center 30%" },
    { img: "/images/story-2.jpg", alt: "Smiling older man with grey hair", quote: "Best dental experience I have had", focal: "center 35%" },
    { img: "/images/story-3.jpg", alt: "Smiling young man", quote: "Warm and welcoming environment", focal: "center 25%" }
  ];
  var storyCards = stories.map(function (st) {
    return '<article class="card"><div class="card-photo person"><img src="' + st.img + '" alt="' + esc(st.alt) + '" loading="lazy" style="object-position:' + st.focal + '" /></div>' +
      '<div class="card-body"><div class="stars" aria-label="Five out of five stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>' +
      '<p class="quote">&ldquo;' + esc(st.quote) + '&rdquo;</p></div></article>';
  }).join("");
  var serviceOptions = services.map(function (s) {
    return '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>";
  }).join("");
  return '' +
  '<div class="hero"><div class="wrap hero-inner">' +
    '<div class="cs-fade-up"><h1>Your Smile,<br />Our Passion</h1>' +
    '<p class="lead">Modern, gentle dental care for the whole family</p>' +
    '<a href="#booking" class="btn btn-primary" data-nav="booking">Book Appointment</a></div>' +
    '<div class="hero-photo"><img src="/images/hero.jpg" alt="Smiling woman in a dental chair with her dentist" /></div>' +
  "</div></div>" +
  '<section class="block" id="services"><div class="wrap"><h2>Our Dental Services</h2>' +
  '<p class="sec-sub">Six treatments, one calm clinic.</p>' +
  '<div class="grid cols-3 cs-stagger">' + serviceCards + "</div></div></section>" +
  '<section class="block" id="about" style="background:var(--sky-pale)"><div class="wrap about-inner">' +
    '<div class="about-photo"><img src="/images/about.jpg" alt="Modern dental clinic treatment room" loading="lazy" /></div>' +
    '<div class="about-copy"><h2>About Our Clinic</h2><h3 style="margin:.5rem 0">Comprehensive dental care using advanced technology</h3>' +
    '<p>CitySmile Dental offers checkups, cleaning, whitening, braces and aligners, implants and root canal care, in one bright, calm space. Our team explains every step before it happens, so you always know what comes next.</p>' +
    '<p>CitySmile Dental is a clinic by Interlinkz.</p>' +
    '<button type="button" class="btn btn-outline" data-nav-page="about">Explore Our Practice</button></div>' +
  "</div></section>" +
  '<section class="block" id="dentists"><div class="wrap"><h2>Meet Our Team</h2>' +
  '<p class="sec-sub">Three dentists, each with a clear focus.</p>' +
  '<div class="grid cols-3 cs-stagger">' + dentistCards + "</div></div></section>" +
  '<section class="block" id="stories"><div class="wrap"><h2>Patient Stories</h2>' +
  '<p class="sec-sub">What a visit to CitySmile Dental feels like.</p>' +
  '<div class="grid cols-3 cs-stagger">' + storyCards + "</div>" +
  '<p class="fine-note">These stories are samples shown for layout. Real patient reviews have not been provided yet.</p>' +
  "</div></section>" +
  '<section class="block" id="booking"><div class="wrap"><div class="booking-wrap">' +
  '<h2 style="text-align:center">Schedule Your Visit</h2>' +
  '<p style="text-align:center;color:var(--mut)">Choose a service, a date and a time, and we will confirm your visit.</p>' +
  '<form id="booking-form" novalidate><div class="form-grid">' +
  '<div><label class="field-label" for="bk-name">Name</label><input id="bk-name" class="field-input" type="text" autocomplete="name" /></div>' +
  '<div><label class="field-label" for="bk-phone">Phone</label><input id="bk-phone" class="field-input" type="tel" autocomplete="tel" /></div>' +
  '<div><label class="field-label" for="bk-service">Service</label><select id="bk-service" class="field-input">' + serviceOptions + "</select></div>" +
  '<div class="form-grid two"><div><label class="field-label" for="bk-date">Date</label><input id="bk-date" class="field-input" type="date" /></div>' +
  '<div><label class="field-label" for="bk-time">Time</label><input id="bk-time" class="field-input" type="time" /></div></div>' +
  '<p id="booking-error" class="form-error" role="alert" style="display:none"></p>' +
  '<button type="submit" class="btn btn-primary" style="width:100%">Book Appointment</button>' +
  '<div id="booking-done" style="display:none"></div>' +
  "</div></form></div></div></section>";
}

function serviceDetailHtml(s) {
  var covers = s.covers.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
  var related = services.filter(function (x) { return x.id !== s.id; }).slice(0, 3).map(serviceCard).join("");
  return '<div class="wrap"><p class="crumbs"><a href="/" data-nav="home">Home</a> / <a href="/#services" data-nav="services">Services</a> / ' + esc(s.name) + "</p>" +
    '<div class="detail-banner"><img src="' + esc(s.image) + '" alt="' + esc(s.name) + '" style="object-position:' + esc(s.focal || "center 40%") + '" /></div>' +
    '<div class="detail-body"><h1>' + esc(s.name) + '</h1><p>' + esc(s.description) + '</p>' +
    "<h2>What this visit covers</h2><ul>" + covers + "</ul>" +
    "<h2>Good to know</h2><p>" + esc(s.goodToKnow) + "</p>" +
    '<a href="/#booking" class="btn btn-primary" data-nav="booking">Book Appointment</a> ' +
    '<button type="button" class="back-link" data-back>Back to Services</button>' +
    '<h2 style="margin-top:2rem">Other services</h2></div>' +
    '<div class="grid cols-3 cs-stagger" style="padding-bottom:2.5rem">' + related + "</div></div>";
}

function dentistDetailHtml(d) {
  var care = d.care.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
  var others = dentists.filter(function (x) { return x.id !== d.id; }).map(dentistCard).join("");
  return '<div class="wrap"><p class="crumbs"><a href="/" data-nav="home">Home</a> / <a href="/#dentists" data-nav="dentists">Dentists</a> / ' + esc(d.role) + "</p>" +
    '<div class="detail-banner"><img src="' + esc(d.image) + '" alt="Dentist, ' + esc(d.role) + '" style="object-position:' + esc(d.focal || "center 30%") + '" /></div>' +
    '<div class="detail-body"><p class="role">Dentist</p><h1>' + esc(d.role) + '</h1>' +
    "<p><strong>Dentist name:</strong> Not provided yet</p>" +
    "<p>" + esc(d.description) + "</p>" +
    "<h2>Care focus</h2><p>" + esc(d.focus) + "</p>" +
    "<h2>What this dentist looks after</h2><ul>" + care + "</ul>" +
    '<a href="/#booking" class="btn btn-primary" data-nav="booking">Book Appointment</a> ' +
    '<button type="button" class="back-link" data-back>Back to Dentists</button>' +
    '<h2 style="margin-top:2rem">Other dentists</h2></div>' +
    '<div class="grid cols-3 cs-stagger" style="padding-bottom:2.5rem">' + others + "</div></div>";
}

function aboutHtml() {
  return '<div class="wrap"><p class="crumbs"><a href="/" data-nav="home">Home</a> / About</p>' +
    '<div class="detail-banner"><img src="/images/about.jpg" alt="Modern dental clinic treatment room" style="object-position:55% 40%" /></div>' +
    '<div class="detail-body"><h1>About Our Clinic</h1>' +
    "<h2>Comprehensive dental care using advanced technology</h2>" +
    "<p>CitySmile Dental offers checkups, cleaning, whitening, braces and aligners, implants and root canal care, in one bright, calm space. Our team explains every step before it happens, so you always know what comes next.</p>" +
    "<p>CitySmile Dental is a clinic by Interlinkz.</p>" +
    "<h2>Contact details</h2><p>Phone: Not provided yet<br />Email: Not provided yet<br />Address: Not provided yet<br />Opening Hours: Not provided yet</p>" +
    '<a href="/#booking" class="btn btn-primary" data-nav="booking">Book Appointment</a> ' +
    '<button type="button" class="back-link" data-back>Back to Home</button></div></div>';
}

function contactHtml() {
  return '<div class="wrap"><p class="crumbs"><a href="/" data-nav="home">Home</a> / Contact</p>' +
    '<div class="detail-body"><h1>Contact</h1>' +
    "<p>Phone: Not provided yet<br />Email: Not provided yet<br />Address: Not provided yet<br />Opening Hours: Not provided yet</p>" +
    '<h2>Send us a message</h2>' +
    '<form id="contact-form" novalidate><div class="form-grid">' +
    '<div><label class="field-label" for="ct-name">Name</label><input id="ct-name" class="field-input" type="text" /></div>' +
    '<div><label class="field-label" for="ct-email">Email</label><input id="ct-email" class="field-input" type="email" /></div>' +
    '<div><label class="field-label" for="ct-subject">Subject</label><input id="ct-subject" class="field-input" type="text" /></div>' +
    '<div><label class="field-label" for="ct-message">Message</label><textarea id="ct-message" class="field-input" rows="4"></textarea></div>' +
    '<p id="contact-error" class="form-error" role="alert" style="display:none"></p>' +
    '<button type="submit" class="btn btn-primary">Send Message</button>' +
    '<p id="contact-done" style="display:none"></p>' +
    "</div></form>" +
    '<button type="button" class="back-link" data-back>Back to Home</button></div></div>';
}

function searchItems(q) {
  var needle = q.trim().toLowerCase();
  var out = [];
  if (!needle) {
    services.forEach(function (s) { out.push({ kind: "Service", title: s.name, sub: s.short, img: s.image, focal: s.focal, href: "/service/" + s.id }); });
    dentists.forEach(function (d) { out.push({ kind: "Dentist", title: "Dentist, " + d.role, sub: d.focus, img: d.image, focal: d.focal, href: "/dentist/" + d.id }); });
    return out;
  }
  services.forEach(function (s) {
    var hay = (s.name + " " + s.short + " " + s.category + " " + s.description).toLowerCase();
    if (hay.indexOf(needle) !== -1) out.push({ kind: "Service", title: s.name, sub: s.short, img: s.image, focal: s.focal, href: "/service/" + s.id });
  });
  dentists.forEach(function (d) {
    var hay = ("dentist " + d.role + " " + d.focus + " " + d.description).toLowerCase();
    if (hay.indexOf(needle) !== -1) out.push({ kind: "Dentist", title: "Dentist, " + d.role, sub: d.focus, img: d.image, focal: d.focal, href: "/dentist/" + d.id });
  });
  return out;
}

function searchHtml(q) {
  var items = searchItems(q);
  var list = items.map(function (it) {
    return '<li><a class="search-hit" href="' + it.href + '" data-search-go="' + it.href + '"><img src="' + esc(it.img) + '" alt="" style="object-position:' + esc(it.focal || "center 40%") + '" /><span><span class="t">' + esc(it.title) + '</span><br /><span class="s">' + esc(it.kind) + " - " + esc(it.sub) + "</span></span></a></li>";
  }).join("");
  return '<div class="wrap"><p class="crumbs"><a href="/" data-nav="home">Home</a> / Search</p>' +
    '<div class="detail-body"><h1>Search results for &ldquo;' + esc(q) + "&rdquo;</h1>" +
    (items.length === 0
      ? '<p class="empty">No services or dentists match that search. Try a service name such as Teeth Cleaning, or a role such as Orthodontist.</p>'
      : '<p>Showing ' + items.length + ' result' + (items.length === 1 ? "" : "s") + '.</p>') +
    "</div>" +
    (items.length ? '<div class="search-results" style="padding-bottom:2.5rem"><ul>' + list + "</ul></div>" : "") +
    '<p style="padding-bottom:2.5rem"><button type="button" class="back-link" data-back>Back to Home</button></p></div>';
}

function renderSearchBar(q) {
  var box = document.getElementById("search-results");
  if (!box) return;
  var items = searchItems(q);
  if (!q.trim()) { box.innerHTML = ""; return; }
  var html = items.slice(0, 6).map(function (it) {
    return '<li><a class="search-hit" href="' + it.href + '" data-search-go="' + it.href + '"><img src="' + esc(it.img) + '" alt="" style="object-position:' + esc(it.focal || "center 40%") + '" /><span><span class="t">' + esc(it.title) + '</span><br /><span class="s">' + esc(it.kind) + " - " + esc(it.sub) + "</span></span></a></li>";
  }).join("");
  box.innerHTML = items.length ? "<ul>" + html + "</ul>" : '<p class="empty">No matches. Press Search to see the full results page.</p>';
}

function wirePage() {
  var app = document.getElementById("app");
  app.querySelectorAll("[data-open-service]").forEach(function (el) {
    el.addEventListener("click", function () { go("/service/" + el.getAttribute("data-open-service")); });
  });
  app.querySelectorAll("[data-open-dentist]").forEach(function (el) {
    el.addEventListener("click", function () { go("/dentist/" + el.getAttribute("data-open-dentist")); });
  });
  app.querySelectorAll("[data-back]").forEach(function (el) {
    el.addEventListener("click", function () { go("/"); });
  });
  app.querySelectorAll("[data-nav-page]").forEach(function (el) {
    el.addEventListener("click", function () { go("/" + el.getAttribute("data-nav-page")); });
  });
  app.querySelectorAll("[data-search-go]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      closeSearch();
      go(el.getAttribute("data-search-go"));
    });
  });
  var booking = document.getElementById("booking-form");
  if (booking) {
    booking.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = document.getElementById("booking-error");
      var done = document.getElementById("booking-done");
      err.style.display = "none";
      var body = {
        patientName: document.getElementById("bk-name").value.trim(),
        phone: document.getElementById("bk-phone").value.trim(),
        serviceId: document.getElementById("bk-service").value,
        date: document.getElementById("bk-date").value,
        time: document.getElementById("bk-time").value
      };
      if (body.patientName.length < 2) { err.textContent = "Please enter your name."; err.style.display = "block"; return; }
      if (body.phone.replace(/[^0-9]/g, "").length < 7) { err.textContent = "Please enter a phone number."; err.style.display = "block"; return; }
      if (!body.date) { err.textContent = "Please choose a date."; err.style.display = "block"; return; }
      if (!body.time) { err.textContent = "Please choose a time."; err.style.display = "block"; return; }
      api("/api/appointments", { method: "POST", body: JSON.stringify(body) })
        .then(function (res) {
          done.innerHTML = '<div class="form-ok"><strong>Appointment requested</strong>Your appointment number is ' + esc(res.appointmentNumber) + ' for ' + esc(res.serviceName) + '. We will confirm your visit.</div>';
          done.style.display = "block";
          booking.reset();
          toast("Appointment requested");
        })
        .catch(function (e2) { err.textContent = e2.message; err.style.display = "block"; });
    });
  }
  var contact = document.getElementById("contact-form");
  if (contact) {
    contact.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = document.getElementById("contact-error");
      var done = document.getElementById("contact-done");
      err.style.display = "none";
      var body = {
        name: document.getElementById("ct-name").value.trim(),
        email: document.getElementById("ct-email").value.trim(),
        subject: document.getElementById("ct-subject").value.trim(),
        message: document.getElementById("ct-message").value.trim()
      };
      api("/api/contact", { method: "POST", body: JSON.stringify(body) })
        .then(function () {
          done.innerHTML = '<div class="form-ok"><strong>Message sent</strong>Thank you. We will get back to you.</div>';
          done.style.display = "block";
          contact.reset();
        })
        .catch(function (e2) { err.textContent = e2.message; err.style.display = "block"; });
    });
  }
}

function render() {
  var app = document.getElementById("app");
  var r = route();
  loadData().then(function () {
    if (r.page === "service") {
      var s = serviceById(r.id);
      app.innerHTML = s ? serviceDetailHtml(s) : '<p class="empty">That service was not found.</p><p style="text-align:center"><button type="button" class="back-link" data-back>Back to Home</button></p>';
    } else if (r.page === "dentist") {
      var d = dentistById(r.id);
      app.innerHTML = d ? dentistDetailHtml(d) : '<p class="empty">That dentist was not found.</p><p style="text-align:center"><button type="button" class="back-link" data-back>Back to Home</button></p>';
    } else if (r.page === "about") {
      app.innerHTML = aboutHtml();
    } else if (r.page === "contact") {
      app.innerHTML = contactHtml();
    } else if (r.page === "search") {
      app.innerHTML = searchHtml(r.q);
    } else {
      app.innerHTML = homeHtml();
    }
    wirePage();
    scrollToTop();
    var hash = window.location.hash;
    if (r.page === "home" && hash) {
      var target = document.querySelector(hash);
      if (target) target.scrollIntoView();
    }
  });
}

function closeSearch() {
  var bar = document.getElementById("search-bar");
  if (bar) bar.classList.remove("open");
  var box = document.getElementById("search-results");
  if (box) box.innerHTML = "";
}

function wireChrome() {
  document.querySelectorAll("[data-nav]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      var href = el.getAttribute("href") || "";
      if (href.indexOf("/#") === 0) {
        e.preventDefault();
        closeDrawer();
        closeSearch();
        if (window.location.pathname !== "/") {
          window.history.pushState({}, "", "/");
          render();
          window.setTimeout(function () {
            var target = document.querySelector(href.slice(1));
            if (target) target.scrollIntoView();
          }, 50);
        } else {
          var target = document.querySelector(href.slice(1));
          if (target) target.scrollIntoView();
        }
        return;
      }
      if (href === "/") {
        e.preventDefault();
        closeDrawer();
        closeSearch();
        go("/");
      }
    });
  });
  var toggle = document.getElementById("search-toggle-btn");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var bar = document.getElementById("search-bar");
      bar.classList.toggle("open");
      if (bar.classList.contains("open")) {
        var input = document.getElementById("site-search");
        if (input) input.focus();
      }
    });
  }
  var input = document.getElementById("site-search");
  if (input) {
    input.addEventListener("input", function () { renderSearchBar(input.value); });
  }
  var form = document.getElementById("site-search-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = document.getElementById("site-search").value;
      closeSearch();
      go("/search?q=" + encodeURIComponent(q));
    });
  }
  var news = document.getElementById("newsletter-form");
  if (news) {
    news.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("newsletter-email").value.trim();
      var done = document.getElementById("newsletter-done");
      api("/api/newsletter", { method: "POST", body: JSON.stringify({ email: email }) })
        .then(function () {
          done.textContent = "You are on the list. Thank you.";
          news.reset();
        })
        .catch(function (e2) { done.textContent = e2.message; });
    });
  }
}

function closeDrawer() {
  var d = document.getElementById("drawer");
  if (d) { d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); }
}

function wireDrawer() {
  var open = document.getElementById("menu-open-btn");
  var close = document.getElementById("drawer-close");
  var back = document.getElementById("drawer-back");
  var drawer = document.getElementById("drawer");
  if (open) open.addEventListener("click", function () {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
  });
  if (close) close.addEventListener("click", closeDrawer);
  if (back) back.addEventListener("click", closeDrawer);
  drawer.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { closeDrawer(); });
  });
}

window.addEventListener("popstate", render);
showIntro();
wireChrome();
wireDrawer();
render();
