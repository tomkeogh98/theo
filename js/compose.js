// Theo's date composer. A good date has an anchor (the thing you do, ideally only
// possible here), a pairing (food or drink that fits, open when you'll want it), a
// reason it's for you two, and logistics that work right now. This module builds
// those from what's around you:
//   • walks along real trails to a payoff (adventures.js)
//   • what the place is known for (knownfor.js, from Wikivoyage)
//   • what's on (events.js, from Ticketmaster): a show with dinner nearby first
//   • the time of year (season.js)
//   • local flavour: what the region's food is famous for
// The hand-written ideas (ideas.js) are still there for staying in, where a good idea
// doesn't need to be local.
import { getLoc, getPlaces } from "./locale.js?v=9";
import { km, travel, NOT_PUBLIC, chainPenalty } from "./places.js?v=9";
import { baseWhyNot, latestStart, openAt, startFor, clock } from "./when.js?v=9";
import { adventureIdeas, getFood, steps as walkSteps, timeline, refuelFor, fmtMins } from "./adventures.js?v=9";
import { getKnown } from "./knownfor.js?v=9";
import { seasonalIdeas } from "./season.js?v=9";
import { eventsFor, whenLabel } from "./events.js?v=9";

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
const norm = (s) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
const QUESTIONS = [
  "What's something you've learned about me this year?",
  "What would your perfect day here look like?",
  "If we came back here in ten years, what would you want to have changed about us?",
  "What's a place you'd love to show me that I've never seen?",
  "What's the best bit of being here so far?",
  "Which moment from today will you remember?",
];
const question = (id) => QUESTIONS[Math.abs(hash(id)) % QUESTIONS.length];

// ── pairing: somewhere to eat or drink near an anchor ────────────
const PLACE_KIND = { food: "restaurant", pub: "pub", drinks: "bar" };
export function foodNear(ll, maxKm) {
  const out = [];
  const add = (p) => {
    if (km(ll, p.ll) > maxKm) return;
    const twin = out.find((o) => norm(o.n) === norm(p.n) && km(o.ll, p.ll) < 0.1);
    if (twin) { if (p.g && !twin.g) Object.assign(twin, { g: p.g, _week: p._week, url: twin.url || p.url }); return; }
    out.push(p);
  };
  const KIDS = /soft ?play|play ?(centre|barn|zone)|kids|children|nursery|garden centre|services|petrol|filling station/i;
  for (const p of getPlaces()) if (PLACE_KIND[p.cat] && !KIDS.test(p.n) && !NOT_PUBLIC.test(p.n)) add({ ...p, kind: p.kind || (PLACE_KIND[p.cat] === "restaurant" && /caf[eé]|coffee|tea ?room|bakery/i.test(p.n) ? "cafe" : PLACE_KIND[p.cat]) });
  for (const f of getFood()) if (!KIDS.test(f.n) && !NOT_PUBLIC.test(f.n)) add({ ...f });
  return out;
}

export const pairKinds = (at) => {
  const h = at.getHours() + at.getMinutes() / 60;
  return h < 11 ? ["cafe"] : h < 14.5 ? ["cafe", "pub", "restaurant"] : h < 17 ? ["cafe", "ice_cream", "pub"] : ["restaurant", "pub", "bar"];
};
const FOOD_WORD = { cafe: "coffee and cake", ice_cream: "an ice cream", pub: "a drink and a bite", restaurant: "a meal", bar: "a drink", chippy: "fish and chips" };
export const foodWord = (p) => FOOD_WORD[p?.kind] || "something to eat";

// The best place to pair with an anchor: open then, well rated, close, independent,
// suited to the budget, and (for local flavour) actually serving the thing.
export function pairFor(ll, at, { kinds = pairKinds(at), maxKm = 0.6, cost = 1, avoid = new Set(), match = null, prefer = null } = {}) {
  const pool = foodNear(ll, maxKm).filter((p) => kinds.includes(p.kind) && !avoid.has(p.id) && openAt(p, at) !== false && (!match || match(p)));
  const score = (p) => (openAt(p, at) ? 2 : 0) + (p.g?.rating ? (p.g.rating - 4) * 5 : 0) - km(ll, p.ll) * 2 - chainPenalty(p) + (prefer && prefer(p) ? 2 : 0)
    + (cost === 2 && (p.kind === "restaurant" || /££/.test(p.g?.price || "")) ? 1.5 : 0) + (cost === 0 && p.kind === "cafe" ? 0.5 : 0);
  return pool.sort((a, b) => score(b) - score(a))[0] || null;
}

// A place-shaped object for the map, cards and diary.
const asPlace = (p, extra = {}) => p && { id: p.id, n: p.n, kind: p.kind, cat: p.kind === "pub" ? "pub" : p.kind === "bar" ? "drinks" : "food", town: p.town || "", ll: p.ll, b: p.b || { cafe: "Café", ice_cream: "Ice cream", pub: "Pub", restaurant: "Restaurant", bar: "Bar", chippy: "Fish & chips" }[p.kind] || "", tags: [], hours: p.hours || null, url: p.url || null, osm: true, g: p.g, _week: p._week, ...extra };

// ── walks ────────────────────────────────────────────────────────
function walkIdeas() {
  return adventureIdeas().map((idea) => ({
    ...idea,
    local: true,
    kindOf: "walk",
    // The pairing is the café/pub at the end, chosen for the arrival time and budget.
    pairFor: (mode, now, cost) => {
      const tl = timeline(idea.adv, mode, now);
      return asPlace(refuelFor(idea.adv, tl.arrive, cost));
    },
    stepsFor: (card, mode, now, cost) => walkSteps(idea.adv, mode, now, card.pair, cost),
  }));
}

// ── what the place is known for ──────────────────────────────────
const KNOWN_STEP = {
  "🚂": "Grab a window seat on the river side, and Tom, bring the camera.",
  "⛵": "Sit up top, whatever the weather.",
  "🏛️": "Give it an hour, and each find the one thing you'd take home.",
  "🖼️": "Split up for twenty minutes, then show each other your favourite piece.",
  "🏰": "Find the best view from the walls and take the photo for the scrapbook.",
  "⛪": "Sit quietly for five minutes, then go and find the view.",
  "🎭": "Check what's on and book the best seats you can afford.",
  "🎬": "Check what's showing, get the big popcorn, and sit dead centre.",
  "🔭": "Go up just before sunset if you can, and each find somewhere you've been together.",
  "🐠": "Each pick the strangest creature in there and give it a name.",
  "🎶": "Check what's on tonight and get there early.",
  "🌿": "Find a bench with a view and stay longer than you planned.",
  "🏖️": "Walk the length of it, and paddle if you dare.",
  "📷": "Wander slowly, and pop into anything that looks interesting.",
  "🎡": "Best of three at everything. The loser buys the treats.",
  "🥾": "Take it slowly and stop wherever the view's good.",
};

function knownTitle(a) {
  const town = a.guide.replace(/\s*\(.*\)/, "");
  const n = a.name.split(/\s+/).length === 1 && !a.name.toLowerCase().includes(town.toLowerCase()) ? `${town}'s ${a.name.toLowerCase()}` : a.name;
  switch (a.kind.e) {
    case "🚂": return /^the /i.test(n) ? `Ride ${n}` : `Ride the ${n}`;
    case "🏰": return `Explore ${n}`;
    case "⛪": return /view/i.test(a.text) ? `${n}, for the views` : n;
    case "📷": return /\bbridge$/i.test(n) ? `Stroll across ${n}` : `Wander ${n}`;
    case "🌿": return `${n} stroll`;
    default: return n;
  }
}

// Ranked best first (knownfor.js), so the top few are the place's highlights. Walks
// come from real trails when there are any, so the guide's "walk the coast path"
// listing isn't needed then.
function knownIdeas(haveWalks) {
  const loc = getLoc();
  return getKnown()
    .filter((a) => km(a.ll, loc.ll) <= 25 && !(haveWalks && a.kind.e === "🥾"))
    .map((a, rank) => {
      const idea = {
        id: a.id, e: a.kind.e, t: knownTitle(a),
        b: a.text || `One of the things ${a.guide.replace(/\s*\(.*\)/, "")} is known for.`,
        s: [], q: question(a.id),
        v: a.kind.v, w: a.kind.w, time: a.kind.time, cost: a.cost, i: a.interests || a.kind.i,
        local: true, kindOf: "known",
        anchorScore: a.score ?? 3, highlight: rank < 3 || (a.fame || 0) >= 25,
        anchor: { id: a.id, n: a.name, ll: a.ll, url: a.url, hours: a.hours, guide: a.guide, area: a.area || "", cat: "culture", b: a.area || a.guide.replace(/\s*\(.*\)/, ""), tags: [], town: "" },
        timing: { at: a.win, months: a.months, sun: a.kind.sun ? "day" : undefined, book: a.book || undefined },
      };
      // Doable then, and you can get there before it shuts.
      idea.whyNot = (mode, ll, now) => {
        const base = baseWhyNot(idea, mode, ll, now);
        if (base || mode === "plan") return base;
        const last = latestStart({ ...idea, latestStart: undefined }, mode, ll, now);
        if (!last) return null;
        const arrive = new Date(startFor(mode, now).getTime() + travel(a.ll, loc.ll).mins * 60e3);
        return arrive > last ? "too far to get there in time" : null;
      };
      idea.pairFor = (mode, now, cost) => {
        const at = new Date(startFor(mode, now).getTime() + (travel(a.ll, loc.ll).mins + (a.kind.time === 1 ? 75 : 150)) * 60e3);
        return asPlace(pairFor(a.ll, at, { cost }));
      };
      idea.stepsFor = (card, mode) => {
        const t = travel(a.ll, getLoc().ll);
        const out = [`Get there: about ${t.mins} min ${t.mode === "walk" ? "on foot" : t.mode === "transit" ? "by Tube or bus" : "by car or taxi"}.${a.hours ? ` Hours: ${a.hours}.` : ""}`];
        out.push(KNOWN_STEP[a.kind.e] || "Make an afternoon of it.");
        if (a.price) out.push(`Price: ${a.price}.`);
        out.push(card.pair ? `Then ${foodWord(card.pair)} at ${card.pair.n}, just round the corner.` : "Then find somewhere cosy nearby for a drink.");
        return out;
      };
      return idea;
    });
}

// ── what's on: a show, with dinner nearby first ──────────────────
const EVENT_SHAPE = {
  gig: { e: "🎤", v: ["music", "adventure"], i: ["live-music"], word: "Live music" },
  jazz: { e: "🎷", v: ["music", "cosy"], i: ["live-music", "drinks"], word: "Live jazz" },
  classical: { e: "🎻", v: ["music", "culture"], i: ["live-music"], word: "A concert" },
  comedy: { e: "😂", v: ["culture"], i: ["comedy", "theatre"], word: "Comedy" },
  theatre: { e: "🎭", v: ["culture"], i: ["theatre"], word: "A show" },
};

function eventIdeas(now) {
  const loc = getLoc();
  const seen = new Set();
  const pool = eventsFor("plan", now).filter((ev) => EVENT_SHAPE[ev.kind] && ev.timeKnown && !seen.has(ev.name) && seen.add(ev.name));
  const today = (ev) => ev.start.toDateString() === now.toDateString();
  const spread = [];
  for (const group of [pool.filter(today), pool.filter((ev) => !today(ev))]) {
    const byKind = Object.values(group.reduce((m, ev) => ((m[ev.kind] ||= []).push(ev), m), {}));
    for (let k = 0; spread.length < 40 && byKind.some((l) => l[k]); k++) for (const l of byKind) if (l[k] && spread.length < 40) spread.push(l[k]);
  }
  return spread
    .map((ev) => {
      const shape = EVENT_SHAPE[ev.kind];
      const meal = ev.start.getHours() < 17 ? "lunch" : "dinner";
      const price = +(ev.price.match(/\d+/)?.[0] || 30);
      const idea = {
        id: `ev-${ev.id}`, e: shape.e, t: ev.name,
        b: `${shape.word} at ${ev.venue}${ev.genre && ev.kind === "gig" ? ` (${ev.genre.toLowerCase()})` : ""}. ${meal === "lunch" ? "Lunch" : "Dinner"} nearby first, then the show.`,
        s: [], q: question(ev.id),
        v: shape.v, w: "venue", time: 2, cost: price <= 20 ? 1 : 2, i: shape.i,
        local: true, kindOf: "event", event: ev,
        anchor: { id: ev.id, n: ev.venue, ll: ev.ll, cat: "events", b: ev.name, tags: [], town: ev.town, event: ev },
      };
      // You need to get there before it starts (plan ahead: any upcoming show).
      idea.whyNot = (mode, ll, t = new Date()) => {
        if (mode === "plan") return ev.start > t ? null : "it's started";
        const endOfDay = new Date(t); endOfDay.setHours(23, 59, 0, 0);
        if (ev.start > endOfDay) return "not today";
        if (mode === "tonight" && ev.start.getHours() < 17) return "not this evening";
        if (mode === "now" && ev.start.getTime() - t.getTime() > 4 * 3600e3) return "later on";
        const arrive = t.getTime() + (travel(ev.ll, loc.ll).mins + 10) * 60e3;
        return arrive <= ev.start.getTime() ? null : "too late to get there";
      };
      idea.pairFor = (mode, t, cost) => {
        // Dinner 1¾ hours before the start if there's time; otherwise a drink after.
        const leave = t;
        const dinner = new Date(ev.start.getTime() - 105 * 60e3);
        const canDine = mode === "plan" || dinner.getTime() >= leave.getTime() + travel(ev.ll, loc.ll).mins * 60e3;
        const at = canDine ? dinner : new Date(ev.start.getTime() + 150 * 60e3);
        const p = pairFor(ev.ll, at, { kinds: canDine ? ["restaurant", "pub"] : ["bar", "pub"], maxKm: 0.8, cost });
        return asPlace(p, { pairRole: canDine ? meal : "after" });
      };
      idea.stepsFor = (card) => {
        const out = [];
        if (card.pair?.pairRole === "dinner" || card.pair?.pairRole === "lunch") out.push(`${card.pair.pairRole === "lunch" ? "Lunch" : "Dinner"} at ${card.pair.n} first (book for about ${clock(new Date(ev.start.getTime() - 105 * 60e3))}).`);
        out.push(`${ev.name} at ${ev.venue}: ${whenLabel(ev)}${ev.price ? `, tickets ${ev.price}` : ""}. Book through the Tickets button.`);
        if (card.pair?.pairRole === "after") out.push(`Nightcap after at ${card.pair.n}.`);
        out.push("Getting home: book a taxi before the encore, or check the last train or bus.");
        return out;
      };
      return idea;
    });
}

// ── local flavour ─────────────────────────────────────────────────
// What the region's food is famous for, at somewhere nearby that actually serves it
// (a pie and mash shop for pie and mash, not the best-rated Persian place).
const serves = (name, cuisine) => (p) => name.test(p.n) || (!!cuisine && cuisine.test(p.cuisine || ""));
const TEA_ROOM = serves(/tea ?room|tearoom|tea shop|tea garden|scone|cream tea/i, /tea|coffee_shop;cake/);
const SEAFOOD = serves(/crab|seafood|fish|oyster|lobster|shell|mussel|harbour|quay|wharf/i, /seafood|fish|oyster/);
const REGIONAL = [
  { re: /devon/i, items: [
    { id: "r-cream-tea-devon", e: "🫖", t: "A Proper Devon Cream Tea", b: "Scones, clotted cream and jam, the Devon way: cream first, then jam. (Don't tell Cornwall.)", kinds: ["cafe"], prefer: TEA_ROOM, at: [[11, 16.5]], v: ["food", "cosy"], i: ["eating-out", "cosy"] },
    { id: "r-crab-devon", e: "🦀", t: "Fresh Crab by the Water", b: "South Devon crab, landed down the road. A crab sandwich or a seafood lunch looking at the boats.", kinds: ["restaurant", "pub", "cafe"], match: SEAFOOD, at: [[12, 20]], v: ["food", "adventure"], i: ["eating-out", "water"] },
  ] },
  { re: /cornwall/i, items: [
    { id: "r-pasty", e: "🥟", t: "A Proper Cornish Pasty", b: "Crimped on the side, eaten with your hands, ideally on a harbour wall.", kinds: ["cafe", "restaurant", "chippy"], match: serves(/pasty|pasties|oggy/i, /pasty/), at: [[10, 16]], v: ["food", "adventure"], i: ["eating-out"] },
    { id: "r-cream-tea-cornwall", e: "🫖", t: "A Cornish Cream Tea", b: "Jam first, then the clotted cream. (Don't tell Devon.)", kinds: ["cafe"], prefer: TEA_ROOM, at: [[11, 16.5]], v: ["food", "cosy"], i: ["eating-out", "cosy"] },
  ] },
  { re: /kent/i, items: [
    { id: "r-oysters-kent", e: "🦪", t: "Kent Oysters & Something Cold", b: "Kent has been famous for its oysters since the Romans. Try half a dozen with a glass of something cold.", kinds: ["restaurant", "pub", "bar"], match: SEAFOOD, at: [[12, 21]], v: ["food", "adventure"], i: ["eating-out", "drinks"] },
  ] },
  { re: /london/i, items: [
    { id: "r-pie-mash", e: "🥧", t: "Pie, Mash & Liquor", b: "London's original fast food: pie, mash and parsley liquor in a tiled caff that hasn't changed in a century.", kinds: ["cafe", "restaurant", "chippy"], match: serves(/pie (and|&|n'?) mash|manze|cooke|\beels?\b|pie shop|pie house/i, /\bpie\b/), at: [[11, 15]], v: ["food", "culture"], i: ["eating-out", "history"] },
  ] },
];
const COAST_FOOD = { id: "r-fish-chips", e: "🐟", t: "Fish & Chips on the Harbour", b: "Proper fish and chips, eaten out of the paper on a harbour wall, fighting off the gulls.", kinds: ["chippy", "restaurant", "cafe", "pub"], match: serves(/fish|chip|frier|fryer|chippy|plaice|haddock|\bcod\b/i, /fish_and_chips|fish/), at: [[12, 20.5]], v: ["food", "cosy"], i: ["eating-out", "water"] };

function flavourIdeas(now, coastal) {
  const loc = getLoc();
  const region = `${loc.sub || ""} ${loc.name || ""} ${loc.kind === "home" ? "Oxfordshire" : ""}`;
  const items = REGIONAL.filter((r) => r.re.test(region)).flatMap((r) => r.items);
  if (coastal) items.push(COAST_FOOD);
  const near = foodNear(loc.ll, 3);
  return items
    // Only if somewhere nearby serves it.
    .filter((r) => near.some((p) => r.kinds.includes(p.kind) && (!r.match || r.match(p))))
    .map(({ kinds, match, prefer, ...r }) => {
      const at = (mode, t) => new Date(startFor(mode, t).getTime() + 20 * 60e3);
      const pick = (mode, t, cost) => pairFor(loc.ll, at(mode, t), { kinds, match, prefer, maxKm: 3, cost });
      const idea = {
        ...r, s: [], q: question(r.id), w: "venue", time: 1, cost: 1, local: true, kindOf: "flavour",
        timing: { at: r.at },
        pairFor: (mode, t, cost) => asPlace(pick(mode, t, cost)),
        stepsFor: (card) => [
          card.pair ? `Head to ${card.pair.n}${card.pair.g?.rating ? ` (⭐ ${card.pair.g.rating.toFixed(1)} on Google)` : ""}.` : "Ask a local where's best: they'll have strong opinions.",
          "Order the local speciality, obviously, and one thing you've never tried.",
          "Walk it off somewhere with a view.",
        ],
      };
      // …and it's open when you'd get there.
      idea.whyNot = (mode, ll, t = new Date()) => baseWhyNot(idea, mode, ll, t) || (mode !== "plan" && !pick(mode, t, 1) ? "nowhere's serving it then" : null);
      return idea;
    });
}

// ── seasonal ─────────────────────────────────────────────────────
function seasonIdeas(now) {
  return seasonalIdeas(now).map((s) => ({
    ...s,
    timing: { at: s.at, book: s.book, sun: s.sun ? "day" : s.dark ? "dark" : s.golden ? "golden" : undefined },
    kindOf: "season",
  }));
}

// ── a detour for the two of you ──────────────────────────────────
// Something you love, a few minutes from the plan: you both love vinyl, so if
// there's a record shop round the corner from the gallery, Theo says so.
const DETOURS = [
  { interest: "vinyl", is: (p) => p.tags?.includes("records"), emoji: "💿",
    step: (p, who) => `On the way, dip into ${p.n}: ${who} vinyl. One record each, under a tenner, and no peeking at each other's.` },
  { interest: "reading", is: (p) => p.tags?.includes("bookshop"), emoji: "📚",
    step: (p, who) => `Dip into ${p.n}: ${who} books. Pick one for each other, then swap.` },
];
export function detourFor(card, interests) {
  const { idea } = card;
  if (idea.w === "in" || idea.adv) return null;
  const spot = idea.anchor?.ll || card.place?.ll || card.pair?.ll;
  if (!spot) return null;
  for (const d of DETOURS) {
    const tom = interests.tom.includes(d.interest), cat = interests.cat.includes(d.interest);
    if (!tom && !cat) continue;
    const p = getPlaces().filter((x) => d.is(x) && km(spot, x.ll) <= 0.6).sort((a, b) => km(spot, a.ll) - km(spot, b.ll))[0];
    if (!p) continue;
    const who = tom && cat ? "you both love" : tom ? "Tom loves" : "Cat loves";
    const mins = Math.max(1, Math.round((km(spot, p.ll) * 1.3 * 60) / 4.8));
    return { place: p, hook: `${d.emoji} ${p.n}, ${mins} min away`, step: d.step(p, who) };
  }
  return null;
}

// Every contextual idea for here and now.
export function localIdeas(now = new Date()) {
  const walks = walkIdeas();
  const coastal = walks.some((w) => w.adv.coastal);
  return [...walks, ...knownIdeas(walks.length > 0), ...eventIdeas(now), ...flavourIdeas(now, coastal), ...seasonIdeas(now)];
}

export { fmtMins };
