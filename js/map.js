// Theo's patch: a Leaflet map of real places around wherever Theo is looking
// (home's hand-picked list, or live OpenStreetMap places anywhere else).
// Leaflet is a classic script in index.html (window.L); tiles are OpenStreetMap's
// own, and dark mode recolours them with a CSS filter.
import { CATS, km, travel, travelLabel, mapsSearch, mapsDirections } from "./places.js?v=3";
import { getLoc, getPlaces, getStatus, onChange } from "./locale.js?v=3";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ALL = Object.keys(CATS);

let map, picksLayer, baseMarker, listEl, chipsEl, statusEl;
let popW = 290;
let byId = new Map();
const markers = new Map();
const groups = {};
let active = new Set(ALL);

export const placeById = (id) => byId.get(id);

// Choose a real place for an idea: matching tags, avoiding places already in the hand,
// nudged towards new openings / well-documented independents and, for short dates,
// somewhere close.
export function pickPlace(idea, { time = 2, avoid = new Set() } = {}) {
  if (!idea.go) return null;
  const from = getLoc().ll;
  const pool = getPlaces().filter((p) => p.tags.some((t) => idea.go.includes(t)) && !avoid.has(p.id));
  if (!pool.length) return null;
  const w = (p) => Math.max(0.2, 1 + (p.isNew ? 1.5 : 0) + (p.q || 0) * 0.6 + (time === 1 && travel(p.ll, from).mins <= 15 ? 2 : 0));
  return pool
    .map((p) => ({ p, k: Math.random() ** (1 / w(p)) }))
    .sort((a, b) => b.k - a.k)[0].p;
}

function nearby(p, n = 4) {
  return getPlaces().filter((q) => q !== p)
    .map((q) => ({ q, d: km(p.ll, q.ll) }))
    .filter((x) => x.d < 1.6)
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

const metres = (d) => (d < 1 ? `${Math.max(50, Math.round((d * 1000) / 50) * 50)}m` : `${d.toFixed(1)}km`);

function popupHtml(p) {
  const near = nearby(p);
  return `
    <div class="pop">
      <p class="pop-cat">${CATS[p.cat].emoji} ${CATS[p.cat].label}${p.isNew ? ` <span class="new">New</span>` : ""}</p>
      <h3>${esc(p.n)}</h3>
      <p class="pop-where">${p.town ? `${esc(p.town)} · ` : ""}${travelLabel(p.ll, getLoc().ll)}</p>
      <p>${esc(p.b)}</p>
      ${p.hours ? `<p class="pop-hours">🕰️ ${esc(p.hours)}</p>` : ""}
      <p class="pop-links">
        <a href="${mapsDirections(p)}" target="_blank" rel="noopener">Directions ↗</a>
        <a href="${mapsSearch(p)}" target="_blank" rel="noopener">Reviews &amp; hours ↗</a>
        ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Website ↗</a>` : ""}
      </p>
      ${p.osm ? `<p class="pop-osm">Found on OpenStreetMap, not vetted by Theo. Check reviews first.</p>` : ""}
      ${near.length ? `<p class="pop-near">Also around here</p><div class="pop-near-list">${near
        .map(({ q, d }) => `<button type="button" data-goto="${q.id}">${CATS[q.cat].emoji} ${esc(q.n)} <small>${metres(d)}</small></button>`)
        .join("")}</div>` : ""}
    </div>`;
}

const pinIcon = (p) => L.divIcon({
  className: "",
  html: `<span class="pin pin-${p.cat}${p.isNew ? " is-new" : ""}">${CATS[p.cat].emoji}</span>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -14],
});

export function initMap(el, list, chips, status) {
  listEl = list;
  chipsEl = chips;
  statusEl = status;
  if (!window.L) {
    el.innerHTML = `<p class="map-fallback">The map couldn't load (are you offline?). Theo's postcards still name each place.</p>`;
    return;
  }
  popW = Math.max(200, Math.min(290, el.clientWidth - 70));
  map = L.map(el, { scrollWheelZoom: false }).setView(getLoc().ll, 11);
  L.tileLayer(TILES, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.on("focus", () => map.scrollWheelZoom.enable());
  map.on("blur", () => map.scrollWheelZoom.disable());

  for (const cat of ALL) groups[cat] = L.layerGroup().addTo(map);
  picksLayer = L.layerGroup().addTo(map);

  // "Also around here" buttons inside popups hop to that place.
  map.on("popupopen", (e) => {
    e.popup.getElement().querySelectorAll("[data-goto]").forEach((b) =>
      b.addEventListener("click", () => focusPlace(b.dataset.goto, { scroll: false })));
  });

  chipsEl.addEventListener("click", onChip);
  listEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto]");
    if (b) focusPlace(b.dataset.goto, { scroll: false });
  });

  onChange(rebuild);
  rebuild();
}

// Category chips: a plain tap shows just that category (tap it again for everything);
// Shift/⌘/Ctrl-click latches extra categories on or off. "All" resets.
function onChip(e) {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  const cat = b.dataset.cat;
  const latch = e.shiftKey || e.metaKey || e.ctrlKey;
  if (cat === "all") active = new Set(ALL);
  else if (latch) {
    const allOn = active.size === ALL.length;
    if (allOn) active = new Set([cat]);
    else if (active.has(cat)) active.delete(cat);
    else active.add(cat);
    if (!active.size) active = new Set(ALL);
  } else {
    active = active.size === 1 && active.has(cat) ? new Set(ALL) : new Set([cat]);
  }
  applyFilter();
}

function applyFilter() {
  for (const cat of ALL) {
    if (active.has(cat)) groups[cat].addTo(map);
    else map.removeLayer(groups[cat]);
  }
  renderChips();
  renderList();
}

function renderChips() {
  const counts = {};
  getPlaces().forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
  const all = active.size === ALL.length;
  chipsEl.classList.toggle("filtered", !all);
  chipsEl.innerHTML = `<button type="button" class="map-chip chip-all" data-cat="all" aria-pressed="${all}">All</button>` +
    ALL.map((id) => `<button type="button" class="map-chip" data-cat="${id}" aria-pressed="${!all && active.has(id)}"${counts[id] ? "" : " disabled"}>${CATS[id].emoji} ${CATS[id].label}</button>`).join("");
}

function rebuild() {
  if (!map) return;
  const loc = getLoc();
  const places = getPlaces();
  byId = new Map(places.map((p) => [p.id, p]));
  markers.clear();
  for (const cat of ALL) groups[cat].clearLayers();
  picksLayer.clearLayers();
  baseMarker?.remove();
  baseMarker = L.marker(loc.ll, {
    icon: L.divIcon({ className: "", html: `<span class="pin pin-home">${loc.kind === "home" ? "🏠" : "📍"}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
    zIndexOffset: 500,
    keyboard: false,
    interactive: false,
  }).addTo(map);

  for (const p of places) {
    const m = L.marker(p.ll, { icon: pinIcon(p), title: p.n, alt: p.n, riseOnHover: true })
      .bindPopup(() => popupHtml(p), { maxWidth: popW, autoPanPadding: [16, 16] });
    m.addTo(groups[p.cat]);
    markers.set(p.id, m);
  }
  active = new Set(ALL);
  applyFilter();

  const status = getStatus();
  statusEl.hidden = status === "ready" && places.length > 0;
  statusEl.textContent = status === "loading"
    ? `Theo's sniffing around ${loc.name}…`
    : status === "error"
      ? `Theo couldn't reach the map database just now. Ideas still work; try again in a minute.`
      : `Theo couldn't find much around ${loc.name}. Try a bigger town nearby?`;

  // Frame the nearest 40 places plus where you are.
  const near = places.map((p) => ({ p, d: km(loc.ll, p.ll) })).sort((a, b) => a.d - b.d).slice(0, 40).map((x) => x.p.ll);
  if (near.length) map.fitBounds(L.latLngBounds([loc.ll, ...near]), { padding: [24, 24], maxZoom: 14 });
  else map.setView(loc.ll, 12);
}

function renderList() {
  const from = getLoc().ll;
  const rows = getPlaces().filter((p) => active.has(p.cat))
    .map((p) => ({ p, t: travel(p.ll, from), d: km(from, p.ll) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 150);
  listEl.innerHTML = rows.length
    ? rows.map(({ p, t }) => `
      <li><button type="button" data-goto="${p.id}">
        <span class="li-emoji" aria-hidden="true">${CATS[p.cat].emoji}</span>
        <span class="li-name">${esc(p.n)}${p.isNew ? ` <span class="new">New</span>` : ""}<small>${esc(p.osm ? p.b : p.town)}</small></span>
        <span class="li-mins">${t.mins} min ${t.mode === "walk" ? "🚶" : "🚗"}</span>
      </button></li>`).join("")
    : `<li class="li-empty">${getStatus() === "loading" ? "Sniffing…" : "Nothing here yet."}</li>`;
}

// Highlight the places on Theo's current postcards as numbered pins.
export function showPicks(hand) {
  if (!map) return;
  picksLayer.clearLayers();
  const pts = [];
  hand.forEach(({ place }, i) => {
    if (!place) return;
    pts.push(place.ll);
    L.marker(place.ll, {
      icon: L.divIcon({ className: "", html: `<span class="pin pin-pick">${hand.length > 1 ? i + 1 : "★"}</span>`, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -18] }),
      zIndexOffset: 1000,
      title: place.n,
      alt: `Theo's pick: ${place.n}`,
    }).bindPopup(() => popupHtml(place), { maxWidth: popW, autoPanPadding: [16, 16] }).addTo(picksLayer);
  });
  if (pts.length) map.fitBounds(L.latLngBounds([getLoc().ll, ...pts]), { padding: [56, 56], maxZoom: 14 });
}

export function focusPlace(id, { scroll = true } = {}) {
  const p = byId.get(id);
  if (!map || !p) return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (scroll) document.getElementById("mapSection").scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  if (!active.has(p.cat)) { active.add(p.cat); applyFilter(); }
  map.setView(p.ll, Math.max(map.getZoom(), 15), { animate: !calm });
  setTimeout(() => markers.get(id)?.openPopup(), scroll && !calm ? 500 : 60);
}
