# Theo's Date Night

Date night ideas for Tom & Cat (TomCat), dealt by Theo the cat.
Live at https://tomkeogh98.github.io/theo/

Pick a mood, where, how long, budget and whose turn it is. Theo deals three postcards.
Choose one, read the plan and the "ask each other" question, then go and do it. The date
diary (stored in this browser only) tracks dates done and a weekly streak.

- `js/ideas.js`: all 94 hand-written ideas (edit or add here). An idea with a `go` field suggests a real place.
- `js/places.js`: 77 real places within a short drive, each with tags, coordinates and an `isNew` flag. Home is deliberately approximate.
- `js/locale.js`: where Theo is looking. Home uses `places.js`. Anywhere else (Use my location, or a search via Nominatim) pulls real places live from OpenStreetMap's Overpass API, cached in the browser for 14 days.
- `js/map.js`: the Leaflet map (OpenStreetMap tiles), picking a place for an idea, and the "also around here" popups
- `js/picker.js`: filtering and weighted shuffle
- `js/theo.js`: Theo's SVG and lines (`img/theo.svg` is a copy, so keep them in sync)
- `js/store.js`: diary in localStorage
- `js/app.js`: UI

Plain HTML, CSS and ES modules, with no build step. On release, bump `?v=N` everywhere:
`sed -i '' 's/?v=1/?v=2/g' index.html js/*.js`
