# Theo's Date Night

Date night ideas for Tom & Cat (TomCat), dealt by Theo the cat.
Live at https://tomkeogh98.github.io/theo/

Pick a mood, where, how long, budget and whose turn it is. Theo deals three postcards.
Choose one, read the plan and the "ask each other" question, then go and do it. The date
diary (stored in this browser only) tracks dates done and a weekly streak.

- `js/ideas.js`: all 90 hand-written ideas (edit or add here)
- `js/picker.js`: filtering and weighted shuffle
- `js/theo.js`: Theo's SVG and lines (`img/theo.svg` is a copy, so keep them in sync)
- `js/store.js`: diary in localStorage
- `js/app.js`: UI

Plain HTML, CSS and ES modules, with no build step. On release, bump `?v=N` everywhere:
`sed -i '' 's/?v=1/?v=2/g' index.html js/*.js`
