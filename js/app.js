import { IDEAS } from "./ideas.js?v=8";
import { VIBES, deal, bends, weight as ideaWeight, ANYTHING, COST_LABEL, WHERE_LABEL, WHERE_EMOJI } from "./picker.js?v=8";
import { localIdeas, detourFor } from "./compose.js?v=8";
import { seasonFit } from "./season.js?v=8";
import { onAdventures, adventureStatus, getAdventures, loadAdventures, timeline, latestLeave, fmtKm, fmtMins, theTrail, blurb as walkBlurb } from "./adventures.js?v=8";
import { onKnown, getKnown, loadKnown, knownStatus, knownSummary } from "./knownfor.js?v=8";
import { weatherWindow, weatherLine } from "./weather.js?v=8";
import { INTERESTS, PEOPLE, interestById, getInterests, setInterests, resetInterests } from "./interests.js?v=8";
import { whyNot, goByHint, leaveBy, momentLine, clock, startFor } from "./when.js?v=8";
import { getKeys, setKeys, setupLink, absorbSetupLink } from "./keys.js?v=8";
import { loadEvents, onEvents, eventsFor, eventForIdea, hasEventFor, whenLabel } from "./events.js?v=8";
import { ratingBadge, enrich, startRatings, testGoogle } from "./ratings.js?v=8";
import { hoursLine } from "./when.js?v=8";
import { ratingScore } from "./ratings.js?v=8";
import { THEO_SVG, theoLine } from "./theo.js?v=8";
import { diary, savedPrefs, recentIds, weekStreak } from "./store.js?v=8";
import { PLACES, travel, travelLabel, mapsSearch, mapsDirections } from "./places.js?v=8";
import { initMap, showPicks, pickPlace, focusPlace, focusRoute, eventPlace, setEventMode } from "./map.js?v=8";
import { getLoc, getPlaces, getStatus, onChange, setLoc, resume, whenReady, searchPlaces, locate, recentLocs, HOME_LOC } from "./locale.js?v=8";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const byId = new Map(IDEAS.map((i) => [i.id, i]));
let pool = IDEAS;
function refreshPool() {
  pool = [...IDEAS, ...localIdeas()];
  return pool;
}
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, calm() ? 0 : ms));
const SHORT_TIME = { 1: "1–2 hrs", 2: "3–4 hrs", 3: "All day" };

// ── Theo ─────────────────────────────────────────────────────────
$$("[data-theo]").forEach((el) => (el.innerHTML = THEO_SVG));
const dealer = $("#dealerCat");
const bubble = $("#bubble");

function say(text, mood = "") {
  bubble.textContent = text;
  bubble.classList.remove("pop");
  void bubble.offsetWidth; // restart the pop animation
  bubble.classList.add("pop");
  dealer.dataset.mood = mood;
}

dealer.addEventListener("click", () => {
  say(theoLine("pet"), "purr");
  burst(8, dealer);
});

// ── Greeting ─────────────────────────────────────────────────────
function greet(now = new Date()) {
  const h = now.getHours();
  const day = now.toLocaleDateString("en-GB", { weekday: "long" });
  const weekend = [0, 6].includes(now.getDay());
  if (h < 5) return ["Still up, Tom & Cat?", "Something small and cosy, then bed. Theo's already asleep on your side."];
  if (h < 12) return weekend
    ? [`${day} morning, Tom & Cat.`, "A whole day's stretching out ahead of you. Tell Theo the vibe and he'll find something to do right now."]
    : ["Morning, Tom & Cat.", "Something to do right now, or planning tonight? Pick When, tell Theo the vibe, and go."];
  if (h < 17) return weekend
    ? [`${day} afternoon, Tom & Cat.`, "Plenty of day left. Tell Theo the vibe and go."]
    : [`${day} afternoon, Tom & Cat.`, "Free right now, or sorting tonight? Pick When and tell Theo the vibe."];
  if (now.getDay() === 5) return ["It's Friday night, Tom & Cat.", "Week's done. Tell Theo the vibe and he'll deal you three ideas."];
  if (weekend) return [`${day} night, Tom & Cat.`, "Tell Theo the vibe, pick a postcard, then close the laptop and go and do it."];
  return [`${day} night, Tom & Cat.`, "School-night dates count double. Tell Theo the vibe."];
}
function renderGreeting() {
  const [hello, lede] = greet();
  $("#greeting").textContent = hello;
  $("#lede").textContent = lede;
}
renderGreeting();

// ── Picker ───────────────────────────────────────────────────────
const form = $("#picker");
$("#vibes").innerHTML = VIBES.map(
  (v) => `<label class="chip"><input type="checkbox" name="vibe" value="${v.id}"><span><i aria-hidden="true">${v.emoji}</i>${v.label}</span></label>`,
).join("");

function defaultTime(now = new Date()) {
  const h = now.getHours();
  if (h >= 21 || h < 5) return 1;
  if ([0, 6].includes(now.getDay()) && h < 13) return 3;
  return 2;
}

(function restorePrefs() {
  const p = savedPrefs.get();
  if (p) {
    p.vibes?.forEach((v) => { const box = form.querySelector(`input[name=vibe][value="${v}"]`); if (box) box.checked = true; });
    for (const k of ["where", "cost", "whose"]) {
      const r = form.querySelector(`input[name=${k}][value="${p[k]}"]`);
      if (r) r.checked = true;
    }
  }
  form.querySelector(`input[name=time][value="${defaultTime()}"]`).checked = true;
})();

function readPrefs() {
  const fd = new FormData(form);
  return {
    vibes: fd.getAll("vibe"),
    where: fd.get("where"),
    time: Number(fd.get("time")),
    cost: Number(fd.get("cost")),
    whose: fd.get("whose"),
    when: fd.get("when") || "now",
  };
}

// ── When? ────────────────────────────────────────────────────────
function renderWhen() {
  renderGreeting();
  $("#nowClock").textContent = `(${clock(new Date())})`;
  $("#whenHint").textContent = momentLine(readPrefs().when, getLoc().ll);
}
form.addEventListener("change", (e) => { if (e.target.name === "when") { renderWhen(); setEventMode(readPrefs().when); } });
setInterval(renderWhen, 30000);
renderWhen();


// ── Where are we? ────────────────────────────────────────────────
// Home uses Theo's hand-picked list; anywhere else (GPS or a search) pulls real
// places live from OpenStreetMap. Postcards, the map and the list all follow it.
const locNow = $("#locNow");
const locStatus = $("#locStatus");
const locResults = $("#locResults");
const locInput = $("#locInput");
const locLabel = (l) => (l.kind === "home" ? "Home, Oxfordshire" : [l.name, l.sub].filter(Boolean).join(", "));

function renderWhere() {
  const loc = getLoc();
  const status = getStatus();
  const evCount = getKeys().tm ? eventsFor("plan").length : 0;
  locNow.textContent = locLabel(loc);
  // What the place is known for (Wikivoyage's own one-liner), away from home.
  const about = loc.kind === "home" ? "" : knownSummary();
  const twoLines = about ? about.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ") : "";
  $("#locAbout").textContent = twoLines.length > 230 ? `${twoLines.slice(0, 227).replace(/\s+\S*$/, "")}…` : twoLines;
  $("#locAbout").hidden = !about;
  $("#mapWhere").textContent = loc.kind === "home" ? "home" : loc.name;
  locStatus.textContent = status === "loading"
    ? `Sniffing around ${loc.name}… The first visit can take up to a minute; after that it's instant.`
    : status === "error"
      ? "Couldn't load places just now. The ideas still work."
      : loc.kind === "home"
        ? `Using Theo's hand-picked spots near home${getKeys().g ? ", plus Google's most popular" : ""}.`
        : `${getPlaces().length} real places nearby, live from OpenStreetMap.`;
  if (evCount && status !== "loading") locStatus.textContent += ` 🎟️ ${evCount} events coming up nearby.`;
  const walks = getAdventures().length, known = getKnown().filter((a) => travel(a.ll, loc.ll).mins <= 45).length;
  if (adventureStatus() === "loading" || knownStatus() === "loading") locStatus.textContent += " 🥾 Scouting local walks and favourites…";
  else if (walks || known) locStatus.textContent += ` ${walks ? `🥾 ${walks} local walks` : ""}${walks && known ? " · " : ""}${known ? `📍 ${known} local favourites` : ""}.`;
  const recents = recentLocs().filter((r) => r.name !== loc.name);
  $("#locRecent").innerHTML = [
    loc.kind === "home" ? "" : `<button type="button" class="loc-chip" data-home>🏠 Home</button>`,
    ...recents.map((r) => `<button type="button" class="loc-chip" data-recent="${esc(r.name)}">📍 ${esc(r.name)}</button>`),
  ].join("");
}

$("#locRecent").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-home")) return chooseLoc(HOME_LOC);
  const r = recentLocs().find((x) => x.name === b.dataset.recent);
  if (r) chooseLoc({ ...r, kind: "search" });
});

function chooseLoc(l) {
  locResults.hidden = true;
  locResults.innerHTML = "";
  locInput.value = "";
  $("#locMore").hidden = true;
  $("#locToggle").setAttribute("aria-expanded", "false");
  setLoc(l);
}

async function useGps() {
  locStatus.textContent = "Asking your browser where you are…";
  try {
    chooseLoc(await locate());
  } catch (err) {
    locStatus.textContent = err?.code === 1
      ? "Theo needs permission to see where you are. Or just type the place."
      : "Couldn't get your location. Try typing the place instead.";
  }
}
$("#locGps").addEventListener("click", useGps);
$("#mapGps").addEventListener("click", useGps);

async function doSearch() {
  const q = locInput.value.trim();
  if (!q) return locInput.focus();
  locStatus.textContent = `Looking for "${q}"…`;
  try {
    const rows = await searchPlaces(q);
    if (!rows.length) { locStatus.textContent = `Theo couldn't find "${q}". Try adding the town or country?`; return; }
    if (rows.length === 1) return chooseLoc(rows[0]);
    locResults.innerHTML = rows
      .map((r, i) => `<li><button type="button" data-i="${i}"><span aria-hidden="true">📍</span> <b>${esc(r.name)}</b> <small>${esc(r.sub)}</small></button></li>`)
      .join("");
    locResults.hidden = false;
    locResults.onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) chooseLoc(rows[Number(b.dataset.i)]); };
    locStatus.textContent = "Which one did you mean?";
    locResults.querySelector("button").focus();
  } catch {
    locStatus.textContent = "Search isn't working right now. Try again in a moment.";
  }
}
$("#locGo").addEventListener("click", doSearch);
locInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
function openSearch() {
  $("#locMore").hidden = false;
  $("#locToggle").setAttribute("aria-expanded", "true");
  locInput.focus({ preventScroll: true });
}
$("#locToggle").addEventListener("click", () => {
  const open = $("#locMore").hidden;
  $("#locMore").hidden = !open;
  $("#locToggle").setAttribute("aria-expanded", String(open));
  if (open) locInput.focus();
});
$("#mapChange").addEventListener("click", () => {
  $("#whereAreWe").scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "center" });
  setTimeout(openSearch, calm() ? 0 : 400);
});

// ── Dealing ──────────────────────────────────────────────────────
// Each card in the hand is { idea, place }, where place is a real spot nearby (or null).
const results = $("#results");
const deck = $("#deck");
let hand = []; // [{ idea, bends, place }]
let seen = new Set();
let lastMode = "ask";
let lastDealKey = "";
let lastPrefs = ANYTHING;
// Surprise ignores your choices, but never the clock.
const prefsFor = (mode) => (mode === "surprise" ? { ...ANYTHING, when: readPrefs().when } : readPrefs());
// Doable then, or there's a real event for it then (a gig at 9pm makes "Gig Roulette" doable).
const possibleFor = (prefs) => (idea) => !whyNot(idea, prefs.when, getLoc().ll) || hasEventFor(idea, prefs.when);
// Would your choices find (more) exact matches if you weren't limited to now/tonight?
const laterHelps = (prefs) => deal(pool, { ...prefs, when: "plan" }, { interests: getInterests() }).exact > deal(pool, prefs, { interests: getInterests(), possible: possibleFor(prefs) }).exact;
const LOCAL_BOOST = { walk: 4, event: 3.5, known: 3, flavour: 2, season: 1 };
function weatherSoon() {
  const t = new Date();
  return weatherWindow(t, new Date(t.getTime() + 4 * 3600e3));
}
// What you've loved before: interests of dates you've marked as done, as gentle nudges.
function likedInterests() {
  const counts = {};
  for (const e of diary.all().filter((x) => x.doneAt)) {
    const idea = byId.get(e.id) || e.idea;
    for (const t of idea?.i || []) counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}
const boostFor = (prefs) => {
  const wet = weatherSoon()?.wet && prefs.when !== "plan";
  const liked = likedInterests();
  return (idea) => {
    let b = prefs.when !== "plan" && hasEventFor(idea, prefs.when) ? 4 : 1;
    if (idea.local) b *= LOCAL_BOOST[idea.kindOf] || 2;
    // The place's best-known sights over its minor ones (Tate Modern over a plaque).
    if (idea.kindOf === "known") b *= 0.35 + Math.min(1.65, (idea.anchorScore ?? 3) / 4.5);
    // A real show tonight beats "a venue, see what's on".
    if (idea.kindOf === "event") b *= prefs.when === "plan" ? 1.5 : 4;
    if (idea.adv) b *= (1 + Math.max(0, idea.adv.score - 8) / 6) * (idea.adv.dest.kind === "food" ? 0.4 : 1); // scenic payoffs beat "walk to a pub"
    b *= seasonFit(idea).w;
    if (wet && (idea.w === "outdoor" || idea.adv)) b *= 0.35;
    const love = (idea.i || []).reduce((s, t) => s + (liked[t] || 0), 0);
    b *= Math.min(1.5, 1 + love * 0.08);
    return b;
  };
};

// When you're heading out, lead with dates you could only have here: at least two of
// the three cards are local (a walk, something the place is known for, a show…),
// and of different kinds, as long as they fit everything you picked.
function ensureLocal(picks, prefs, recent, { lead = false } = {}) {
  if (prefs.where === "in" || picks.length < 2) return picks;
  const possible = possibleFor(prefs);
  const ints = getInterests();
  const boost = boostFor(prefs);
  const want = Math.min(2, picks.length);
  let out = picks.slice();
  // The strongest date around here (Dartmouth Castle and the coast path to Blackpool
  // Sands, say) leads a fresh hand, so the best of a place isn't left to chance.
  let top = null;
  if (lead) {
    top = pool.filter((i) => i.local && possible(i) && !bends(i, prefs).length)
      .map((i) => ({ i, w: ideaWeight(i, prefs, recent, ints) * boost(i) * (prefs.time && i.time === prefs.time ? 1.5 : 1) }))
      .sort((a, b) => b.w - a.w)[0]?.i || null;
    if (top && !out.some((c) => c.idea.id === top.id)) {
      // In place of a near miss, else the last card from the general list, else the last card.
      const bent = out.findIndex((c) => c.bends.length);
      const general = out.map((c) => !c.idea.local).lastIndexOf(true);
      out[bent >= 0 ? bent : general >= 0 ? general : out.length - 1] = { idea: top, bends: [] };
    }
  }
  for (let round = 0; round < want; round++) {
    const local = out.filter((c) => c.idea.local && !c.bends.length);
    if (local.length >= want) break;
    const kinds = new Set(local.map((c) => c.idea.kindOf));
    const used = new Set(out.map((c) => c.idea.id));
    const spotName = (i) => (i.adv?.dest.name || i.anchor?.n || "").toLowerCase().replace(/^explore |^the /, "");
    const spots = new Set(out.map((c) => spotName(c.idea)).filter(Boolean));
    const options = pool
      .filter((i) => i.local && !used.has(i.id) && possible(i) && !bends(i, prefs).length && !spots.has(spotName(i)))
      .map((i) => ({ i, w: ideaWeight(i, prefs, recent, ints) * boost(i) * (kinds.has(i.kindOf) ? 0.35 : 1) }));
    if (!options.length) break;
    // weighted random, so it isn't the same date every time
    const total = options.reduce((s, o) => s + o.w, 0);
    let r = Math.random() * total;
    const pick = options.find((o) => (r -= o.w) <= 0) || options[0];
    const swapAt = (() => {
      const bent = out.findIndex((c) => c.bends.length);
      if (bent >= 0) return bent;
      for (let k = out.length - 1; k >= 0; k--) if (!out[k].idea.local) return k;
      return -1;
    })();
    if (swapAt < 0) break;
    out[swapAt] = { idea: pick.i, bends: [] };
  }
  // No more than two shows in a hand: leave room for something different.
  const shows = out.map((c, k) => (c.idea.kindOf === "event" ? k : -1)).filter((k) => k >= 0);
  if (shows.length > 2) {
    const used = new Set(out.map((c) => c.idea.id));
    const alt = pool.filter((i) => i.local && i.kindOf !== "event" && !used.has(i.id) && possible(i) && !bends(i, prefs).length)
      .sort((a, b) => ideaWeight(b, prefs, recent, ints) * boost(b) - ideaWeight(a, prefs, recent, ints) * boost(a))[0];
    if (alt) out[shows[2]] = { idea: alt, bends: [] };
  }
  // Local first, so the best of here leads the hand (and the top pick before that).
  const first = (c) => (top && c.idea.id === top.id ? 0 : c.idea.local ? 1 : 2);
  return out.map((c, k) => ({ c, k })).sort((a, b) => first(a.c) - first(b.c) || a.k - b.k).map((x) => x.c);
}

// Event-type ideas get a live "what's on" search for wherever you are.
const WHATS_ON = {
  "gig-roulette": "gigs", "open-mic": "open mic night", "jazz-bar": "live jazz", "classical-night": "classical concert",
  "rush-theatre": "theatre", "big-theatre": "theatre shows", "fringe-theatre": "fringe theatre", "comedy-night": "comedy night",
  "poster-cinema": "cinema listings", "matinee": "cinema listings", "museum-late": "museum late opening", "open-air-show": "open air theatre or cinema",
  "lunchtime-concert": "lunchtime concert", "piano-nightcap": "live piano bar", "dance-class": "beginners dance class",
  "life-drawing": "life drawing class", "improv-taster": "improv class", "cooking-class": "cooking class", "pottery-class": "pottery taster class",
  "escape-room": "escape room", "treetop-adventure": "high ropes course", "countryside-hack": "beginner horse riding",
  "vineyard-tasting": "vineyard tour and tasting", "spa-day": "spa day", "sunset-boat": "sunset boat trip", "roller-disco": "ice skating or roller disco",
  "market-graze": "food market", "market-to-plate": "farmers market", "busker-bingo": "street performers",
  "afternoon-tea": "afternoon tea", "brunch-new": "best brunch", "dessert-crawl": "best desserts",
};
function eventLine(ev) {
  return `
    <div class="pc-event">
      <button type="button" class="pc-event-main" data-map="${ev.id}">
        <span aria-hidden="true">🎟️</span>
        <span><b>${esc(ev.name)}</b><small>${esc(ev.venue)} · ${esc(whenLabel(ev))}${ev.price ? ` · ${esc(ev.price)}` : ""} · ${travelLabel(ev.ll, getLoc().ll)}</small></span>
      </button>
      <a class="pc-tickets" href="${esc(ev.url)}" target="_blank" rel="noopener">Tickets ↗</a>
    </div>`;
}

function whatsOnLink(idea, prefs) {
  const what = idea.search || WHATS_ON[idea.id];
  if (!what) return "";
  const loc = getLoc();
  const near = loc.kind === "home" ? "Oxford" : loc.name;
  const whenWord = prefs.when === "plan" ? "this week" : prefs.when === "tonight" || startFor(prefs.when).getHours() >= 16 ? "tonight" : "today";
  const q = `${what} ${whenWord} near ${near}`;
  return `<a class="pc-whatson" href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">🔎 What's on ${esc(whenWord)} near ${esc(near)} ↗</a>`;
}

function placeLine(place, idea) {
  if (!place) {
    return idea?.go && getStatus() === "loading"
      ? `<p class="pc-place pc-place-wait"><span aria-hidden="true">🐾</span><span>Theo's still sniffing out a spot nearby…</span></p>`
      : "";
  }
  return `
    <button type="button" class="pc-place" data-map="${place.id}">
      <span aria-hidden="true">📍</span>
      <span><b>${esc(place.n)}</b>${place.isNew ? ` <span class="new">New</span>` : ""}${ratingBadge(place) ? ` <span class="pc-stars">${ratingBadge(place)}</span>` : ""}<small>${esc(place.osm ? place.b : place.town)} · ${travelLabel(place.ll, getLoc().ll)} · see on map</small></span>
    </button>`;
}

// A pairing line: where to eat or drink, with stars and opening hours when known.
function pairLine(pair, role) {
  if (!pair) return "";
  const label = role === "dinner" ? "Dinner first" : role === "lunch" ? "Lunch first" : role === "after" ? "After" : "Then";
  const stars = ratingBadge(pair);
  const hrs = hoursLine(pair);
  const icon = pair.cat === "pub" ? "🍺" : pair.cat === "drinks" ? "🍸" : /caf[eé]|coffee|tea/i.test(`${pair.n} ${pair.b}`) ? "☕" : "🍽️";
  return `
    <button type="button" class="pc-pair" data-map="${esc(pair.id)}">
      <span aria-hidden="true">${icon}</span>
      <span><small class="pair-role">${label}</small> <b>${esc(pair.n)}</b>${stars ? ` <span class="pc-stars">${esc(stars)}</span>` : ""}${hrs ? `<small>${esc(hrs)}</small>` : ""}</span>
    </button>`;
}

// A walk's itinerary: distance, climb, a timeline from now, the café, the way back.
const RIDE = { bus: ["🚌", "Bus"], ferry: ["⛴️", "Ferry"], train: ["🚆", "Train"], tube: ["🚇", "Tube or train"] };
function walkBlock(card) {
  const a = card.idea.adv;
  const mode = lastPrefs.when;
  const plan = mode === "plan";
  const tl = timeline(a, mode, new Date());
  const at = (d) => (plan ? "" : `${clock(d)} · `);
  const stops = [];
  if (a.start.kind === "drive") stops.push(`🚗 ${at(tl.leave)}Drive to ${a.start.name} (${a.start.driveMins} min)`);
  if (a.start.kind === "ride") stops.push(`🚇 ${at(tl.leave)}Tube or bus to ${a.start.name} (${a.start.driveMins} min)`);
  stops.push(`🥾 ${at(tl.setOff)}Set off${a.start.kind !== "door" ? ` from ${a.start.name}` : ""}`);
  tl.stops.forEach((x) => stops.push(`📍 ${at(x.at)}${x.name}`));
  stops.push(`🏁 ${at(tl.arrive)}${a.dest.name}`);
  if (card.pair) stops.push(`☕ ${card.pair.n}${ratingBadge(card.pair) ? ` ${ratingBadge(card.pair, { short: true })}` : ""}`);
  stops.push(a.ret
    ? `${RIDE[a.ret.kind][0]} ${RIDE[a.ret.kind][1]} back${plan ? "" : ` from about ${clock(tl.back)}`} (or walk back, ${fmtMins(a.walkMins)})`
    : `↩️ Walk back${plan ? "" : `, home by about ${clock(tl.home)}`}`);
  const climb = (a.ascent || 0) >= 60 ? ` · ⛰️ ${a.ascent} m up` : "";
  return `
    <div class="pc-walk">
      <p class="walk-stats">🥾 ${fmtKm(a.walkKm)}${a.trail ? ` on ${esc(theTrail(a.trail.name))}` : ""} · about ${fmtMins(a.walkMins)}${climb}</p>
      <ol class="walk-stops">${stops.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      ${a.path.length > 2 ? `<button type="button" class="pc-route" data-route="${esc(card.idea.id)}">🗺️ See the route</button>` : ""}
    </div>`;
}

// Why this, here, now: local, seasonal, and the weather for outdoor plans.
function hooksLine(card) {
  const { idea } = card;
  const loc = getLoc();
  const bits = [];
  if (idea.local) {
    const spot = idea.adv?.dest.ll || idea.anchor?.ll || card.pair?.ll;
    const far = idea.adv ? idea.adv.start.kind !== "door" : spot && travel(spot, loc.ll).mins > 20;
    const town = idea.anchor?.area || idea.anchor?.guide?.replace(/\s*\(.*\)/, "");
    const otherTown = town && loc.kind !== "home" && !loc.name.toLowerCase().includes(town.toLowerCase()) && !town.toLowerCase().includes(loc.name.toLowerCase());
    bits.push(idea.kindOf === "event" ? "🎟️ On nearby"
      : otherTown ? `📍 In ${town}, ${travel(idea.anchor.ll, loc.ll).mins} min away`
      : loc.kind === "home" ? "📍 Local to you" : far ? `📍 Near ${loc.name}` : `📍 Only in ${loc.name}`);
    const detour = detourFor(card, getInterests());
    if (detour) bits.push(detour.hook);
    if (idea.highlight) bits.push(`🌟 One of ${otherTown ? `${town}'s` : loc.kind === "home" ? "the area's" : `${loc.name}'s`} highlights`);
  }
  const sf = seasonFit(idea);
  if (sf.hook) bits.push(sf.hook);
  if (idea.w === "outdoor" || idea.adv || idea.w === "out") {
    const start = startFor(lastPrefs.when === "plan" ? "now" : lastPrefs.when);
    const end = idea.adv ? timeline(idea.adv, lastPrefs.when).back : new Date(start.getTime() + 3 * 3600e3);
    const w = lastPrefs.when === "plan" ? null : weatherWindow(start, end);
    const line = weatherLine(w, clock);
    if (line) bits.push(line);
  }
  return bits.length ? `<p class="pc-hooks">${bits.map((b) => `<span>${esc(b)}</span>`).join("")}</p>` : "";
}

// Why Theo picked it: what it matches, or which of your rules it bends.
const SETTING = { in: "it's a stay-at-home one", outdoor: "it's outdoors", venue: "it means going somewhere", out: "it's an outing" };
function whyLine(idea, bendList, prefs) {
  if (bendList.length) {
    const msg = {
      mood: "it's a different mood",
      where: SETTING[idea.w],
      budget: prefs.cost === 2 ? "it's cheaper than a treat" : prefs.cost === 0 ? "it costs a bit" : "it costs more than you said",
      time: (prefs.time === 3 ? idea.time < 2 : idea.time < prefs.time) ? "it's shorter than you said" : "it takes longer than you said",
    };
    return `<p class="pc-why is-bent"><span aria-hidden="true">↯</span> Near miss: ${esc(bendList.map((b) => msg[b]).join(" and "))}</p>`;
  }
  const bits = [];
  const moods = idea.v.filter((v) => prefs.vibes.includes(v)).map((v) => VIBES.find((x) => x.id === v).label);
  if (moods.length) bits.push(moods.join(" + "));
  if (prefs.cost === 2) bits.push("a treat");
  if (prefs.cost === 0) bits.push("free");
  const ints = getInterests();
  const who = prefs.whose === "both" ? null : prefs.whose;
  const label = (x) => interestById(x).label.toLowerCase();
  if (who) {
    const liked = idea.i.filter((x) => ints[who].includes(x));
    if (liked.length) bits.push(`${PEOPLE[who]} loves ${label(liked[0])}`);
  } else {
    const shared = idea.i.filter((x) => ints.tom.includes(x) && ints.cat.includes(x));
    if (shared.length) bits.push(`you both love ${label(shared[0])}`);
    else {
      const t = idea.i.find((x) => ints.tom.includes(x));
      const c = idea.i.find((x) => ints.cat.includes(x));
      if (t) bits.push(`Tom loves ${label(t)}`);
      if (c) bits.push(`Cat loves ${label(c)}`);
    }
  }
  return bits.length ? `<p class="pc-why"><span aria-hidden="true">✓</span> ${esc(bits.join(" · "))}</p>` : "";
}

function cardFront(card) {
  const { idea, place, event, pair, bends: bendList = [] } = card;
  const vibes = idea.v.map((v) => VIBES.find((x) => x.id === v)?.label).filter(Boolean).slice(0, 2).join(" · ");
  const from = getLoc().ll;
  let body;
  if (idea.adv) body = walkBlock(card);
  else if (idea.kindOf === "event") body = eventLine(idea.event) + pairLine(pair, pair?.pairRole);
  else if (idea.anchor) body = placeLine(place, idea) + pairLine(pair);
  else if (idea.kindOf === "flavour") body = pair ? placeLine(pair, idea) : "";
  else body = event ? eventLine(event) : placeLine(place, idea);
  const hint = (() => {
    if (event || idea.kindOf === "event") return "";
    if (idea.adv) {
      const last = latestLeave(idea.adv, lastPrefs.when);
      return last && last > new Date() ? `☀️ Leave by ${clock(last)} to finish in daylight` : "";
    }
    return (place && leaveBy(idea, place, lastPrefs.when, from, travel(place.ll, from).mins)) || goByHint(idea, lastPrefs.when, from);
  })();
  return `
    <div class="front-top">
      <span class="pc-stamp" aria-hidden="true">${idea.e}</span>
      <span class="pc-mark">${esc(vibes)}</span>
    </div>
    <h3>${esc(idea.t)}</h3>
    <p class="pc-blurb">${esc(idea.adv ? walkBlurb(idea.adv, card.pair) : idea.b)}</p>
    ${body}
    <ul class="meta" aria-label="Details">
      <li>${WHERE_EMOJI[idea.w]} ${WHERE_LABEL[idea.w]}</li>
      <li>⏱ ${SHORT_TIME[idea.time]}</li>
      <li>${idea.flexCost ? "✨ Free (food optional)" : idea.cost ? "💷 " + COST_LABEL[idea.cost] : "✨ Free"}</li>
      ${hint ? `<li class="go-by">${esc(hint)}</li>` : ""}
    </ul>
    ${event || idea.kindOf === "event" || idea.local ? "" : whatsOnLink(idea, lastPrefs)}
    ${hooksLine(card)}
    ${whyLine(idea, bendList, lastPrefs)}
    <p class="pc-spark"><span>Ask each other:</span> ${esc(idea.q)}</p>
    <div class="pc-actions">
      <button type="button" class="btn btn-ask btn-sm" data-choose>This one! <span aria-hidden="true">💜</span></button>
      <button type="button" class="btn btn-ghost btn-sm" data-swap>Swap ↻</button>
    </div>`;
}

const CARD_BACK = `
  <div class="airmail">
    <span class="by-air">Par avion · By Theo</span>
    <span class="paw" aria-hidden="true">🐾</span>
    <span class="addr">To: Tom &amp; Cat<br>The sofa, TomCat House</span>
  </div>`;

// Give each card something real: an actual event if one suits it, else a place.
function withPlaces(picks, prefs, { keep = false, table = [] } = {}) {
  const onTable = keep ? picks : table;
  const avoid = new Set(onTable.map((c) => c.place?.id).filter(Boolean));
  const avoidEv = new Set(onTable.map((c) => c.event?.id).filter(Boolean));
  return picks.map((card) => {
    const idea = card.idea;
    // Contextual dates bring their own anchor and pick their own pairing.
    if (idea.local || idea.pairFor) {
      if (keep && (card.pair || card.place)) return card;
      const pair = idea.pairFor ? idea.pairFor(prefs.when, new Date(), prefs.cost) : null;
      if (pair) avoid.add(pair.id);
      let place = idea.anchor ? { osm: true, ...idea.anchor } : idea.adv ? null : pair;
      if (!place && idea.go) place = pickPlace(idea, { time: prefs.time, avoid, when: prefs.when });
      return { ...card, event: null, pair, place };
    }
    if (keep && (card.event || card.place || !idea.go && !hasEventFor(idea, prefs.when))) return card;
    const ev = eventForIdea(idea, prefs.when, avoidEv);
    if (ev) { avoidEv.add(ev.id); return { ...card, event: ev, place: eventPlace(ev) }; }
    const place = pickPlace(card.idea, { time: prefs.time, avoid, when: prefs.when });
    if (place) avoid.add(place.id);
    return { ...card, event: null, place };
  });
}

// Fetch Google ratings for the places on the table (and their pairings), then redraw.
function rateHand() {
  hand.forEach((c, i) => {
    const todo = [c.event ? null : c.place, c.pair].filter((p) => p && p.g === undefined && !p.event);
    if (!todo.length) return;
    Promise.all(todo.map((p) => enrich(p))).then(() => {
      if (hand[i] !== c) return;
      const front = $$(".card", deck)[i]?.querySelector(".front");
      if (front) front.innerHTML = cardFront(c);
    });
  });
}

// Hungry + going somewhere should put a real place to eat on the table, as long
// as one fits everything else you picked.
const DINNER_TAGS = ["new", "pub", "romantic", "cheap", "world", "treat"];
function ensureDinner(picks, prefs) {
  if (!prefs.vibes.includes("food") || !["venue", "any"].includes(prefs.where)) return picks;
  if (picks.some((c) => !c.bends.length && c.idea.go?.some((g) => DINNER_TAGS.includes(g)))) return picks;
  const possible = possibleFor(prefs);
  const options = pool.filter((i) => i.go?.some((g) => DINNER_TAGS.includes(g)) && possible(i) && !bends(i, prefs).length && !picks.some((c) => c.idea === i));
  if (!options.length) return picks;
  const pick = { idea: options[Math.floor(Math.random() * options.length)], bends: [] };
  const swapAt = picks.findIndex((c) => c.bends.length);
  const at = swapAt >= 0 ? swapAt : picks.length - 1;
  return picks.map((c, i) => (i === at ? pick : c));
}

function renderHand() {
  deck.classList.toggle("single", hand.length === 1);
  deck.innerHTML = hand
    .map((card, i) => `
      <article class="card" style="--i:${i}" data-index="${i}">
        <div class="card-inner">
          <div class="face back" aria-hidden="true">${CARD_BACK}</div>
          <div class="face front" inert>${cardFront(card)}</div>
        </div>
      </article>`)
    .join("");
  $$(".card", deck).forEach(async (card, i) => {
    await wait(650 + i * 380);
    flipUp(card);
  });
  showPicks(hand);
  rateHand();
}

function flipUp(card) {
  card.classList.add("flipped");
  $(".front", card).inert = false;
}

async function run(mode) {
  lastMode = mode;
  const prefs = prefsFor(mode);
  lastPrefs = prefs;
  if (mode === "ask") savedPrefs.set({ vibes: prefs.vibes, where: prefs.where, cost: prefs.cost, whose: prefs.whose });
  const recent = recentIds(diary.all());

  say(theoLine("thinking"), "think");
  $("#ask").disabled = $("#surprise").disabled = true;
  await wait(900);
  if (getStatus() === "loading") {
    // Wait a little for places, but never hold up the ideas: cards fill in their
    // places as soon as they arrive (see refreshHandPlaces).
    say(`Sniffing around ${getLoc().name} first…`, "think");
    await Promise.race([whenReady(), wait(8000)]);
  }

  if (getKeys().tm) await Promise.race([loadEvents(), wait(4000)]);
  if (prefs.where !== "in" && (adventureStatus() === "loading" || knownStatus() === "loading")) {
    say(`Scouting ${getLoc().kind === "home" ? "round here" : getLoc().name} for local ideas…`, "think");
    await Promise.race([
      Promise.all([loadAdventures(), loadKnown()]),
      wait(12000),
    ]);
  }
  setEventMode(prefs.when);
  refreshPool();
  const { picks, exact } = deal(pool, prefs, { n: mode === "surprise" ? 1 : 3, recent, interests: getInterests(), possible: possibleFor(prefs), boost: boostFor(prefs) });
  // A new set of choices (or a new place) leads with the best local date; "Deal again" doesn't.
  const dealKey = JSON.stringify([prefs.vibes, prefs.where, prefs.time, prefs.cost, prefs.whose, prefs.when, locKey()]);
  const freshDeal = dealKey !== lastDealKey;
  lastDealKey = dealKey;
  hand = withPlaces(mode === "surprise" ? picks : ensureLocal(ensureDinner(picks, prefs), prefs, recent, { lead: freshDeal }), prefs);
  $("#localReady").hidden = true;
  handLoc = locKey();
  seen = new Set(hand.map((c) => c.idea.id));
  const bent = hand.filter((c) => c.bends.length).length;

  $("#resultsTitle").textContent = mode === "surprise" ? "Theo's wildcard" : "Theo's picks";
  const moment = prefs.when === "plan" ? "" : prefs.when === "tonight" && new Date().getHours() < 19.5
    ? "All doable tonight. "
    : `All doable from ${clock(startFor(prefs.when))}. `;
  $("#resultsNote").textContent = !hand.length
    ? "Nothing Theo knows fits right now. Try Plan ahead, or loosen a choice or two."
    : moment + (mode === "surprise"
      ? "No other rules. Just this. Go on."
      : !bent
        ? "Every one fits what you picked."
        : exact
          ? `Only ${exact} idea${exact === 1 ? " fits" : "s fit"} everything you picked, so Theo added the closest near miss${bent > 1 ? "es" : ""} (marked).`
          : "Nothing fits all of that exactly, so these are the closest. Each says which rule it bends.")
      + (exact < 3 && prefs.when !== "plan" && mode !== "surprise" && laterHelps(prefs)
        ? (prefs.when === "now" ? " More would fit later: try 🌙 Tonight or 📅 Plan ahead." : " More would fit another day: try 📅 Plan ahead.")
        : "");
  results.hidden = false;
  renderHand();
  say(theoLine(bent ? "relaxed" : "done"), "happy");
  $("#ask").disabled = $("#surprise").disabled = false;
  results.scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "start" });
}

// Moved somewhere new: re-pick every card's place. Same spot (ratings or events just
// arrived): keep what's on the table and only fill gaps, so nothing reshuffles.
let handLoc = "";
const locKey = () => getLoc().ll.join(",");
function refreshHandPlaces() {
  if (!hand.length) return;
  const moved = locKey() !== handLoc;
  hand = withPlaces(moved ? hand.map((c) => ({ ...c, place: null, event: null })) : hand, lastPrefs, { keep: !moved });
  handLoc = locKey();
  $$(".card", deck).forEach((card, i) => { $(".front", card).innerHTML = cardFront(hand[i]); });
  showPicks(hand);
  rateHand();
}
onChange(() => { renderWhere(); renderWhen(); refreshHandPlaces(); });
onEvents(() => { renderWhere(); refreshHandPlaces(); });
function localArrived() {
  renderWhere();
  if (results.hidden || !hand.length || lastPrefs.where === "in" || hand.some((c) => c.idea.local)) return;
  if (localIdeas().length) $("#localReady").hidden = false;
}
onAdventures(localArrived);
onKnown(localArrived);
$("#localReady").addEventListener("click", () => run(lastMode));

form.addEventListener("submit", (e) => { e.preventDefault(); run("ask"); });
$("#surprise").addEventListener("click", () => run("surprise"));
$("#again").addEventListener("click", () => run(lastMode));

deck.addEventListener("click", async (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const i = Number(card.dataset.index);
  const routeBtn = e.target.closest("[data-route]");
  if (routeBtn) return focusRoute(routeBtn.dataset.route);
  const mapBtn = e.target.closest("[data-map]");
  if (mapBtn) return focusPlace(hand[i].event && !hand[i].idea.local ? hand[i].place.id : mapBtn.dataset.map);
  if (e.target.closest("[data-choose]")) return choose(hand[i]);
  if (!e.target.closest("[data-swap]")) return;

  const prefs = lastPrefs;
  refreshPool();
  const opts = { n: 1, recent: recentIds(diary.all()), interests: getInterests(), possible: possibleFor(prefs), boost: boostFor(prefs) };
  let [next] = deal(pool, prefs, { ...opts, exclude: seen }).picks;
  if (!next) { seen = new Set(hand.map((c) => c.idea.id)); [next] = deal(pool, prefs, { ...opts, exclude: seen }).picks; }
  if (!next) return;
  seen.add(next.idea.id);
  [hand[i]] = withPlaces([{ ...next, place: null, event: null }], prefs, { table: hand.filter((_, j) => j !== i) });
  card.classList.remove("flipped");
  $(".front", card).inert = true;
  await wait(420);
  $(".front", card).innerHTML = cardFront(hand[i]);
  flipUp(card);
  showPicks(hand);
  rateHand();
  $("[data-swap]", card).focus();
});

// ── 🔑 Connections (Ticketmaster events, Google ratings) ─────────
const connDlg = $("#connectDialog");
const connStatus = $("#connStatus");
function openConnections() {
  const k = getKeys();
  $("#keyTm").value = k.tm || "";
  $("#keyG").value = k.g || "";
  connStatus.textContent = [k.tm ? "🎟️ Events connected." : "", k.g ? "⭐ Ratings connected." : ""].filter(Boolean).join(" ") || "Nothing connected yet.";
  connDlg.showModal();
}
$("#openConnect").addEventListener("click", openConnections);
$("#connSave").addEventListener("click", async () => {
  const k = setKeys({ tm: $("#keyTm").value, g: $("#keyG").value });
  connStatus.textContent = "Testing…";
  const out = [];
  if (k.tm) {
    const evs = await loadEvents(true);
    out.push(evs.length ? `🎟️ Events working: ${evs.length} coming up near ${getLoc().kind === "home" ? "home" : getLoc().name}.` : "🎟️ Couldn't get events with that key. Check it?");
  }
  if (k.g) {
    try { await testGoogle(); out.push("⭐ Ratings working."); startRatings(); }
    catch (e) {
      // 429 means the key's fine but Google's rationing requests: ratings fill in later.
      if (/\b429\b/.test(e.message)) { out.push("⭐ Ratings connected, but Google's busy right now. Stars will fill in as it frees up."); startRatings(); }
      else out.push("⭐ Google said no to that key. Check it, and that Places API (New) is enabled?");
    }
  }
  connStatus.textContent = out.join(" ") || "Saved (nothing connected).";
  renderWhere();
});
$("#connCopy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(setupLink());
    connStatus.textContent = "Setup link copied. Send it privately to Cat (it contains the keys) and open it once on her phone.";
  } catch {
    connStatus.textContent = setupLink();
  }
});
connDlg.addEventListener("click", (e) => { if (e.target === connDlg) connDlg.close(); });

// ── Our interests ────────────────────────────────────────────────
const intDlg = $("#interestsDialog");

function renderInterests() {
  const cur = getInterests();
  $$(".int-chips", intDlg).forEach((box) => {
    const who = box.dataset.person;
    box.innerHTML = INTERESTS.map((x) => `
      <label class="chip"><input type="checkbox" value="${x.id}"${cur[who].includes(x.id) ? " checked" : ""}><span><i aria-hidden="true">${x.emoji}</i>${esc(x.label)}</span></label>`).join("");
  });
}

intDlg.addEventListener("change", () => {
  const next = {};
  $$(".int-chips", intDlg).forEach((box) => (next[box.dataset.person] = $$("input:checked", box).map((x) => x.value)));
  setInterests(next);
});
$("#editInterests").addEventListener("click", () => { renderInterests(); intDlg.showModal(); });
$("#intReset").addEventListener("click", () => { resetInterests(); renderInterests(); });
intDlg.addEventListener("click", (e) => { if (e.target === intDlg) intDlg.close(); });

// ── It's a date! ─────────────────────────────────────────────────
const dlg = $("#dateDialog");
let openEntry = null;

function showIdea(idea, place, { fresh, card = null, steps: givenSteps = null }) {
  const stepsNow = givenSteps || (idea.stepsFor && card ? idea.stepsFor(card, lastPrefs.when, new Date(), lastPrefs.cost) : idea.s);
  const a = idea.adv;
  const walkLink = a ? `https://www.google.com/maps/dir/?api=1&origin=${a.start.ll.join(",")}&destination=${a.dest.ll.join(",")}${a.landmarks.length ? `&waypoints=${a.landmarks.map((l) => l.ll.join(",")).join("|")}` : ""}&travelmode=walking` : "";
  dlg.innerHTML = `
    <form method="dialog" class="dlg">
      <button class="dlg-x" value="close" aria-label="Close">×</button>
      <div class="dlg-head">
        <span class="pc-stamp big" aria-hidden="true">${idea.e}</span>
        <div>
          <p class="eyebrow">${fresh ? "It's a date!" : "From the diary"}</p>
          <h2 id="dlgTitle">${esc(idea.t)}</h2>
        </div>
      </div>
      <p>${esc(idea.adv && card ? walkBlurb(idea.adv, card.pair) : idea.b)}</p>
      ${place && (place.event || place.ev) ? (() => { const ev = place.event || place.ev; return `
      <div class="dlg-place">
        <p class="dlg-place-name"><span aria-hidden="true">🎟️</span> <b>${esc(ev.name || place.n)}</b></p>
        <p>${esc(ev.venue || place.b)}${ev.start ? ` · ${esc(whenLabel(new Date(ev.start) instanceof Date && ev.start.getTime ? ev : { ...ev, start: new Date(ev.start) }))}` : ""}${ev.price ? ` · ${esc(ev.price)}` : ""}</p>
        <p class="pop-links"><a href="${esc(ev.url)}" target="_blank" rel="noopener">Tickets ↗</a> <a href="https://www.google.com/maps/dir/?api=1&destination=${(ev.ll || place.ll).join(",")}" target="_blank" rel="noopener">Directions ↗</a></p>
      </div>`; })() : place ? `
      <div class="dlg-place">
        <p class="dlg-place-name"><span aria-hidden="true">📍</span> <b>${esc(place.n)}</b>${place.town ? `, ${esc(place.town)}` : ""}${fresh ? ` <small>${travelLabel(place.ll, getLoc().ll)}</small>` : ""}</p>
        ${fresh && ratingBadge(place) ? `<p class="pop-stars">${ratingBadge(place)} <small>on Google</small></p>` : ""}
        <p>${esc(place.b)}</p>
        ${fresh && hoursLine(place) ? `<p class="pop-hours"><b>${hoursLine(place)}</b></p>` : ""}
        <p class="pop-links">
          <a href="${mapsDirections(place)}" target="_blank" rel="noopener">Directions ↗</a>
          <a href="${place.g?.uri ? esc(place.g.uri) : mapsSearch(place)}" target="_blank" rel="noopener">Reviews &amp; booking ↗</a>
        </p>
      </div>` : ""}
      ${card?.pair && card.pair.id !== place?.id ? `
      <div class="dlg-place">
        <p class="dlg-place-name"><span aria-hidden="true">🍽️</span> <b>${esc(card.pair.n)}</b>${ratingBadge(card.pair) ? ` <small>${esc(ratingBadge(card.pair))} on Google</small>` : ""}</p>
        ${hoursLine(card.pair) ? `<p class="pop-hours"><b>${hoursLine(card.pair)}</b></p>` : ""}
        <p class="pop-links"><a href="${card.pair.g?.uri ? esc(card.pair.g.uri) : mapsSearch(card.pair)}" target="_blank" rel="noopener">Reviews &amp; booking ↗</a> <a href="${mapsDirections(card.pair)}" target="_blank" rel="noopener">Directions ↗</a></p>
      </div>` : ""}
      ${a ? `<p class="pop-links walk-links"><a href="${walkLink}" target="_blank" rel="noopener">🥾 Walking directions ↗</a> <a href="#mapSection" data-close-route="${esc(idea.id)}">🗺️ Route on Theo's map</a></p>` : ""}
      <h3>The plan</h3>
      <ol class="steps">${stepsNow.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <div class="spark"><span>Ask each other</span><p>${esc(idea.q)}</p></div>
      <p class="rule">Theo's house rule: phones face down until you're home.</p>
      <div class="dlg-actions">
        <button class="btn btn-ask" value="go">${fresh ? "We're off! 🐾" : "Close"}</button>
        ${fresh ? `<button class="btn btn-ghost" value="undo">Actually, not this one</button>` : ""}
      </div>
    </form>`;
  dlg.showModal();
}

function choose(card) {
  const { idea, place } = card;
  const stepsNow = [...(idea.stepsFor ? idea.stepsFor(card, lastPrefs.when, new Date(), lastPrefs.cost) : idea.s)];
  // A detour you'd both love, slotted in before getting home.
  const detour = detourFor(card, getInterests());
  if (detour) stepsNow.splice(Math.max(1, stepsNow.length - 1), 0, detour.step);
  openEntry = diary.add(idea, place || card.pair, stepsNow);
  renderDiary();
  showIdea(idea, place, { fresh: true, card, steps: stepsNow });
  say(theoLine("chosen"), "happy");
  burst(36);
}

dlg.addEventListener("close", () => {
  if (dlg.returnValue === "undo" && openEntry) {
    diary.remove(openEntry.key);
    renderDiary();
    say("Fair enough. Pick another.", "");
  }
  openEntry = null;
  dlg.returnValue = "";
});
dlg.addEventListener("click", (e) => {
  if (e.target === dlg) return dlg.close();
  const r = e.target.closest("[data-close-route]");
  if (r) { e.preventDefault(); dlg.close(); focusRoute(r.dataset.closeRoute); }
});

// ── Diary ────────────────────────────────────────────────────────
const curated = new Map(PLACES.map((p) => [p.id, p]));
const entryPlace = (e) => e.place || curated.get(e.placeId) || null;
const fmt = (iso) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function renderDiary() {
  const entries = diary.all().filter((e) => byId.has(e.id) || e.idea);
  const done = entries.filter((e) => e.doneAt);
  const now = new Date();
  const thisMonth = done.filter((e) => { const d = new Date(e.doneAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const streak = weekStreak(entries);
  $("#diaryCount").textContent = entries.length;

  $("#stats").innerHTML = `
    <div class="stat"><b>${done.length}</b><span>date${done.length === 1 ? "" : "s"} done</span></div>
    <div class="stat"><b>${thisMonth}</b><span>this month</span></div>
    <div class="stat"><b>${streak}</b><span>week streak ${streak ? "🔥" : ""}</span></div>`;

  $("#diaryList").innerHTML = entries.length
    ? entries.map((e) => {
        const idea = byId.get(e.id) || e.idea;
        return `
        <li class="entry${e.doneAt ? " is-done" : ""}">
          <span class="pc-stamp" aria-hidden="true">${idea.e}</span>
          <div class="entry-body">
            <button type="button" class="entry-title" data-view="${e.key}">${esc(idea.t)}</button>
            <span class="entry-date">${e.doneAt ? `Done ${fmt(e.doneAt)}` : `Picked ${fmt(e.plannedAt)}`}${entryPlace(e) ? ` · ${esc(entryPlace(e).n)}` : ""}</span>
          </div>
          <button type="button" class="btn btn-sm ${e.doneAt ? "btn-done" : "btn-ghost"}" data-done="${e.key}" aria-pressed="${!!e.doneAt}">${e.doneAt ? "Did it ✓" : "We did it!"}</button>
          <button type="button" class="entry-x" data-remove="${e.key}" aria-label="Remove ${esc(idea.t)} from the diary">×</button>
        </li>`;
      }).join("")
    : `<li class="empty"><span class="empty-cat">${THEO_SVG}</span><p>No dates yet. Theo is judging you (lovingly).<br><a href="#top">Ask him for one ↑</a></p></li>`;
}

$("#diaryList").addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  const entries = diary.all();
  if (t.dataset.view) {
    const entry = entries.find((x) => x.key === t.dataset.view);
    if (entry) showIdea(byId.get(entry.id) || entry.idea, entryPlace(entry), { fresh: false, steps: entry.idea?.s || null });
  } else if (t.dataset.done) {
    const entry = entries.find((x) => x.key === t.dataset.done);
    const nowDone = !entry.doneAt;
    diary.update(entry.key, { doneAt: nowDone ? new Date().toISOString() : null });
    renderDiary();
    if (nowDone) burst(24);
    $(`[data-done="${entry.key}"]`)?.focus();
  } else if (t.dataset.remove) {
    diary.remove(t.dataset.remove);
    renderDiary();
  }
});

renderDiary();
const connected = absorbSetupLink();
initMap($("#map"), $("#placeList"), $("#mapChips"), $("#mapStatus"));
setEventMode(readPrefs().when);
loadEvents();
startRatings();
onChange(({ status }) => { if (status === "ready") loadEvents(); });
if (connected) say("Connected! I can see real events and star ratings now.", "happy");
renderWhere();
resume();
// Start gathering what's special round here (walks, what the place is known for).
if (getLoc().kind === "home" || getPlaces().length) { loadAdventures(); loadKnown(); }

// ── Confetti (paws and hearts) ───────────────────────────────────
function burst(n, from) {
  if (calm()) return;
  const layer = $("#confetti");
  const box = from?.getBoundingClientRect();
  const bits = ["🐾", "💜", "♥", "✦", "🐾"];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.textContent = bits[i % bits.length];
    const x = box ? box.left + box.width / 2 : Math.random() * innerWidth;
    const y = box ? box.top + box.height / 3 : -30;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty("--dx", `${(Math.random() - 0.5) * (box ? 220 : 160)}px`);
    s.style.setProperty("--dy", `${box ? -120 - Math.random() * 120 : innerHeight * (0.7 + Math.random() * 0.4)}px`);
    s.style.setProperty("--r", `${(Math.random() - 0.5) * 540}deg`);
    s.style.animationDelay = `${Math.random() * (box ? 120 : 500)}ms`;
    s.className = box ? "up" : "down";
    layer.append(s);
    setTimeout(() => s.remove(), 2600);
  }
}

// Idle chatter, only while nobody's looking at results.
setInterval(() => {
  if (document.hidden || !results.hidden || dlg.open) return;
  say(theoLine("idle"));
}, 14000);
