// What a place is known for, from Wikivoyage (the free travel guide): the "See" and
// "Do" listings for wherever you are, with their descriptions and locations, plus the
// guide's one-line summary of the town. Theo turns them into dates you'd only have
// here, tags each with the interests it suits, and pairs it with somewhere nearby to
// eat or drink. A city guide lists everything down to the plaques, so each listing is
// ranked by how well known it is: how many Wikipedias have an article on it (via
// Wikidata). Cached for a week per place.
import { getLoc, onChange } from "./locale.js?v=9";
import { km } from "./places.js?v=9";

const API = "https://en.wikivoyage.org/w/api.php";
const WIKIPEDIA = "https://en.wikipedia.org/w/api.php";
const WIKIDATA = "https://www.wikidata.org/w/api.php";
const STORE = "theo.known.v2:";
const TTL = 7 * 864e5;
const listeners = new Set();
let state = { key: "", status: "idle", list: [], summary: "", guides: [] };
let token = 0;

export const onKnown = (fn) => listeners.add(fn);
export const getKnown = () => state.list;
export const knownStatus = () => state.status;
export const knownSummary = () => state.summary;
export const knownGuides = () => state.guides;
const emit = () => listeners.forEach((fn) => fn(state));

const call = async (params, base = API) => (await fetch(`${base}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`)).json();

// ── wikitext → listings ──────────────────────────────────────────
const unlink = (s) => s
  .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
  .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
  .replace(/\{\{[^{}]*\}\}/g, "")
  .replace(/'''?/g, "")
  .replace(/<[^>]+>/g, "")
  .replace(/\s+/g, " ")
  .trim();

function templates(text) {
  const out = [];
  const re = /\{\{\s*(see|do|eat|drink|listing|marker)\s*\|/gi;
  let m;
  while ((m = re.exec(text))) {
    let depth = 0, i = m.index;
    for (; i < text.length; i++) {
      if (text.startsWith("{{", i)) { depth++; i++; continue; }
      if (text.startsWith("}}", i)) { depth--; i++; if (!depth) break; }
    }
    const body = text.slice(m.index + m[0].length, i - 1);
    const fields = {};
    // split on | that aren't inside [[ ]] or {{ }}
    let cur = "", d1 = 0, d2 = 0;
    for (let k = 0; k <= body.length; k++) {
      const c = body[k];
      if (k === body.length || (c === "|" && !d1 && !d2)) {
        const eq = cur.indexOf("=");
        if (eq > 0) fields[cur.slice(0, eq).trim().toLowerCase()] = cur.slice(eq + 1).trim();
        cur = "";
        continue;
      }
      if (body.startsWith("[[", k)) d1++;
      if (body.startsWith("]]", k)) d1 = Math.max(0, d1 - 1);
      if (body.startsWith("{{", k)) d2++;
      if (body.startsWith("}}", k)) d2 = Math.max(0, d2 - 1);
      cur += c;
    }
    out.push({ type: m[1].toLowerCase(), f: fields });
    re.lastIndex = i;
  }
  return out;
}

function leadSentence(wt) {
  const lead = unlink(wt.split(/\n==/)[0].replace(/\{\{[^{}]*\}\}/g, ""));
  const first = lead.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  return first.length > 20 ? first.slice(0, 280) : "";
}

// ── what kind of date each listing makes ─────────────────────────
// [pattern, { v: moods, i: interests, w: setting, time, win: start window, emoji }]
const KINDS = [
  [/steam|railway|\btrain\b/i, { v: ["adventure", "culture"], i: ["travel", "photography", "history"], w: "out", time: 2, win: [[9.5, 14.5]], e: "🚂" }],
  [/\bboats?\b|boat hire|\bmarine$|cruise|\bferry\b|river trip|\bsail(ing)?\b|kayak|paddle|canoe|\bpunt(s|ing)?\b/i, { v: ["adventure", "cosy"], i: ["water", "travel", "adventure"], w: "out", time: 2, win: [[9.5, 15]], e: "⛵" }],
  [/viewing (gallery|platform|deck)|observation (deck|wheel)|ferris wheel|big wheel|sky ?garden|\bthe view from\b|panoram(a|ic)/i, { v: ["adventure", "cosy"], i: ["photography"], w: "venue", time: 1, win: [[10, 20.5]], e: "🔭" }],
  [/aquarium|sea life|wildlife park|bird (garden|park)|butterfly (house|farm)|wetland centre/i, { v: ["cosy", "adventure"], i: ["animals", "nature"], w: "venue", time: 2, win: [[10, 15.5]], e: "🐠" }],
  [/museum|exhibition|heritage centre|operating theatre/i, { v: ["culture"], i: ["history", "art"], w: "venue", time: 1, win: [[10, 15.5]], e: "🏛️" }],
  [/galler(y|ies)|\barts?\b(?! deco)|artworks?|\bstudios?\b|sculpture/i, { v: ["culture", "creative"], i: ["art", "photography"], w: "venue", time: 1, win: [[10, 16]], e: "🖼️" }],
  [/cinema|picture house|\bimax\b|\bbfi\b/i, { v: ["cosy", "culture"], i: ["movies"], w: "venue", time: 2, win: [[13, 20.5]], e: "🎬" }],
  [/theatre|playhouse|\bopera house\b/i, { v: ["culture"], i: ["theatre"], w: "venue", time: 2, win: [[14, 19.5]], e: "🎭" }],
  [/castle|\bfort\b|fortress|abbey|priory|\bmanor\b|stately|historic house|country house|art deco house|(holiday |former )?home of|\bruins?\b|\bpalace\b/i, { v: ["culture", "adventure"], i: ["history", "photography"], w: "out", time: 2, win: [[10, 15]], e: "🏰" }],
  [/church|chapel|cathedral/i, { v: ["culture", "cosy"], i: ["history", "photography"], w: "out", time: 1, win: [[9, 17]], e: "⛪" }],
  [/\bmusic\b|jazz|\bgigs?\b|concerts?|\blive (music|jazz|bands?)\b|orchestra|opera/i, { v: ["music", "culture"], i: ["live-music"], w: "venue", time: 2, win: [[18.5, 21]], e: "🎶" }],
  [/garden|\bparks?\b|\bwoods?\b|woodland|forest|\bnature\b|reserve|\bheath\b|\bcommon\b/i, { v: ["adventure", "cosy"], i: ["nature", "photography"], w: "outdoor", time: 2, win: [[9.5, 16]], e: "🌿", sun: true }],
  [/beach|\bbay\b|\bsands\b|tidal pool|\blido\b|\bswim/i, { v: ["adventure", "active"], i: ["water", "nature"], w: "outdoor", time: 2, win: [[9, 17]], e: "🏖️", sun: true }],
  [/\bstreets?\b|\blanes?\b|\bquarter\b|old town|harbour|\bquay\b|\bcove\b|\bsquare\b|\bmarkets?\b|\bbridge$/i, { v: ["cosy", "culture"], i: ["photography", "history"], w: "out", time: 1, win: [[9, 18]], e: "📷" }],
  [/\bpier\b|amusement|arcade|fun ?fair|crazy golf|bowling/i, { v: ["adventure", "active"], i: ["games", "adventure"], w: "out", time: 2, win: [[10, 17]], e: "🎡" }],
  [/\bwalks?\b|\btrail\b|\bpath\b|\bhike\b/i, { v: ["adventure", "active"], i: ["nature", "exercise"], w: "outdoor", time: 2, win: [[9, 15]], e: "🥾", sun: true }],
];
// What each listing says about the two of you, beyond its kind: a textile museum is
// one for Cat, a recording studio one for Tom.
const HINTS = [
  [/textile|embroider|fashion|tapestr|quilt|sewing|\blace\b|weaving|knit|crafts?\b/i, ["embroidery"]],
  [/\bfilms?\b|cinema|movie|\bbfi\b|imax|picture house/i, ["movies"]],
  [/film studios?|filmmak|film location|filmed here|recording studio/i, ["filmmaking"]],
  [/record (shop|store)|vinyl/i, ["vinyl"]],
  [/\bmusic\b|\bgigs?\b|concerts?|jazz|orchestra|opera|\blive bands?\b/i, ["live-music"]],
  [/recording studio|instrument|guitar|piano/i, ["making-music"]],
  [/(?<!operating |lecture )theatre|playhouse|shakespeare|\bdrama\b/i, ["theatre"]],
  [/\bviews?\b|panoram|skyline|sunset|photogenic/i, ["photography"]],
  [/cookery|cooking (class|school)|food market|chef'?s table/i, ["cooking"]],
  [/galler(y|ies)|\bart\b|paintings?|sculpture/i, ["art"]],
  [/book ?shop|bookshop|library|literary|novelist|\bpoets?\b|dickens|austen|christie/i, ["reading"]],
  [/\bswim|\blido\b|tidal pool|kayak|paddle|\bboats?\b|river trip/i, ["water"]],
  [/castle|histor|medieval|tudor|roman|victorian|georgian|\bwar\b|museum/i, ["history"]],
  [/aquarium|wildlife|\banimals?\b|\bbirds?\b|\bdeer\b|\bseals?\b|butterfl/i, ["animals"]],
  [/arcade|\bgames?\b|bowling|crazy golf|escape room/i, ["games"]],
  [/spa (day|treatment|break)|day spa|sauna|thermal (spa|baths?)|bath ?house|hammam/i, ["wellness"]],
  [/\bdanc(e|ing)\b|ballet|ballroom/i, ["dancing"]],
  [/brewery|distillery|vineyard|winery|cocktail|\bgin\b|\bcider\b|tasting/i, ["drinks"]],
  [/comedy|comedian|stand-?up/i, ["comedy"]],
];
const interestsOf = (k, name, text) => [...new Set([...k.i, ...HINTS.filter(([re]) => re.test(name) || re.test(text)).flatMap(([, i]) => i)])];
// How each kind of listing does as a date in itself.
const KIND_WEIGHT = { "🚂": 3, "⛵": 3, "🏰": 3, "🏖️": 3, "🔭": 2.5, "🎬": 2, "🐠": 2, "🏛️": 2.5, "🖼️": 2.5, "🎭": 2.5, "🎶": 2.5, "🌿": 2, "🎡": 1.5, "📷": 1.5, "🥾": 1.5, "✨": 1.5, "⛪": 1, "📍": 0.5 };
const RAVE = /\b(famous|best|stunning|iconic|popular|must[- ]see|beautiful|spectacular|oldest|largest|finest|unmissable|highlights?|world[- ]class|renowned|breathtaking|magnificent|gorgeous|lovely|charming|unique|remarkable|impressive)\b/i;
// Not date material: places to sleep, practicalities, things built for kids, and
// things nobody would plan an afternoon around.
const SKIP = /^former\b|torture garden|fetish|strip club|gentlemen'?s club|sex shop|\badult\b|\boffices?\b|headquarters|\bhq\b|embassy|consulate|council|court ?house|crown court|police|fire station|\bdevelopments?\b|skate ?park|car wash|swimming pool|wave pool|leisure pool|retail park|shopping (centre|center|mall)|\boutlet\b|^(the )?[\w' ]*\bstation\b(?!.*(steam|heritage|museum))|hotel|hostel|camp ?site|caravan|b&b|guest ?house|car park|tourist (information|office)|toilets|supermarket|golf (club|course)|country club|school|college|hospital|water ?park|theme park|soft play|play ?(area|centre|barn)|adventure playground|family (fun|park)|splash|zoo|farm park|leisure centre|cemetery|mausoleum|crematorium|memorial garden|\bRFC\b|rugby club|football club|cricket club|sports club|bowls club|tennis club|reactor|power station|depot|industrial|business park|laborator|research (centre|facility)|substation|campus|children'?s|activity farm|petting|\bkids\b/i;

// Only famous enough to be worth the trip: a plaque or a statue needs to be one of the
// best-known sights around (The Monument in London, say) to be a date.
const WEAK = /plaque|statue|\bbust\b|obelisk|memorial|monument|\bgraves?\b|\btombs?\b|birthplace|\bsite of\b|^former\b|\bbuilding\b|fountain|\bsculpture\b/i;

const GREEN = KINDS.find(([, k]) => k.e === "🌿")[1];
function classify(name, text, type) {
  // The name says the most ("X Gallery", and "Crystal Palace Park" is a park); then
  // whatever the description mentions first ("A theatre with an art gallery…").
  if (/\b(park|gardens?|woods?|woodland|common|heath|reserve|forest)$/i.test(name)) return GREEN;
  for (const [re, k] of KINDS) if (re.test(name)) return k;
  const lead = text.slice(0, 160);
  let best = null, at = Infinity;
  for (const [re, k] of KINDS) {
    if (k.e === "🚂") continue; // "model railways" in a museum blurb isn't a train ride
    const m = lead.match(re);
    if (m && m.index < at) { best = k; at = m.index; }
  }
  if (best) return best;
  if (type === "do") return { v: ["adventure"], i: ["adventure"], w: "out", time: 2, win: [[10, 16]], e: "✨" };
  return { v: ["culture", "cosy"], i: ["history", "photography"], w: "out", time: 1, win: [[9.5, 16.5]], e: "📍" };
}

// "Apr-Oct: Tue-Sat 10AM-4PM", "Mon — Sat, 10AM-4PM", "daily 9:30-5" → months + window.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function looseHours(h = "") {
  const s = h.toLowerCase();
  const out = {};
  const mm = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-–—to]+\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (mm) out.months = [MONTHS.indexOf(mm[1]) + 1, MONTHS.indexOf(mm[2]) + 1];
  const tm = s.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*[-–—to]+\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/);
  if (tm) {
    let a = +tm[1] + (tm[2] ? +tm[2] / 60 : 0), b = +tm[4] + (tm[5] ? +tm[5] / 60 : 0);
    if (tm[3] === "pm" && a < 12) a += 12;
    if (tm[6] === "pm" && b < 12) b += 12;
    if (!tm[6] && b < a) b += 12; // "10-5"
    if (b > a && a >= 5 && b <= 24) out.win = [[a, Math.max(a, b - 1.25)]]; // arrive with time to spare
  }
  return out;
}

// Festivals happen on their dates, not any day. With a month ("Pirate Days, every
// May") they're a plan-ahead idea in that month; without one, Theo can't say.
const FESTIVAL = /festival|regatta|carnival|pirate days|\bfairs?\b|\bfayre\b|\bweek\b/i;
const MONTH_NAME = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/;
function festivalMonth(name, text, type) {
  if (!FESTIVAL.test(name) && !(type === "do" && /\bannual(ly)?\b|every year|each year|\bheld (in|on|every)\b/i.test(text))) return undefined;
  const m = text.match(MONTH_NAME);
  return m ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1 : null;
}

function costOf(price = "", text = "") {
  const s = `${price} ${text}`.toLowerCase();
  if (/\bfree\b/.test(s) && !/free (wifi|parking)/.test(s)) return 0;
  const n = Math.max(0, ...[...s.matchAll(/£\s?(\d+(?:\.\d+)?)/g)].map((x) => +x[1]));
  if (n >= 25) return 2;
  return 1;
}

function toAnchors(listings, guide) {
  const out = [];
  for (const { type, f } of listings) {
    if (type !== "see" && type !== "do") continue;
    const name = unlink(f.name || "");
    const text = unlink(f.content || f.description || "");
    const lat = parseFloat(f.lat), lon = parseFloat(f.long ?? f.lon);
    if (!name || SKIP.test(name) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (/not open to the public|closed to the public|no public access|private residence|by appointment only|rarely open/i.test(text)) continue;
    const k = classify(name, text, type);
    // A church is a date if it's remarkable (or famous: see addFame).
    const plainChurch = k.e === "⛪" && !/view|oldest|famous|stunning|beautiful|medieval|stained glass|remarkable|unique/i.test(text);
    const fest = festivalMonth(name, text, type);
    if (fest === null) continue;
    // Seasons can hide in the description too ("Open from May to September").
    const hrs = looseHours(f.hours);
    if (fest) hrs.months = [fest, fest];
    if (!hrs.months) {
      const fromText = looseHours(text.match(/\b(open|season|closed)[^.]{0,60}/i)?.[0] || "");
      if (fromText.months) hrs.months = fromText.months;
    }
    out.push({
      id: `kf-${guide.replace(/\W+/g, "-").toLowerCase()}-${name.replace(/\W+/g, "-").toLowerCase()}`.slice(0, 90),
      name, text: text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 260),
      ll: [lat, lon], guide, area: guide.replace(/\s*\(.*\)/, "").split("/").pop(), type,
      wd: /^Q\d+$/.test(f.wikidata || "") ? f.wikidata : null, wp: f.wikipedia ? unlink(f.wikipedia).replace(/^en:/, "") : null,
      needFame: WEAK.test(name) ? 25 : plainChurch ? 10 : 0,
      // Tours you have to book (Lambeth Palace) are for planning ahead, not right now.
      book: !!fest || /pre-?booked|must be booked|booking (is )?(essential|required)|book(ed)? (in advance|ahead)|guided tours? only|by tour only/i.test(`${f.hours || ""} ${text}`),
      interests: interestsOf(k, name, text),
      hours: f.hours ? unlink(f.hours) : "", price: f.price ? unlink(f.price) : "",
      url: (f.url || "").startsWith("http") ? f.url : null,
      kind: k, months: hrs.months || null, win: hrs.win || k.win, cost: costOf(f.price, text),
    });
  }
  return out;
}

// ── how well known each listing is ───────────────────────────────
// The listing's own Wikidata id, or the English Wikipedia article of the same name if
// it's really about this place (its coordinates are within 2 km, so "St George the
// Martyr" the church doesn't borrow Saint George's fame). Then Wikidata says how many
// Wikipedias cover it: the London Eye has ~90, a blue plaque has none.
async function addFame(list, towns = new Set()) {
  const byQ = new Map();
  const link = (a, q) => { a.wd = q; (byQ.get(q) || byQ.set(q, []).get(q)).push(a); };
  const asked = new Map(); // title → listings
  for (const a of list) {
    if (a.wd) { link(a, a.wd); continue; }
    for (const t of new Set([a.wp, a.name, a.name.replace(/^the\s+/i, "")].filter((t) => t && t.length < 120 && !/[#<>[\]{}|]/.test(t)))) (asked.get(t) || asked.set(t, []).get(t)).push(a);
  }
  const titles = [...asked.keys()];
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const r = await call({ action: "query", prop: "coordinates|pageprops", ppprop: "wikibase_item|disambiguation", colimit: "max", redirects: "1", titles: chunk.join("|") }, WIKIPEDIA);
    const normal = new Map((r.query?.normalized || []).map((n) => [n.from, n.to]));
    const redirect = new Map((r.query?.redirects || []).map((n) => [n.from, n.to]));
    const pages = new Map(Object.values(r.query?.pages || {}).map((pg) => [pg.title, pg]));
    for (const t of chunk) {
      const t1 = normal.get(t) || t;
      const pg = pages.get(redirect.get(t1) || t1);
      const q = pg?.pageprops?.wikibase_item;
      if (!q || "missing" in pg || pg.pageprops.disambiguation !== undefined) continue;
      if (redirect.has(t1) && towns.has(pg.title.replace(/,.*$/, "").toLowerCase())) continue;
      const c = pg.coordinates?.[0];
      for (const a of asked.get(t)) {
        if (a.wd) continue;
        // No coordinates: only trust an exact title match.
        if (c ? km([c.lat, c.lon], a.ll) <= 2 : !redirect.has(t1) && t1.toLowerCase() === (a.wp || a.name).toLowerCase()) link(a, q);
      }
    }
  }
  const ids = [...byQ.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await call({ action: "wbgetentities", ids: ids.slice(i, i + 50).join("|"), props: "sitelinks" }, WIKIDATA);
    for (const [q, e] of Object.entries(r.entities || {})) {
      const n = Object.keys(e.sitelinks || {}).filter((k) => /wiki$/.test(k) && !/^(commons|species|meta|wikidata)wiki$/.test(k)).length;
      for (const a of byQ.get(q) || []) a.fame = n;
    }
  }
}

// What makes it worth planning a date around: the kind of thing it is, how well known
// it is, whether the guide raves about it, and (a little) how far away it is.
const scoreOf = (a, ll) => (KIND_WEIGHT[a.kind.e] ?? 1) + Math.min(5, Math.log2(1 + (a.fame || 0)) * 0.9)
  + (RAVE.test(a.text) ? 0.75 : 0) + (a.text.length > 120 ? 0.25 : 0) - Math.min(2, km(a.ll, ll) / 6);

// ── loading ──────────────────────────────────────────────────────
const keyOf = (l) => `${l.ll[0].toFixed(2)},${l.ll[1].toFixed(2)}`;

export async function loadKnown(loc = getLoc()) {
  const key = keyOf(loc);
  if (state.key === key && state.status !== "error") return state.list;
  const mine = ++token;
  try {
    const c = JSON.parse(localStorage.getItem(STORE + key));
    if (c && Date.now() - c.at < TTL) { state = { key, status: "ready", ...c.v }; emit(); return state.list; }
  } catch { /* fall through */ }
  state = { key, status: "loading", list: [], summary: "", guides: [] };
  emit();
  try {
    const near = await call({ action: "query", list: "geosearch", gscoord: `${loc.ll[0]}|${loc.ll[1]}`, gsradius: "15000", gslimit: "4" });
    const pages = (near.query?.geosearch || []).slice(0, 3);
    const guides = [];
    let list = [], summary = "";
    for (const pg of pages) {
      const r = await call({ action: "parse", page: pg.title, prop: "wikitext", redirects: "1" });
      const wt = r.parse?.wikitext?.["*"] || "";
      if (!wt) continue;
      guides.push(pg.title);
      if (!summary) summary = leadSentence(wt);
      list.push(...toAnchors(templates(wt), pg.title));
    }
    // One per place: neighbouring guides list the same museum, spelt differently
    // ("Fashion & Textile Museum", "Fashion and Textiles Museum").
    const same = (n) => n.toLowerCase().replace(/^the\s+/, "").replace(/&/g, "and").replace(/s\b/g, "").replace(/[^a-z0-9]+/g, "");
    list = list.filter((a, i) => !list.slice(0, i).some((o) => same(o.name) === same(a.name)));
    const towns = new Set(guides.flatMap((g) => g.replace(/\s*\(.*\)/, "").split("/")).map((t) => t.toLowerCase()));
    try { await addFame(list, towns); } catch { /* fame is a nice-to-have */ }
    list = list.filter((a, i) => !a.wd || !list.slice(0, i).some((o) => o.wd === a.wd));
    // The best few dozen, not just the nearest: famous enough where it needs to be.
    list = list.filter((a) => (a.fame || 0) >= a.needFame)
      .map((a) => ({ ...a, score: +scoreOf(a, loc.ll).toFixed(2) }))
      .sort((a, b) => b.score - a.score).slice(0, 40);
    if (mine !== token) return [];
    state = { key, status: "ready", list, summary, guides };
    try { localStorage.setItem(STORE + key, JSON.stringify({ at: Date.now(), v: { list, summary, guides } })); } catch { /* optional */ }
  } catch {
    if (mine === token) state = { key, status: "error", list: [], summary: "", guides: [] };
  }
  emit();
  return state.list;
}

onChange(({ loc }) => loadKnown(loc));
