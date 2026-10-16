// Star ratings, price level and opening hours from Google Places (needs a key in
// 🔑 Connections). Two ways in: the most popular restaurants and bars around
// wherever Theo is looking (attached to matching map places, or added if new),
// and a one-off lookup when you open a pin or a postcard names a place.
// Google's terms allow only short-term caching, so nothing is kept beyond 24 hours.
import { getKeys } from "./keys.js?v=7";
import { getLoc, getPlaces, getStatus, onChange, refresh } from "./locale.js?v=7";
import { km } from "./places.js?v=7";

const API = "https://places.googleapis.com/v1";
const TTL = 24 * 3600e3;
const STORE = "theo.google.v1";
const FIELDS = ["id", "displayName", "location", "rating", "userRatingCount", "priceLevel", "regularOpeningHours.periods", "googleMapsUri", "websiteUri", "primaryType", "primaryTypeDisplayName", "types"];
const PRICE = { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "£", PRICE_LEVEL_MODERATE: "££", PRICE_LEVEL_EXPENSIVE: "£££", PRICE_LEVEL_VERY_EXPENSIVE: "££££" };

const hasKey = () => !!getKeys().g;

// ── tiny 24-hour cache ───────────────────────────────────────────
function load() {
  try {
    const all = JSON.parse(localStorage.getItem(STORE)) || {};
    const now = Date.now();
    for (const k of Object.keys(all)) if (now - all[k].at > TTL) delete all[k];
    return all;
  } catch { return {}; }
}
let store = load();
function remember(k, d) {
  store[k] = { at: Date.now(), d };
  try { localStorage.setItem(STORE, JSON.stringify(store)); } catch { /* full: fine, it's only a cache */ }
}

async function call(path, body) {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": getKeys().g, "X-Goog-FieldMask": FIELDS.map((f) => `places.${f}`).join(",") },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`google ${res.status}`);
  return (await res.json()).places || [];
}

// Google periods → Theo's week (Mon = 0) of [open, close] hour spans.
function toWeek(periods) {
  if (!periods?.length) return null;
  const week = Array.from({ length: 7 }, () => []);
  for (const { open, close } of periods) {
    if (!open) continue;
    const od = (open.day + 6) % 7;
    if (!close) return Array.from({ length: 7 }, () => [[0, 24]]);
    const cd = (close.day + 6) % 7;
    const a = open.hour + (open.minute || 0) / 60;
    const b = close.hour + (close.minute || 0) / 60 + 24 * ((cd - od + 7) % 7);
    week[od].push([a, b || 24]);
  }
  return week;
}

function slim(g) {
  return {
    gid: g.id,
    name: g.displayName?.text || "",
    ll: g.location ? [g.location.latitude, g.location.longitude] : null,
    rating: g.rating || null,
    count: g.userRatingCount || 0,
    price: PRICE[g.priceLevel] || "",
    week: toWeek(g.regularOpeningHours?.periods),
    uri: g.googleMapsUri || null,
    website: g.websiteUri || null,
    type: g.primaryTypeDisplayName?.text || "",
    types: g.types || [],
    primary: g.primaryType || "",
  };
}

function apply(place, d) {
  place.g = d ? { rating: d.rating, count: d.count, price: d.price, uri: d.uri } : null;
  if (d?.week) place._week = d.week; // Google's hours beat a missing or unreadable OSM tag
  if (d?.website && !place.url) place.url = d.website;
}

// ── badge for cards, popups and the list ─────────────────────────
export function ratingBadge(p, { short = false } = {}) {
  const g = p.g;
  if (!g?.rating) return "";
  const count = g.count >= 1000 ? `${(g.count / 1000).toFixed(1).replace(".0", "")}k` : g.count;
  return short ? `⭐ ${g.rating.toFixed(1)}` : `⭐ ${g.rating.toFixed(1)} (${count})${g.price ? ` · ${g.price}` : ""}`;
}

// A "worth it" score that doesn't let 5 stars from 3 reviews beat 4.6 from 900.
export function ratingScore(p) {
  const g = p.g;
  if (!g?.rating) return null;
  return (g.rating * g.count + 4.1 * 40) / (g.count + 40);
}

// ── one place ────────────────────────────────────────────────────
const inflight = new Map();
export async function enrich(place) {
  if (!hasKey() || place.g !== undefined || !place.ll) return place;
  const k = `p:${place.id}`;
  if (store[k]) { apply(place, store[k].d); return place; }
  if (inflight.has(k)) return inflight.get(k);
  const p = call("places:searchText", {
    textQuery: `${place.n}${place.town ? `, ${place.town}` : ""}`,
    maxResultCount: 1,
    locationBias: { circle: { center: { latitude: place.ll[0], longitude: place.ll[1] }, radius: 500 } },
  })
    .then((rows) => {
      const d = rows[0] ? slim(rows[0]) : null;
      const ok = d?.ll && km(d.ll, place.ll) < 0.4 ? d : null;
      remember(k, ok);
      apply(place, ok);
      return place;
    })
    .catch(() => place) // leave g undefined so it can be tried again later
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

// ── popular places around here ───────────────────────────────────
const norm = (s) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
const NOT_WORLD = /british|american|hamburger|steak|fast_food|pub|bar|cafe|coffee|breakfast|brunch|sandwich|fish_and_chips/;
const EATS = /restaurant|pub|bar|bistro|brasserie|steak_house|pizzeria|diner|gastropub|food_court|tapas|izakaya/;
const NOT_EATS = /hotel|lodging|inn|motel|resort|farm|garden|store|shop|market|gas_station|fast_food|cafe|coffee|bakery|night_club/;

function tagsFor(d) {
  if (d.types.includes("pub")) return { cat: "pub", tags: ["pub", "drinks", "dinner"] };
  if (d.types.includes("bar") || d.types.includes("night_club")) return { cat: "drinks", tags: ["drinks"] };
  const tags = ["dinner"];
  if (d.primary && d.primary !== "restaurant" && !NOT_WORLD.test(d.primary)) tags.push("world");
  if (d.price === "£££" || d.price === "££££") tags.push("treat", "romantic");
  if (d.price === "£") tags.push("cheap");
  return { cat: "food", tags };
}

let merged = "";
async function enrichArea() {
  const l = getLoc();
  const areaKey = `a:${l.ll[0].toFixed(2)},${l.ll[1].toFixed(2)}`;
  if (!hasKey() || merged === areaKey || getStatus() !== "ready") return;
  merged = areaKey;
  let rows = store[areaKey]?.d;
  if (!rows) {
    const radius = l.kind === "home" ? 12000 : (l.span || 0.08) <= 0.05 ? 3000 : 8000;
    const near = (includedTypes) => call("places:searchNearby", {
      includedTypes, maxResultCount: 20, rankPreference: "POPULARITY",
      locationRestriction: { circle: { center: { latitude: l.ll[0], longitude: l.ll[1] }, radius } },
    });
    try {
      const [food, drink] = await Promise.all([near(["restaurant"]), near(["bar", "pub"])]);
      rows = [...food, ...drink].map(slim).filter((d) => d.ll);
      remember(areaKey, rows);
    } catch { merged = ""; return; }
  }
  if (getLoc() !== l) return; // moved on while we were fetching
  const places = getPlaces();
  for (const d of rows) {
    const n = norm(d.name);
    const match = places.find((p) => (norm(p.n) === n && km(p.ll, d.ll) < 0.3) || km(p.ll, d.ll) < 0.04 && (norm(p.n).includes(n) || n.includes(norm(p.n))));
    if (match) { apply(match, d); continue; }
    if (places.some((p) => p.id === `g-${d.gid}`)) continue;
    // Only add proper places to eat and drink (Google counts hotels, farm shops and
    // garden centres with a café as "restaurants").
    if (!EATS.test(d.primary) || NOT_EATS.test(d.primary)) continue;
    const { cat, tags } = tagsFor(d);
    const p = { id: `g-${d.gid}`, n: d.name, cat, town: "", tags, ll: d.ll, b: d.type || "Restaurant", osm: true, google: true, q: 1 };
    apply(p, d);
    places.push(p);
  }
  refresh();
}

onChange(({ status }) => { if (status === "ready") enrichArea(); });
export function startRatings() { merged = ""; enrichArea(); }

// Quick check that a key works: one tiny search near wherever Theo is looking.
export async function testGoogle() {
  const l = getLoc();
  const rows = await call("places:searchText", { textQuery: "restaurant", maxResultCount: 1, locationBias: { circle: { center: { latitude: l.ll[0], longitude: l.ll[1] }, radius: 5000 } } });
  return rows.length;
}
