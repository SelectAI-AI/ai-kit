# Certificate assets

Drop the certificate background image here so `certificate.py` can use it as the
full-page template.

## Expected file

```
certificate_template.jpeg
```

- Any raster format works if you update `template_file` in `certificate_layout.json`
  (`.jpeg`, `.jpg`, `.png`).
- The page size of the generated PDF is derived from the image's aspect ratio
  (see `page` in `certificate_layout.json`). A landscape image (~A4 landscape,
  e.g. 3508 x 2480 px @ 300dpi) is recommended.

## If this file is absent

`generate_certificate_pdf(...)` falls back to the legacy hard-coded reportlab
layout, so certificate issuance never breaks while you are sourcing the artwork.

## Tuning placement

All field positions, fonts and colors live in
`backend/app/certificate_layout.json`. Coordinates are **fractions** of the page
(0.0–1.0, origin at the bottom-left, reportlab convention), so they stay correct
regardless of the image's pixel resolution.

Set `"debug_placeholders": true` in the layout JSON to render outlined boxes and
labels at every field location. Generate one certificate, eyeball the boxes,
nudge the fractions, then set it back to `false`.
