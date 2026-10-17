# Theo's Date Night

Date night ideas for Tom & Cat (TomCat), dealt by Theo the cat.
Live at https://tomkeogh98.github.io/theo/

Pick when, a mood, where, how long, budget and whose turn it is. Theo deals three postcards.
Going out, at least two are dates you could only have where you are, composed from what's
around you: an anchor (a walk to somewhere worth it, what the place is known for, a show
that's on) plus a pairing (a well-rated independent café, pub or restaurant open when you'll
want it), a reason it suits you two (your interests, the season, the weather), and timings
that work from right now.
Choose one, read the plan and the "ask each other" question, then go and do it. The date
diary (stored in this browser only) tracks dates done and a weekly streak.

- `js/ideas.js`: all 147 hand-written ideas (edit or add here). Each has moods, a setting (`in` / `outdoor` / `venue` / `out` for either), time, cost and interests; a `go` field suggests a real place.
- `js/interests.js`: the interest list and Tom's and Cat's defaults (editable on the site via "Our interests")
- `js/places.js`: 77 real places within a short drive, each with tags, coordinates and an `isNew` flag. Home is deliberately approximate. Also travel times (walk, drive, or Tube/bus in London) and what doesn't count as a date venue (big chains, members-only)
- `js/locale.js`: where Theo is looking. Home uses `places.js`. Anywhere else (Use my location, or a search via Nominatim) pulls real places live from OpenStreetMap's Overpass API, cached in the browser for 14 days.
- `js/map.js`: the Leaflet map (OpenStreetMap tiles), picking a place for an idea, and the "also around here" popups
- `js/compose.js`: the date composer. Builds contextual dates (an anchor + a food/drink pairing + why it suits you + timings) from the sources below, alongside the hand-written ideas. Pairings skip chains and members-only places where there's anything else; local specialities (cream tea, crab, pie and mash) only appear where somewhere nearby serves them; a record shop or bookshop round the corner becomes a detour if you love vinyl or books
- `js/adventures.js`: local walks built from OpenStreetMap: named trails and their footpaths (plus streets near you), scenic destinations, landmarks on the way, somewhere to eat at the end, the climb (Open-Meteo elevation), Wikipedia one-liners, and the way back. Routed in the browser; cached for a week per place. In London it fetches a smaller area, starts walks a Tube or bus ride away rather than through an hour of pavement, and prefers parks and the river
- `js/knownfor.js`: what a place is known for, from Wikivoyage's See/Do listings (with interests, seasons and opening windows), ranked by how well known each one is (how many Wikipedias cover it, via Wikidata) so a city's big sights beat its plaques; cached for a week
- `js/season.js`: seasonal dates (Christmas markets, bonfire night, bluebells…) and seasonal nudges for every idea
- `js/weather.js`: Open-Meteo forecast for outdoor plans
- `js/keys.js`: optional API keys, stored only in the browser (🔑 Connections in the footer, or a `#connect=` setup link). Never commit keys.
- `js/events.js`: real events nearby from Ticketmaster's Discovery API, matched to gig/theatre/comedy/cinema ideas by "When?"
- `js/ratings.js`: star ratings, price level and opening hours from Google Places (New), cached for 24 hours at most
- `js/when.js`: time-of-day sense: start windows for every idea, daylight/dark/golden-hour from real sunrise and sunset, booking-ahead flags, and an opening-hours parser for live places
- `js/picker.js`: your picks are strict rules; near misses are labelled with the rule they bend
- `js/theo.js`: Theo's SVG and lines (`img/theo.svg` is a copy, so keep them in sync)
- `js/store.js`: diary in localStorage
- `js/app.js`: UI

Plain HTML, CSS and ES modules, with no build step. On release, bump `?v=N` everywhere:
`sed -i '' 's/?v=1/?v=2/g' index.html js/*.js`
