# CitySmile Dental, photo sources

Every photo in `public/images/` is a stock photo sourced for the same
subject it shows. No photo is claimed to be a photo of the real
CitySmile Dental clinic, its staff, or its patients, because no client
photos were provided. The clinic had no live static export to copy
photos from, and the Muse artifact source was off limits for this
rebuild, so matching stock photos were sourced instead for the same
14 subjects.

All 14 files were re-encoded to JPEG, quality 82, longest side capped
at 1600px, which strips all EXIF, IPTC, XMP and C2PA metadata. A byte
scan on 2026-11-19 found no metadata markers in any file.

| File | Subject | Source page |
|---|---|---|
| `hero.jpg` | Woman smiling in a dental chair | https://omnipremier.com/wp-content/uploads/2022/08/female-dental-patient-smiling.jpg |
| `general-checkup.jpg` | Dentist examining a woman | https://dentalcaregroup.com.au/wp-content/uploads/2021/05/dentist-armadale-1024x685.jpg |
| `teeth-cleaning.jpg` | Dentist cleaning a male patient | https://brightsmile.ae/wp-content/uploads/2023/02/Dental-Hygiene.jpg |
| `teeth-whitening.jpg` | Close-up of a bright white smile | https://static.royacdn.com/Site-6dfdbfc9-bf0c-4cf4-815b-ef3b2e8ceba2/whitening/teeth_whitening_11.jpg |
| `braces-aligners.jpg` | Woman holding a clear aligner | https://dentalhealthandwellnessboston.com/wp-content/uploads/2021/12/invisalign-1.jpg |
| `dental-implants.jpg` | Dental implant model in gloved hands | https://static.bookinghealth.com/image/6811e4a7be71f.jpg |
| `root-canal.jpg` | Dentist treating a patient | https://dentalparadiso.com.au/wp-content/uploads/2024/10/Dental-paradiso-Gummy-Smiles-06.webp |
| `about.jpg` | Modern clinic interior with a dental chair | https://exposay.co/wp-content/uploads/2024/04/Modern-dental-clinic.webp |
| `dentist-general.jpg` | Female dentist in scrubs, seated | https://newarkdental.com/wp-content/uploads/2025/08/Services_1055433782.jpg |
| `dentist-orthodontist.jpg` | Male dentist in blue scrubs, arms crossed | https://luviashop.com/cdn/shop/files/male-dentist_1.webp |
| `dentist-pediatric.jpg` | Female dentist in a white coat, smiling | https://orsclinic.com/wp-content/uploads/2024/05/beautiful-female-dentist-portrait-VVA6T8L.jpg |
| `story-1.jpg` | Curly-haired woman smiling | https://res.halfphoto.com/smiling_woman_with_curly_hair.jpg |
| `story-2.jpg` | Older man with grey hair and a white beard | https://myalcon.com/cdn/old-man-smiling.png |
| `story-3.jpg` | Young man smiling, full face | https://cdn.shopify.com/s/files/1/0605/3764/2380/files/smiling-man-portrait_1410957-53268.avif |

Focal points (from the contact sheet review, 2026-11-19) are stored in
`db/seed-services.json` and used as the CSS object-position for each
photo, so faces stay fully visible and are not cropped at phone width.
