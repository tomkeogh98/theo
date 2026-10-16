// Where Theo is looking: home (the hand-picked Oxfordshire list) or anywhere else,
// via the browser's location or a place search. Away from home, real places come
// live from OpenStreetMap (Nominatim to find the place, Overpass for what's there),
// cached in this browser so a holiday town only loads slowly once.
import { PLACES, HOME, km } from "./places.js?v=5";

const LOC_KEY = "theo.loc.v1";
const RECENT_KEY = "theo.locRecent.v1";
const CACHE_PREFIX = "theo.osm.v1:";
const CACHE_DAYS = 14;
// Public Overpass servers can be slow or busy. Ask the first; if it hasn't answered
// in a few seconds, ask the second too, and take whichever answers first.
const OVERPASS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const NOMINATIM = "https://nominatim.openstreetmap.org";

export const HOME_LOC = { name: "Home", sub: "Oxfordshire", ll: HOME.ll, kind: "home" };

function read(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

let loc = read(LOC_KEY, null) || HOME_LOC;
let places = loc.kind === "home" ? PLACES : cachedFor(loc) || [];
let status = "ready"; // ready | loading | error
let pending = null;
let token = 0;
const listeners = new Set();

export const getLoc = () => loc;
export const getPlaces = () => places;
export const getStatus = () => status;
export const onChange = (fn) => listeners.add(fn);
export const whenReady = () => pending || Promise.resolve();
export const recentLocs = () => read(RECENT_KEY, []);
function emit() { listeners.forEach((fn) => fn({ loc, places, status })); }

function cacheKey(l) { return `${CACHE_PREFIX}${l.ll[0].toFixed(2)},${l.ll[1].toFixed(2)}`; }
function cachedFor(l) {
  const c = read(cacheKey(l), null);
  return c && Date.now() - c.at < CACHE_DAYS * 864e5 ? c.places : null;
}

function remember(l) {
  if (l.kind === "home") return;
  const list = recentLocs().filter((r) => r.name !== l.name);
  write(RECENT_KEY, [{ name: l.name, sub: l.sub, ll: l.ll, span: l.span }, ...list].slice(0, 4));
}

export function setLoc(next) {
  // Anywhere within ~20km of home counts as home: the hand-picked list is better there.
  if (next.kind !== "home" && km(next.ll, HOME.ll) < 20) next = HOME_LOC;
  loc = next;
  write(LOC_KEY, loc);
  remember(loc);
  const mine = ++token;
  if (loc.kind === "home") { places = PLACES; status = "ready"; pending = null; emit(); return Promise.resolve(); }
  const cached = cachedFor(loc);
  if (cached) { places = cached; status = "ready"; pending = null; emit(); return Promise.resolve(); }
  places = [];
  status = "loading";
  emit();
  pending = fetchPlaces(loc)
    .then((ps) => {
      if (mine !== token) return;
      places = ps;
      status = "ready";
      write(cacheKey(loc), { at: Date.now(), places: ps });
    })
    .catch(() => { if (mine === token) { places = []; status = "error"; } })
    .finally(() => { if (mine === token) { pending = null; emit(); } });
  return pending;
}

// Kick off a fetch on load if we were last somewhere else and the cache has expired.
export function resume() {
  if (loc.kind !== "home" && !places.length) setLoc(loc);
}

// ── Finding places by name or by GPS ─────────────────────────────

const SPAN = { city: 0.04, borough: 0.05, suburb: 0.035, quarter: 0.03, neighbourhood: 0.03, town: 0.08, village: 0.12, hamlet: 0.14 };

function describe(r) {
  const a = r.address || {};
  const name = r.name || a.town || a.city || a.village || a.suburb || r.display_name.split(",")[0];
  const region = a.county || a.state_district || a.state || a.region;
  const sub = [region !== name ? region : null, a.country_code === "gb" ? null : a.country].filter(Boolean).join(", ") || a.country || "";
  return { name, sub, ll: [Number(r.lat), Number(r.lon)], span: SPAN[r.addresstype] || 0.08 };
}

export async function searchPlaces(q) {
  const url = `${NOMINATIM}/search?${new URLSearchParams({ q, format: "jsonv2", limit: "5", addressdetails: "1", "accept-language": "en" })}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({ ...describe(r), kind: "search" }));
}

export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      let found = { name: "Right here", sub: "", ll, span: 0.07 };
      try {
        const url = `${NOMINATIM}/reverse?${new URLSearchParams({ lat: ll[0], lon: ll[1], format: "jsonv2", zoom: "14", addressdetails: "1", "accept-language": "en" })}`;
        const r = await (await fetch(url, { headers: { Accept: "application/json" } })).json();
        const d = describe(r);
        found = { ...d, name: r.address?.town || r.address?.city || r.address?.village || r.address?.suburb || d.name, ll, span: 0.07 };
      } catch { /* a name is nice-to-have; coordinates are enough */ }
      resolve({ ...found, kind: "gps" });
    }, (err) => reject(err), { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 });
  });
}

// ── What's around: Overpass → Theo's place format ────────────────

function bbox([lat, lon], d) {
  const dLon = d / Math.cos((lat * Math.PI) / 180);
  return [lat - d, lon - dLon, lat + d, lon + dLon].map((n) => n.toFixed(4)).join(",");
}

// One query for everything, so each server only sees one request from us.
function query(ll, d) {
  return `[out:json][timeout:60][bbox:${bbox(ll, d)}];
(
 nwr[amenity~"^(restaurant|pub|bar|music_venue|nightclub|theatre|cinema|arts_centre|marketplace|boat_rental)$"][name];
 nwr[tourism~"^(museum|gallery|viewpoint)$"][name];
 nwr[shop~"^(music|books)$"][name];
 nwr[leisure~"^(nature_reserve|park|ice_rink|miniature_golf|bowling_alley|swimming_pool)$"][name];
 nwr[natural=beach][name];
 nwr[historic=castle][name];
 nwr[railway=station][name][station!~"subway|light_rail|monorail"];
 nwr[sport=climbing][name];
);
out center tags 3000;`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(q) {
  const ctrls = OVERPASS.map(() => new AbortController());
  const attempt = async (url, i) => {
    if (i) await sleep(5000); // hedge: only bother the backup if the first is slow
    if (ctrls[i].signal.aborted) throw new Error("cancelled");
    const timer = setTimeout(() => ctrls[i].abort(), 75000);
    try {
      const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: q }), signal: ctrls[i].signal });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.elements)) throw new Error("overpass: no elements");
      return json;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await Promise.any(OVERPASS.map(attempt));
  } finally {
    ctrls.forEach((c) => c.abort()); // stop whichever is still going
  }
}

// Busy servers often say no straight away, so try again a couple of times.
async function fetchAll(ll, d) {
  let lastErr;
  for (let round = 0; round < 3; round++) {
    if (round) await sleep(round * 6000);
    try { return await overpass(query(ll, d)); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function fetchPlaces(l) {
  const d = l.span || 0.08;
  let ps = parse(await fetchAll(l.ll, d), l);
  if (ps.length < 60 && d < 0.16) {
    try { ps = parse(await fetchAll(l.ll, 0.16), l); } catch { /* keep the smaller set */ }
  }
  return ps;
}

const NOT_WORLD = new Set(["british", "english", "regional", "fish_and_chips", "burger", "steak_house", "sandwich", "breakfast", "coffee_shop", "cafe", "pub", "american", "chicken", "local"]);
const ROMANTIC = new Set(["french", "italian", "mediterranean", "spanish", "tapas", "seafood", "fine_dining", "greek", "portuguese", "japanese", "wine_bar", "oyster", "fish"]);
const CHEAP = new Set(["pizza", "noodle", "ramen", "vietnamese", "thai", "indian", "kebab", "burger", "mexican", "chinese", "fish_and_chips", "street_food", "korean", "turkish", "lebanese", "nepalese", "sri_lankan", "malaysian", "middle_eastern"]);
const CAP = { food: 90, pub: 40, drinks: 30, music: 20, stage: 25, culture: 30, outdoors: 45, active: 20 };

const nice = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "&");

function classify(t) {
  const a = t.amenity, tour = t.tourism, lei = t.leisure;
  if (["private", "customers", "no"].includes(t.access)) return null;
  if (lei === "swimming_pool" && /paddl|splash|hotel|school|lido club/i.test(t.name)) return null;
  if (a === "restaurant") {
    const cuisines = (t.cuisine || "").split(";").map((c) => c.trim().toLowerCase()).filter(Boolean);
    const tags = ["dinner", "new"];
    if (cuisines.some((c) => !NOT_WORLD.has(c))) tags.push("world");
    if (cuisines.some((c) => ROMANTIC.has(c))) tags.push("romantic");
    if (cuisines.some((c) => CHEAP.has(c))) tags.push("cheap");
    return { cat: "food", label: cuisines.length ? `${nice(cuisines[0])} restaurant` : "Restaurant", tags };
  }
  if (a === "pub") return { cat: "pub", label: "Pub", tags: ["pub", "drinks", ...(t.food && t.food !== "no" ? ["dinner"] : [])] };
  if (a === "bar") return { cat: "drinks", label: "Bar", tags: ["drinks"] };
  if (a === "music_venue") return { cat: "music", label: "Music venue", tags: ["gig", "jazz"] };
  if (a === "nightclub") return { cat: "music", label: "Club", tags: ["gig"] };
  if (t.shop === "music") return { cat: "music", label: "Record shop", tags: ["records"] };
  if (a === "theatre") return { cat: "stage", label: "Theatre", tags: ["theatre", "fringe", "comedy", "classical"] };
  if (a === "cinema") return { cat: "stage", label: "Cinema", tags: ["cinema"] };
  if (a === "arts_centre") return { cat: "stage", label: "Arts centre", tags: ["fringe", "comedy", "theatre"] };
  if (tour === "museum") return { cat: "culture", label: "Museum", tags: ["museum"] };
  if (tour === "gallery") return { cat: "culture", label: "Gallery", tags: ["museum"] };
  if (t.shop === "books") return { cat: "culture", label: "Bookshop", tags: ["bookshop"] };
  if (a === "marketplace") return { cat: "culture", label: "Market", tags: ["market"] };
  if (tour === "viewpoint") return { cat: "outdoors", label: "Viewpoint", tags: ["viewpoint", "dark-sky"] };
  if (t.natural === "beach") return { cat: "outdoors", label: "Beach", tags: ["coast", "walk", "picnic", "swim", "viewpoint"] };
  if (t.historic === "castle") return { cat: "outdoors", label: "Castle", tags: ["castle", "walk"] };
  if (lei === "nature_reserve") return { cat: "outdoors", label: "Nature reserve", tags: ["walk", "dark-sky", "picnic"] };
  if (lei === "park") return { cat: "outdoors", label: "Park", tags: ["walk", "picnic"] };
  if (t.railway === "station") return { cat: "outdoors", label: "Station", tags: ["train"] };
  if (t.sport === "climbing") return { cat: "active", label: "Climbing", tags: ["climb"] };
  if (lei === "swimming_pool") return { cat: "active", label: "Swimming pool", tags: ["swim"] };
  if (lei === "ice_rink") return { cat: "active", label: "Ice rink", tags: ["skate"] };
  if (lei === "miniature_golf") return { cat: "active", label: "Crazy golf", tags: ["minigolf"] };
  if (lei === "bowling_alley") return { cat: "active", label: "Bowling", tags: ["minigolf"] };
  if (a === "boat_rental") return { cat: "active", label: "Boat hire", tags: ["punt"] };
  return null;
}

const safeUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : u && /^www\./i.test(u) ? `https://${u}` : null);

function parse(json, l) {
  const seen = new Set();
  const out = [];
  for (const e of json.elements || []) {
    const t = e.tags || {};
    const ll = e.center ? [e.center.lat, e.center.lon] : [e.lat, e.lon];
    if (!t.name || ll[0] == null) continue;
    const kind = classify(t);
    if (!kind) continue;
    const dupe = `${t.name}|${kind.cat}`;
    if (seen.has(dupe)) continue;
    seen.add(dupe);
    const url = safeUrl(t.website || t["contact:website"]);
    const q = (url ? 1 : 0) + (t.opening_hours ? 0.5 : 0) + (t.cuisine ? 0.5 : 0) - (t.brand ? 1.2 : 0);
    out.push({
      id: `osm-${e.type[0]}${e.id}`,
      n: t.name,
      cat: kind.cat,
      town: t["addr:city"] || t["addr:town"] || t["addr:village"] || t["addr:suburb"] || "",
      tags: kind.tags,
      ll: [Number(ll[0].toFixed(5)), Number(ll[1].toFixed(5))],
      b: kind.label,
      hours: t.opening_hours || null,
      url,
      q,
      osm: true,
      d: km(l.ll, ll),
    });
  }
  // Keep the nearest few of each kind so a big city doesn't drown the map.
  const byCat = {};
  out.sort((a, b) => a.d - b.d).forEach((p) => (byCat[p.cat] ||= []).push(p));
  return Object.entries(byCat).flatMap(([cat, ps]) => ps.slice(0, CAP[cat] || 20)).map(({ d, ...p }) => p);
}
