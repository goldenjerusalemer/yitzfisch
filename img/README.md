Drop gallery photos here (JPG, PNG or TIFF, any size). A GitHub Action converts
each one to a 2000px WebP within about a minute and removes the original, so the
repo only holds web copies and the full-resolution file never goes online.
Put the resulting filename (e.g. old-city-dusk.webp) in the `file` column of the
Photos sheet. Netlify Image CDN serves them resized per screen.


Always reference the `.webp` in `site.js` (or `photos.csv`), never the original JPG/PNG. Keep filenames unique: Netlify serves `/img/*` with immutable year-long caching, so a changed photo needs a new filename.
