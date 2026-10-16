// Real events nearby from Ticketmaster's Discovery API (needs a key in 🔑 Connections).
// Fetched once per place for the next fortnight, kept for an hour, then filtered
// per "When?": starting soon (Right now), this evening (Tonight) or the next two
// weeks (Plan ahead).
import { getKeys } from "./keys.js?v=6";
import { getLoc } from "./locale.js?v=6";

const API = "https://app.ticketmaster.com/discovery/v2/events.json";
const TTL = 60 * 60 * 1000;
let cache = { key: "", at: 0, events: [] };
let pending = null;
const listeners = new Set();
export const onEvents = (fn) => listeners.add(fn);

// Which ideas an event can stand in for.
export const IDEA_KINDS = {
  "gig-roulette": ["gig"], "jazz-bar": ["jazz"], "piano-nightcap": ["jazz"], "classical-night": ["classical"],
  "lunchtime-concert": ["classical"], "comedy-night": ["comedy"], "rush-theatre": ["theatre"], "big-theatre": ["theatre"],
  "fringe-theatre": ["theatre", "comedy"], "poster-cinema": ["film"], "matinee": ["film"],
};

function kindOf(c) {
  const seg = c?.segment?.name, genre = (c?.genre?.name || "").toLowerCase(), sub = (c?.subGenre?.name || "").toLowerCase();
  if (seg === "Music") return /jazz|blues/.test(genre) ? "jazz" : /classical|opera/.test(genre) ? "classical" : "gig";
  if (seg === "Arts & Theatre") return /comedy/.test(genre + sub) ? "comedy" : /classical|opera/.test(genre) ? "classical" : "theatre";
  if (seg === "Film") return "film";
  if (seg === "Sports") return "sport";
  return "other";
}

// Some listings arrive in ALL CAPS; make them readable.
const tidy = (s) => (s.length > 6 && s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) : s);

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

function radiusMiles(l) {
  if (l.kind === "home") return 20;
  return (l.span || 0.08) <= 0.05 ? 6 : 15;
}

function parse(json) {
  return (json?._embedded?.events || []).map((e) => {
    const v = e._embedded?.venues?.[0] || {};
    const ll = v.location ? [Number(v.location.latitude), Number(v.location.longitude)] : null;
    const st = e.dates?.start || {};
    const start = st.dateTime ? new Date(st.dateTime) : st.localDate ? new Date(`${st.localDate}T${st.localTime || "19:30:00"}`) : null;
    const price = e.priceRanges?.[0];
    return {
      id: `tm-${e.id}`,
      name: tidy(e.name),
      kind: kindOf(e.classifications?.[0]),
      genre: e.classifications?.[0]?.genre?.name && e.classifications[0].genre.name !== "Undefined" ? e.classifications[0].genre.name : "",
      start,
      timeKnown: !!(st.dateTime || st.localTime) && !st.timeTBA && !st.noSpecificTime,
      venue: v.name || "",
      town: v.city?.name || "",
      ll,
      url: e.url,
      price: price ? `from ${price.currency === "GBP" ? "£" : `${price.currency} `}${Math.round(price.min)}` : "",
      status: e.dates?.status?.code || "",
    };
  }).filter((ev) => ev.start && ev.ll && ev.status !== "cancelled" && ev.status !== "offsale");
}

export function getEvents() { return cache.events; }

export async function loadEvents(force = false) {
  const tm = getKeys().tm;
  if (!tm) return [];
  const l = getLoc();
  const key = `${l.ll[0].toFixed(2)},${l.ll[1].toFixed(2)}`;
  if (!force && cache.key === key && Date.now() - cache.at < TTL) return cache.events;
  if (pending && pending.key === key) return pending.p;
  const now = new Date();
  const end = new Date(now.getTime() + 14 * 864e5);
  const params = new URLSearchParams({
    apikey: tm, latlong: `${l.ll[0]},${l.ll[1]}`, radius: String(radiusMiles(l)), unit: "miles",
    startDateTime: iso(new Date(now.getTime() - 2 * 3600e3)), endDateTime: iso(end), sort: "date,asc", size: "200",
  });
  const p = fetch(`${API}?${params}`)
    .then((r) => { if (!r.ok) throw new Error(`ticketmaster ${r.status}`); return r.json(); })
    .then((json) => {
      cache = { key, at: Date.now(), events: parse(json) };
      listeners.forEach((fn) => fn(cache.events));
      return cache.events;
    })
    .catch(() => cache.key === key ? cache.events : [])
    .finally(() => { pending = null; });
  pending = { key, p };
  return p;
}

// Events that suit "When?": starting within ~3 hours (Right now), from 5pm today
// (Tonight), or in the next two weeks (Plan ahead).
export function eventsFor(mode, now = new Date()) {
  const t = now.getTime();
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 0, 0);
  return cache.events.filter((ev) => {
    const s = ev.start.getTime();
    if (mode === "plan") return s >= t;
    if (mode === "tonight") {
      const five = new Date(now); five.setHours(17, 0, 0, 0);
      return s >= Math.max(t - 30 * 60e3, five.getTime()) && s <= endOfDay.getTime();
    }
    return s >= t - 30 * 60e3 && s <= t + 3 * 3600e3 && s <= endOfDay.getTime() + 2 * 3600e3;
  });
}

export function hasEventFor(idea, mode, now = new Date()) {
  const kinds = IDEA_KINDS[idea.id];
  return !!kinds && eventsFor(mode, now).some((ev) => kinds.includes(ev.kind) && (ev.timeKnown || mode === "plan"));
}

export function eventForIdea(idea, mode, avoid = new Set(), now = new Date()) {
  const kinds = IDEA_KINDS[idea.id];
  if (!kinds) return null;
  const pool = eventsFor(mode, now).filter((ev) => kinds.includes(ev.kind) && !avoid.has(ev.id) && (ev.timeKnown || mode === "plan"));
  if (!pool.length) return null;
  // Prefer sooner (for Right now) or a random pick across the window (otherwise).
  return mode === "now" ? pool[0] : pool[Math.floor(Math.random() * Math.min(pool.length, 12))];
}

export const whenLabel = (ev, now = new Date()) => {
  const sameDay = ev.start.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const day = sameDay ? (ev.start.getHours() >= 17 ? "Tonight" : "Today") : ev.start.toDateString() === tomorrow.toDateString() ? "Tomorrow" : ev.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = ev.timeKnown ? ev.start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).replace(":00", "").replace(" ", "") : "";
  return [day, time].filter(Boolean).join(" ");
};
