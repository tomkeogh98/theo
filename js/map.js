// Theo's patch: a Leaflet map of real places near home. Leaflet is loaded as a
// classic script in index.html (window.L). Tiles are OpenStreetMap's own (light,
// personal use with attribution); dark mode recolours them with a CSS filter.
import { PLACES, CATS, HOME, km, driveMins, mapsSearch, mapsDirections } from "./places.js?v=2";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const byId = new Map(PLACES.map((p) => [p.id, p]));
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

let map, picksLayer, listEl;
let popW = 290;
const markers = new Map();
const groups = {};
const active = new Set(Object.keys(CATS));

export const placeById = (id) => byId.get(id);

// Choose a real place for an idea: matching tags, avoiding places already in the hand,
// nudged towards new openings and (for short dates) somewhere close.
export function pickPlace(idea, { time = 2, avoid = new Set() } = {}) {
  if (!idea.go) return null;
  const pool = PLACES.filter((p) => p.tags.some((t) => idea.go.includes(t)) && !avoid.has(p.id));
  if (!pool.length) return null;
  const w = (p) => 1 + (p.isNew ? 1.5 : 0) + (time === 1 && driveMins(p.ll) <= 15 ? 2 : 0);
  return pool
    .map((p) => ({ p, k: Math.random() ** (1 / w(p)) }))
    .sort((a, b) => b.k - a.k)[0].p;
}

function nearby(p, n = 4) {
  return PLACES.filter((q) => q !== p)
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
      <p class="pop-where">${esc(p.town)} · ~${driveMins(p.ll)} min drive</p>
      <p>${esc(p.b)}</p>
      <p class="pop-links">
        <a href="${mapsDirections(p)}" target="_blank" rel="noopener">Directions ↗</a>
        <a href="${mapsSearch(p)}" target="_blank" rel="noopener">Hours &amp; info ↗</a>
      </p>
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

export function initMap(el, list, chipsEl) {
  listEl = list;
  if (!window.L) {
    el.innerHTML = `<p class="map-fallback">The map couldn't load (are you offline?). Theo's postcards still name each place.</p>`;
    return;
  }
  popW = Math.max(200, Math.min(290, el.clientWidth - 70));
  map = L.map(el, { scrollWheelZoom: false }).setView(HOME.ll, 10);
  L.tileLayer(TILES, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.on("focus", () => map.scrollWheelZoom.enable());
  map.on("blur", () => map.scrollWheelZoom.disable());

  L.marker(HOME.ll, {
    icon: L.divIcon({ className: "", html: `<span class="pin pin-home">🏠</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
    zIndexOffset: 500,
    keyboard: false,
    interactive: false,
  }).addTo(map);

  for (const cat of Object.keys(CATS)) groups[cat] = L.layerGroup().addTo(map);
  for (const p of PLACES) {
    const m = L.marker(p.ll, { icon: pinIcon(p), title: p.n, alt: p.n, riseOnHover: true })
      .bindPopup(() => popupHtml(p), { maxWidth: popW, autoPanPadding: [16, 16] });
    m.addTo(groups[p.cat]);
    markers.set(p.id, m);
  }
  picksLayer = L.layerGroup().addTo(map);

  // "Also around here" buttons inside popups hop to that place.
  map.on("popupopen", (e) => {
    e.popup.getElement().querySelectorAll("[data-goto]").forEach((b) =>
      b.addEventListener("click", () => focusPlace(b.dataset.goto, { scroll: false })));
  });

  chipsEl.innerHTML = Object.entries(CATS)
    .map(([id, c]) => `<button type="button" class="map-chip" data-cat="${id}" aria-pressed="true">${c.emoji} ${c.label}</button>`)
    .join("");
  chipsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    const cat = b.dataset.cat;
    const on = !active.has(cat);
    if (on) { active.add(cat); groups[cat].addTo(map); } else { active.delete(cat); map.removeLayer(groups[cat]); }
    b.setAttribute("aria-pressed", on);
    renderList();
  });

  listEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto]");
    if (b) focusPlace(b.dataset.goto, { scroll: false });
  });
  renderList();
  map.fitBounds(L.latLngBounds([HOME.ll, ...PLACES.map((p) => p.ll)]), { padding: [24, 24] });
}

function renderList() {
  const rows = PLACES.filter((p) => active.has(p.cat))
    .map((p) => ({ p, mins: driveMins(p.ll) }))
    .sort((a, b) => a.mins - b.mins || a.p.n.localeCompare(b.p.n));
  listEl.innerHTML = rows.length
    ? rows.map(({ p, mins }) => `
      <li><button type="button" data-goto="${p.id}">
        <span class="li-emoji" aria-hidden="true">${CATS[p.cat].emoji}</span>
        <span class="li-name">${esc(p.n)}${p.isNew ? ` <span class="new">New</span>` : ""}<small>${esc(p.town)}</small></span>
        <span class="li-mins">${mins} min</span>
      </button></li>`).join("")
    : `<li class="li-empty">Switch a category back on above.</li>`;
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
  if (pts.length) map.fitBounds(L.latLngBounds([HOME.ll, ...pts]), { padding: [56, 56], maxZoom: 13 });
}

export function focusPlace(id, { scroll = true } = {}) {
  const p = byId.get(id);
  if (!map || !p) return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (scroll) document.getElementById("mapSection").scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  if (!active.has(p.cat)) {
    active.add(p.cat);
    groups[p.cat].addTo(map);
    document.querySelector(`.map-chip[data-cat="${p.cat}"]`)?.setAttribute("aria-pressed", "true");
    renderList();
  }
  map.setView(p.ll, Math.max(map.getZoom(), 14), { animate: !calm });
  setTimeout(() => markers.get(id).openPopup(), scroll && !calm ? 500 : 60);
}
