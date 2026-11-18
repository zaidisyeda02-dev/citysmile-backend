# CitySmile Dental, backend rebuild

A portable Express and MySQL rebuild of the CitySmile Dental clinic
landing page, ready to deploy as a live website with a real backend
and Admin Panel.

## Design

Design 01, Bright Sky-Blue and White Clinic, from the CitySmile
Dental design stage: airy white layout, sky-blue headers and buttons,
curved blue shapes, clean sans-serif, large hero photo, hero line
"Your Smile, Our Passion".

The landing page has 7 sections in order:

1. Hero and Homepage, "Your Smile, Our Passion", Book Appointment button
2. Services and Treatments, 6 services
3. About the Clinic, "Comprehensive dental care using advanced technology"
4. Our Dentists, Meet Our Team, 3 dentists
5. Patient Testimonials, Patient Stories, 3 cards
6. Appointment Booking Form, Schedule Your Visit
7. Contact and Hours footer

Every service and every dentist has a detail page with a photo,
breadcrumb and back link. Opening animation with "by Interlinkz" and
Skip intro. Interlinkz appears on the opening animation, the footer
brand block, the bottom strip ("CitySmile Dental by Interlinkz") and
the About page. Header search and menu work, search covers name,
category and description with live photo suggestions. Mobile picture
framing: stories and dentist cards 4/3, service cards 16/10, detail
banners 4/3 on phones, each photo with its own focal point so faces
stay fully visible. Content is fully visible on load. No em dash
anywhere, no banned AI phrases.

Contact details, dentist names, testimonials and opening hours are
placeholders marked "Not provided yet". They were not provided by the
client and are never presented as real facts. The 3 dentists are
listed by role only: General and Cosmetic, Orthodontist, Pediatric
Specialist. Testimonials are marked as samples shown for layout.

## Photo provenance

The 14 photos (hero, 6 services, About, 3 dentists, 3 patient
stories) are stock photos sourced for the same subjects they show.
See `PHOTO-SOURCES.md` for every source page. They are not photos of
the real clinic, staff or patients. The clinic had no live static
export to copy photos from, and the Muse artifact source was off
limits for this rebuild, so matching stock photos were sourced
instead. All files were re-encoded to JPEG, quality 82, longest side
capped at 1600px, which strips all EXIF, IPTC, XMP and C2PA metadata.
A byte scan on 2026-11-19 found no metadata markers in any file.

## Backend

Node.js with Express and MySQL (mysql2). The frontend is served from
`public/`, and the API is at `/api/*`.

MySQL tables, in `db/schema.sql`:

- `services`: the 6 services, seeded from `db/seed-services.json`
- `dentists`: the 3 dentists by role, seeded from `db/seed-services.json`
- `appointments`: bookings from the booking form, numbers CS-1001 onward
- `subscribers`: newsletter signups
- `messages`: contact form messages
- `admins`: Admin Panel accounts, scrypt salted password hashes
- `sessions`: 30 day admin session tokens

API endpoints:

- `GET /api/health`
- `GET /api/services`, `GET /api/services/:id`
- `GET /api/dentists`, `GET /api/dentists/:id`
- `POST /api/appointments` (name, phone, service, date YYYY-MM-DD, time HH:MM, server validated)
- `POST /api/newsletter`
- `POST /api/contact`
- `GET /api/admin/status`, `POST /api/admin/setup`, `POST /api/admin/signin`, `POST /api/admin/signout`
- `GET /api/admin/data`, `PATCH /api/admin/appointments/:id`, `PATCH /api/admin/messages/:id`

Admin Panel is at `/admin.html`. First use, the owner sets her own
email and password (at least 8 characters). A second setup is
refused, a wrong password is rejected. The panel shows live stats for
Appointments, Messages and Subscribers, with tabs for each, and
appointment and message status changes persist.

## Environment

All credentials come from environment variables only, never from
hardcoded values. Copy `.env.example` to `.env` and fill it in.

- `PORT` (default 3001)
- `DB_HOST` (default 127.0.0.1)
- `DB_PORT` (default 3306)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

`.env` is gitignored and must not be committed.

## Run locally

```bash
npm install
cp .env.example .env   # fill in your own database user and password
mysql -u root -e "CREATE DATABASE IF NOT EXISTS citysmile CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
node server.js
```

Then open http://127.0.0.1:3001 and http://127.0.0.1:3001/admin.html.

## Verify

```bash
node scripts/verify.js    # API end to end check against the running server
node scripts/dom-check.js # jsdom DOM execution check against the running server
```

Results on 2026-11-19, local MariaDB, clean database, server on
port 3001:

- verify.js: 54 checks, 0 failed.
- dom-check.js: 46 checks, 0 failed.

Local test data was cleared after verification: 0 appointments, 0
subscribers, 0 messages, 0 admins, hasAdmin false.

## Deploy to Hostinger

1. Push this project to GitHub. A repo named `citysmile-backend`
   does not exist yet and must be created first, the same way the
   Threadora repo was created: the owner creates the empty public
   repo in the browser, because a GitHub App token cannot create a
   repository under a personal account.
2. In Hostinger hPanel, create a Web App with Node.js 22, pointing at
   the repo, start command `node server.js`.
3. Create a MySQL database and user in hPanel, then set the
   environment variables in the Web App: `PORT`, `DB_HOST`, `DB_PORT`,
   `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
4. After the first deploy, open the live site and the Admin Panel,
   set up the admin account, book a test appointment and check the
   Admin Panel shows it, then clear the test data.

## Still open

- Real rendered browser check at 390px for horizontal overflow and
  console errors. No browser could be launched locally, so this is
  still open before any live deploy, the same as the Threadora and
  GlowSkin rebuilds at this stage.
- GitHub repo creation and push, Hostinger Web App, MySQL and env
  vars, then a live end to end verification.
