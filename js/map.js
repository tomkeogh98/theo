// Theo's patch: a map of real places around wherever Theo is looking (home's
// hand-picked list, or live places anywhere else), plus real events (Ticketmaster)
// and star ratings (Google) when those are connected. The map itself is Google Maps
// when a Google key is connected, otherwise OpenStreetMap (see mapview.js).
import { CATS, km, travel, travelLabel, mapsSearch, mapsDirections, MODE_EMOJI } from "./places.js?v=9";
import { getLoc, getPlaces, getStatus, onChange } from "./locale.js?v=9";
import { openAt, hoursLine, startFor, latestStart } from "./when.js?v=9";
import { eventsFor, onEvents, whenLabel } from "./events.js?v=9";
import { ratingBadge, ratingScore, enrich } from "./ratings.js?v=9";
import { createView, leafletOnly } from "./mapview.js?v=9";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ALL = Object.keys(CATS);

let view, mapEl, picksLayer, baseMarker, listEl, chipsEl, statusEl;
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
let lastHand = [];

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
  const cat = CATS[p.cat] || CATS.food;
  return `
    <div class="pop">
      <p class="pop-cat">${cat.emoji} ${cat.label}${p.isNew ? ` <span class="new">New</span>` : ""}</p>
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
      ${p.osm && !p.google && !stars ? `<p class="pop-osm">Found on OpenStreetMap, not vetted by Theo.</p>` : ""}
      ${near.length ? `<p class="pop-near">Also around here</p><div class="pop-near-list">${near
        .map(({ q, d }) => `<button type="button" data-goto="${q.id}">${(CATS[q.cat] || CATS.food).emoji} ${esc(q.n)} <small>${ratingBadge(q, { short: true }) || metres(d)}</small></button>`)
        .join("")}</div>` : ""}
    </div>`;
}

const pinHtml = (p) => `<span class="pin pin-${p.cat}${p.isNew ? " is-new" : ""}">${(CATS[p.cat] || CATS.food).emoji}</span>`;

function bindGoto(el) {
  el?.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => focusPlace(b.dataset.goto, { scroll: false })));
}

// Popups: wire up "Also around here", and fetch Google ratings the first time.
function onPopup(popup) {
  bindGoto(popup.el());
  const p = popup.place;
  if (p && !p.event && p.g === undefined) {
    p.loading = true;
    popup.setContent(popupHtml(p));
    bindGoto(popup.el());
    enrich(p).then(() => {
      p.loading = false;
      if (popup.isOpen()) { popup.setContent(popupHtml(p)); bindGoto(popup.el()); }
      renderList();
    });
  }
}

function setUpLayers() {
  for (const cat of ALL) groups[cat] = view.layer();
  picksLayer = view.layer();
  view.onPopup(onPopup);
  lastLocKey = "";
}

export async function initMap(el, list, chips, status) {
  mapEl = el;
  listEl = list;
  chipsEl = chips;
  statusEl = status;
  popW = Math.max(200, Math.min(290, el.clientWidth - 70));
  view = await createView(el, getLoc().ll, 11, popW, {
    // Google turned the key down (bad key or out of quota): carry on with OpenStreetMap.
    onFallback: () => {
      view = leafletOnly(mapEl, getLoc().ll, 11, popW);
      if (!view) return;
      setUpLayers();
      rebuild();
      drawEvents();
      showPicks(lastHand);
    },
  });
  if (!view) {
    el.innerHTML = `<p class="map-fallback">The map couldn't load (are you offline?). Theo's postcards still name each place.</p>`;
    return;
  }
  setUpLayers();

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
  drawEvents();
  if (lastHand.length) showPicks(lastHand);
}

function addMarker(p) {
  if (!groups[p.cat]) return;
  const m = view.pin(p.ll, { html: pinHtml(p), title: p.n, popup: () => popupHtml(p), place: p, size: 32 });
  groups[p.cat].add(m);
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
  if (!view) return;
  for (const cat of ALL) groups[cat].setVisible(active.has(cat));
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
  if (!view) return;
  const loc = getLoc();
  const places = getPlaces();
  const locKey = `${loc.ll[0]},${loc.ll[1]}`;
  const sameSpot = locKey === lastLocKey;
  lastLocKey = locKey;
  byId = new Map([...places, ...eventPlaces].map((p) => [p.id, p]));
  markers.clear();
  for (const cat of ALL) groups[cat].clear();
  baseMarker?.remove();
  baseMarker = view.pin(loc.ll, { html: `<span class="pin pin-home">${loc.kind === "home" ? "🏠" : "📍"}</span>`, title: "", z: 5, size: 40 });
  baseMarker.show();
  places.forEach(addMarker);
  eventPlaces.forEach(addMarker);
  if (!sameSpot) { active = new Set(ALL); picksLayer.clear(); }
  applyFilter();

  // Google's places can fill the map even when OpenStreetMap's database is down.
  const status = getStatus();
  statusEl.hidden = places.length > 0 && status !== "loading";
  statusEl.textContent = status === "loading"
    ? `Theo's sniffing around ${loc.name}…`
    : status === "error" && !places.length
      ? `Theo couldn't reach the map database just now. Ideas still work; try again in a minute.`
      : `Theo couldn't find much around ${loc.name}. Try a bigger town nearby?`;

  // New spot: frame the nearest 40 places plus where you are. Same spot: leave the view alone.
  if (!sameSpot) {
    const near = places.map((p) => ({ p, d: km(loc.ll, p.ll) })).sort((a, b) => a.d - b.d).slice(0, 40).map((x) => x.p.ll);
    if (near.length) view.fit([loc.ll, ...near], { padding: 24, maxZoom: 14 });
    else view.setView(loc.ll, 12, false);
  }
}

// Events follow "When?": soon (Right now), this evening (Tonight) or two weeks (Plan ahead).
export function setEventMode(mode) {
  eventMode = mode;
  drawEvents();
}
function drawEvents() {
  if (!view) return;
  // One pin per venue: the soonest event there.
  const byVenue = new Map();
  for (const ev of eventsFor(eventMode)) if (!byVenue.has(ev.venue)) byVenue.set(ev.venue, ev);
  eventPlaces = [...byVenue.values()].map(eventPlace);
  groups.events.clear();
  for (const [id] of [...markers]) if (id.startsWith("tm-")) markers.delete(id);
  eventPlaces.forEach((p) => { byId.set(p.id, p); addMarker(p); });
  groups.events.setVisible(active.has("events"));
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
        <span class="li-emoji" aria-hidden="true">${(CATS[p.cat] || CATS.food).emoji}</span>
        <span class="li-name">${esc(p.n)}${p.isNew ? ` <span class="new">New</span>` : ""}<small>${esc(p.event ? p.b : p.osm ? p.b : p.town)}${extra}</small></span>
        <span class="li-mins">${stars ? `<b class="li-stars">${stars}</b>` : ""}${t.mins} min ${MODE_EMOJI[t.mode] || "🚗"}</span>
      </button></li>`;
      }).join("")
    : `<li class="li-empty">${getStatus() === "loading" ? "Sniffing…" : "Nothing here yet."}</li>`;
}

// Highlight Theo's current postcards: numbered pins, and for walks the route itself
// (start, landmarks, destination) drawn on the map.
const routes = new Map();
export function showPicks(hand) {
  lastHand = hand;
  if (!view) return;
  picksLayer.clear();
  pickMarkers.clear();
  routes.clear();
  const pts = [];
  const pin = (ll, label, title, place, cls = "pin-pick") =>
    picksLayer.add(view.pin(ll, {
      html: `<span class="pin ${cls}">${label}</span>`, title: esc(title), z: 10, size: cls === "pin-pair" ? 34 : 40,
      popup: place ? () => popupHtml(place) : null, place,
    }));
  hand.forEach((card, i) => {
    const label = hand.length > 1 ? i + 1 : "★";
    const adv = card.idea?.adv;
    if (adv) {
      // Real trail routes get drawn; walks without one just get their destination pinned.
      if (adv.path.length > 2) {
        routes.set(card.idea.id, picksLayer.add(view.line(adv.path, { title: esc(card.idea.t) })));
        pts.push(...adv.path);
        adv.landmarks.forEach((l) => picksLayer.add(view.dot(l.ll, { title: esc(l.name) })));
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
  if (pts.length) view.fit([getLoc().ll, ...pts], { padding: 56, maxZoom: 14 });
}

// Zoom the map to a walk's route.
export function focusRoute(ideaId) {
  const line = routes.get(ideaId);
  if (!view || !line) return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("mapSection").scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  setTimeout(() => view.fit(line.bounds(), { padding: 40, maxZoom: 17 }), calm ? 0 : 400);
}

export function focusPlace(id, { scroll = true } = {}) {
  const p = byId.get(id);
  if (!view || !p) return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (scroll) document.getElementById("mapSection").scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  if (groups[p.cat] && !active.has(p.cat)) { active.add(p.cat); applyFilter(); }
  view.setView(p.ll, Math.max(view.getZoom(), 15), !calm);
  setTimeout(() => (markers.get(id) || pickMarkers.get(id))?.openPopup(), scroll && !calm ? 500 : 60);
}
