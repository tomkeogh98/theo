// Theo's patch: a Leaflet map of real places around wherever Theo is looking
// (home's hand-picked list, or live OpenStreetMap places anywhere else), plus
// real events (Ticketmaster) and star ratings (Google) when those are connected.
// Leaflet is a classic script in index.html (window.L); tiles are OpenStreetMap's
// own, and dark mode recolours them with a CSS filter.
import { CATS, km, travel, travelLabel, mapsSearch, mapsDirections, MODE_EMOJI } from "./places.js?v=8";
import { getLoc, getPlaces, getStatus, onChange } from "./locale.js?v=8";
import { openAt, hoursLine, startFor, latestStart } from "./when.js?v=8";
import { eventsFor, onEvents, whenLabel } from "./events.js?v=8";
import { ratingBadge, ratingScore, enrich } from "./ratings.js?v=8";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ALL = Object.keys(CATS);

let map, picksLayer, baseMarker, listEl, chipsEl, statusEl;
let popW = 290;
let byId = new Map();
const markers = new Map();
const pickMarkers = new Map();
const groups = {};
let active = new Set(ALL);
let sortBy = "near";
let eventMode = "now";
let lastLocKey = "";
let eventPlaces = [];

export const placeById = (id) => byId.get(id);

// An event, shaped like a place so the map, list and postcards can treat it the same.
export const eventPlace = (ev) => ({ id: ev.id, n: ev.name, cat: "events", town: ev.town, ll: ev.ll, b: ev.venue, tags: [], event: ev });

// Choose a real place for an idea: matching tags, avoiding places already in the hand.
// Leans towards well-rated and new places, somewhere close for short dates, and (for
// Right now / Tonight) places known to be open; ones known to be shut are skipped.
export function pickPlace(idea, { time = 2, avoid = new Set(), when = "plan" } = {}) {
  if (!idea.go) return null;
  const from = getLoc().ll;
  const at = when === "plan" ? null : startFor(when);
  const deadline = latestStart(idea, when, from);
  // Right now / Tonight: you have to be able to get there before it's too late, and it
  // mustn't be known to be shut when you arrive.
  const reachable = (p) => {
    if (!at) return true;
    const arrive = new Date(at.getTime() + travel(p.ll, from).mins * 60e3);
    if (deadline && arrive > deadline) return false;
    return openAt(p, arrive) !== false;
  };
  const pool = getPlaces().filter((p) => p.tags.some((t) => idea.go.includes(t)) && !avoid.has(p.id) && reachable(p));
  if (!pool.length) return null;
  const w = (p) => {
    const score = ratingScore(p);
    return Math.max(0.15, 1 + (p.isNew ? 1.5 : 0) + (p.q || 0) * 0.6
      + (time === 1 && travel(p.ll, from).mins <= 15 ? 2 : 0)
      + (at && openAt(p, at) ? 1.5 : 0)
      + (score ? (score - 4.1) * 6 : 0));
  };
  return pool
    .map((p) => ({ p, k: Math.random() ** (1 / w(p)) }))
    .sort((a, b) => b.k - a.k)[0].p;
}

function allPoints() { return [...getPlaces(), ...eventPlaces]; }

function nearby(p, n = 4) {
  return allPoints().filter((q) => q.id !== p.id)
    .map((q) => ({ q, d: km(p.ll, q.ll) }))
    .filter((x) => x.d < 1.6)
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

const metres = (d) => (d < 1 ? `${Math.max(50, Math.round((d * 1000) / 50) * 50)}m` : `${d.toFixed(1)}km`);

function eventPopup(p) {
  const ev = p.event;
  return `
    <div class="pop">
      <p class="pop-cat">🎟️ ${esc(ev.genre || "Event")}</p>
      <h3>${esc(ev.name)}</h3>
      <p class="pop-when"><b>${esc(whenLabel(ev))}</b>${ev.price ? ` · ${esc(ev.price)}` : ""}</p>
      <p class="pop-where">${esc(ev.venue)}${ev.town ? `, ${esc(ev.town)}` : ""} · ${travelLabel(ev.ll, getLoc().ll)}</p>
      <p class="pop-links">
        <a href="${esc(ev.url)}" target="_blank" rel="noopener">Tickets ↗</a>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${ev.ll.join(",")}" target="_blank" rel="noopener">Directions ↗</a>
      </p>
      <p class="pop-osm">Listing from Ticketmaster.</p>
    </div>`;
}

function popupHtml(p) {
  if (p.event) return eventPopup(p);
  const near = nearby(p);
  const stars = ratingBadge(p);
  const hours = hoursLine(p);
  return `
    <div class="pop">
      <p class="pop-cat">${CATS[p.cat].emoji} ${CATS[p.cat].label}${p.isNew ? ` <span class="new">New</span>` : ""}</p>
      <h3>${esc(p.n)}</h3>
      ${stars ? `<p class="pop-stars">${stars} <small>on Google</small></p>` : p.g === undefined && p.loading ? `<p class="pop-stars muted">⭐ Checking reviews…</p>` : ""}
      <p class="pop-where">${p.town ? `${esc(p.town)} · ` : ""}${travelLabel(p.ll, getLoc().ll)}</p>
      <p>${esc(p.b)}</p>
      ${hours ? `<p class="pop-hours"><b>${hours}</b></p>` : ""}
      <p class="pop-links">
        <a href="${mapsDirections(p)}" target="_blank" rel="noopener">Directions ↗</a>
        <a href="${p.g?.uri ? esc(p.g.uri) : mapsSearch(p)}" target="_blank" rel="noopener">${stars ? "Read reviews" : "Reviews &amp; hours"} ↗</a>
        ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Website ↗</a>` : ""}
      </p>
      ${p.osm && !stars ? `<p class="pop-osm">Found on OpenStreetMap, not vetted by Theo.</p>` : ""}
      ${near.length ? `<p class="pop-near">Also around here</p><div class="pop-near-list">${near
        .map(({ q, d }) => `<button type="button" data-goto="${q.id}">${CATS[q.cat].emoji} ${esc(q.n)} <small>${ratingBadge(q, { short: true }) || metres(d)}</small></button>`)
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

function bindGoto(popup) {
  popup.getElement()?.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => focusPlace(b.dataset.goto, { scroll: false })));
}

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

  // Popups: wire up "Also around here", and fetch Google ratings the first time.
  map.on("popupopen", (e) => {
    bindGoto(e.popup);
    const p = e.popup._theoPlace;
    if (p && !p.event && p.g === undefined) {
      p.loading = true;
      e.popup.setContent(popupHtml(p));
      bindGoto(e.popup);
      enrich(p).then(() => {
        p.loading = false;
        if (e.popup.isOpen()) { e.popup.setContent(popupHtml(p)); bindGoto(e.popup); }
        renderList();
      });
    }
  });

  chipsEl.addEventListener("click", onChip);
  listEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto]");
    if (b) focusPlace(b.dataset.goto, { scroll: false });
  });
  listEl.closest(".place-panel")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]");
    if (!b) return;
    sortBy = b.dataset.sort;
    b.parentElement.querySelectorAll("[data-sort]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderList();
  });

  onChange(rebuild);
  onEvents(() => drawEvents());
  rebuild();
}

function addMarker(p) {
  const m = L.marker(p.ll, { icon: pinIcon(p), title: p.n, alt: p.n, riseOnHover: true });
  m.bindPopup(() => popupHtml(p), { maxWidth: popW, autoPanPadding: [16, 16] });
  m.getPopup()._theoPlace = p;
  m.addTo(groups[p.cat]);
  markers.set(p.id, m);
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
  allPoints().forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
  const all = active.size === ALL.length;
  chipsEl.classList.toggle("filtered", !all);
  chipsEl.innerHTML = `<button type="button" class="map-chip chip-all" data-cat="all" aria-pressed="${all}">All</button>` +
    ALL.map((id) => `<button type="button" class="map-chip" data-cat="${id}" aria-pressed="${!all && active.has(id)}"${counts[id] ? "" : " disabled"}>${CATS[id].emoji} ${CATS[id].label}</button>`).join("");
}

function rebuild() {
  if (!map) return;
  const loc = getLoc();
  const places = getPlaces();
  const locKey = `${loc.ll[0]},${loc.ll[1]}`;
  const sameSpot = locKey === lastLocKey;
  lastLocKey = locKey;
  byId = new Map([...places, ...eventPlaces].map((p) => [p.id, p]));
  markers.clear();
  for (const cat of ALL) groups[cat].clearLayers();
  baseMarker?.remove();
  baseMarker = L.marker(loc.ll, {
    icon: L.divIcon({ className: "", html: `<span class="pin pin-home">${loc.kind === "home" ? "🏠" : "📍"}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
    zIndexOffset: 500,
    keyboard: false,
    interactive: false,
  }).addTo(map);
  places.forEach(addMarker);
  eventPlaces.forEach(addMarker);
  if (!sameSpot) { active = new Set(ALL); picksLayer.clearLayers(); }
  applyFilter();

  const status = getStatus();
  statusEl.hidden = status === "ready" && places.length > 0;
  statusEl.textContent = status === "loading"
    ? `Theo's sniffing around ${loc.name}…`
    : status === "error"
      ? `Theo couldn't reach the map database just now. Ideas still work; try again in a minute.`
      : `Theo couldn't find much around ${loc.name}. Try a bigger town nearby?`;

  // New spot: frame the nearest 40 places plus where you are. Same spot: leave the view alone.
  if (!sameSpot) {
    const near = places.map((p) => ({ p, d: km(loc.ll, p.ll) })).sort((a, b) => a.d - b.d).slice(0, 40).map((x) => x.p.ll);
    if (near.length) map.fitBounds(L.latLngBounds([loc.ll, ...near]), { padding: [24, 24], maxZoom: 14 });
    else map.setView(loc.ll, 12);
  }
}

// Events follow "When?": soon (Right now), this evening (Tonight) or two weeks (Plan ahead).
export function setEventMode(mode) {
  eventMode = mode;
  drawEvents();
}
function drawEvents() {
  if (!map) return;
  // One pin per venue: the soonest event there.
  const byVenue = new Map();
  for (const ev of eventsFor(eventMode)) if (!byVenue.has(ev.venue)) byVenue.set(ev.venue, ev);
  eventPlaces = [...byVenue.values()].map(eventPlace);
  groups.events.clearLayers();
  for (const [id] of [...markers]) if (id.startsWith("tm-")) markers.delete(id);
  eventPlaces.forEach((p) => { byId.set(p.id, p); addMarker(p); });
  if (!active.has("events")) map.removeLayer(groups.events);
  renderChips();
  renderList();
}

function renderList() {
  const from = getLoc().ll;
  let rows = allPoints().filter((p) => active.has(p.cat))
    .map((p) => ({ p, t: travel(p.ll, from), d: km(from, p.ll), s: ratingScore(p) }));
  rows = sortBy === "top"
    ? rows.sort((a, b) => (b.s ?? -1) - (a.s ?? -1) || a.d - b.d)
    : rows.sort((a, b) => a.d - b.d);
  rows = rows.slice(0, 150);
  listEl.innerHTML = rows.length
    ? rows.map(({ p, t }) => {
        const extra = p.event
          ? ` · ${esc(whenLabel(p.event))}`
          : `${openAt(p) === true ? " · 🟢 open now" : openAt(p) === false ? " · closed now" : ""}`;
        const stars = ratingBadge(p, { short: true });
        return `
      <li><button type="button" data-goto="${p.id}">
        <span class="li-emoji" aria-hidden="true">${CATS[p.cat].emoji}</span>
        <span class="li-name">${esc(p.n)}${p.isNew ? ` <span class="new">New</span>` : ""}<small>${esc(p.event ? p.b : p.osm ? p.b : p.town)}${extra}</small></span>
        <span class="li-mins">${stars ? `<b class="li-stars">${stars}</b>` : ""}${t.mins} min ${MODE_EMOJI[t.mode] || "🚗"}</span>
      </button></li>`;
      }).join("")
    : `<li class="li-empty">${getStatus() === "loading" ? "Sniffing…" : "Nothing here yet."}</li>`;
}

// Highlight the places on Theo's current postcards as numbered pins.
// Highlight Theo's current postcards: numbered pins, and for walks the route itself
// (start, landmarks, destination) drawn on the map.
const routes = new Map();
export function showPicks(hand) {
  if (!map) return;
  picksLayer.clearLayers();
  pickMarkers.clear();
  routes.clear();
  const pts = [];
  const pin = (ll, label, title, place, cls = "pin-pick") => {
    const m = L.marker(ll, {
      icon: L.divIcon({ className: "", html: `<span class="pin ${cls}">${label}</span>`, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -18] }),
      zIndexOffset: 1000, title, alt: title,
    });
    if (place) {
      m.bindPopup(() => popupHtml(place), { maxWidth: popW, autoPanPadding: [16, 16] });
      m.getPopup()._theoPlace = place;
    } else {
      m.bindTooltip(esc(title), { direction: "top", offset: [0, -16] });
    }
    m.addTo(picksLayer);
    return m;
  };
  hand.forEach((card, i) => {
    const label = hand.length > 1 ? i + 1 : "★";
    const adv = card.idea?.adv;
    if (adv) {
      // Real trail routes get drawn; walks without one just get their destination pinned.
      if (adv.path.length > 2) {
        const line = L.polyline(adv.path, { color: "#7a62b3", weight: 5, opacity: 0.85, dashArray: "8 7", lineCap: "round" }).addTo(picksLayer);
        line.bindTooltip(esc(card.idea.t), { sticky: true });
        routes.set(card.idea.id, line);
        pts.push(...adv.path);
        adv.landmarks.forEach((l) => {
          L.circleMarker(l.ll, { radius: 7, color: "#27222f", weight: 2, fillColor: "#fffcf6", fillOpacity: 1 })
            .bindTooltip(esc(l.name), { direction: "top" }).addTo(picksLayer);
        });
      } else {
        pts.push(adv.dest.ll);
      }
      pin(adv.dest.ll, label, `${card.idea.t}: ${adv.dest.name}`, null);
      if (card.pair) {
        if (!byId.has(card.pair.id)) byId.set(card.pair.id, card.pair);
        pickMarkers.set(card.pair.id, pin(card.pair.ll, "☕", card.pair.n, card.pair, "pin-pair"));
      }
      return;
    }
    const place = card.place;
    if (!place) return;
    if (!byId.has(place.id)) byId.set(place.id, place);
    pts.push(place.ll);
    pickMarkers.set(place.id, pin(place.ll, label, `Theo's pick: ${place.n}`, place));
    if (card.pair && card.pair.id !== place.id) {
      if (!byId.has(card.pair.id)) byId.set(card.pair.id, card.pair);
      pts.push(card.pair.ll);
      pickMarkers.set(card.pair.id, pin(card.pair.ll, "🍽️", card.pair.n, card.pair, "pin-pair"));
    }
  });
  if (pts.length) map.fitBounds(L.latLngBounds([getLoc().ll, ...pts]), { padding: [56, 56], maxZoom: 14 });
}

// Zoom the map to a walk's route.
export function focusRoute(ideaId) {
  const line = routes.get(ideaId);
  if (!map || !line) return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("mapSection").scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  setTimeout(() => map.fitBounds(line.getBounds(), { padding: [40, 40] }), calm ? 0 : 400);
}

export function focusPlace(id, { scroll = true } = {}) {
  const p = byId.get(id);
  if (!map || !p) return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (scroll) document.getElementById("mapSection").scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  if (!active.has(p.cat)) { active.add(p.cat); applyFilter(); }
  map.setView(p.ll, Math.max(map.getZoom(), 15), { animate: !calm });
  setTimeout(() => (markers.get(id) || pickMarkers.get(id))?.openPopup(), scroll && !calm ? 500 : 60);
}
