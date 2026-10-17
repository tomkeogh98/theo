// Local adventures: date ideas built from the landscape around you, not from a list.
//
// The pattern (from a real date: Dartmouth → Dartmouth Castle → South West Coast Path
// → Blackpool Sands → coffee at the beach café → bus back):
//   1. start where you are (or a short drive away, at a village on a trail)
//   2. follow a named trail, the thing that makes the walk "only here"
//   3. pass landmarks on the way (castles, lighthouses, viewpoints…)
//   4. arrive somewhere with a payoff (beach, nature reserve, peak, headland…)
//   5. refuel nearby, somewhere open when you get there
//   6. fit the time you have, in daylight, and know how you're getting back
//
// Everything comes from OpenStreetMap (one query per place, cached for a week): trails
// and their footpaths, scenic spots, places to eat, bus stops, ferries and villages.
// Theo routes along the actual footpaths in the browser, adds the climb (Open-Meteo
// elevation) and a line about the landmarks (Wikipedia), then checks the timings
// against "When?", sunset and the weather each time you ask.
import { getLoc, onChange, overpass, bbox } from "./locale.js?v=8";
import { km, travel, inLondon, NOT_PUBLIC, chainPenalty } from "./places.js?v=8";
import { sunTimes, openAt, clock, startFor } from "./when.js?v=8";
import { weatherWindow, loadWeather } from "./weather.js?v=8";

const AREA = 0.11; // ~12 km around you
const STORE = "theo.adv.v2:";
const TTL = 7 * 864e5;
const listeners = new Set();
let state = { key: "", status: "idle", list: [], food: [] };
let token = 0;

export const onAdventures = (fn) => listeners.add(fn);
export const getAdventures = () => state.list;
export const getFood = () => state.food;
export const adventureStatus = () => state.status;
export const adventuresFor = (l) => state.key === keyOf(l);
const emit = () => listeners.forEach((fn) => fn(state));

// ── gather ───────────────────────────────────────────────────────
function query(ll) {
  const city = inLondon(ll);
  const bb = bbox(ll, city ? 0.07 : AREA);
  const local = bbox(ll, city ? 0.012 : 0.02); // the streets around you, to reach the trails
  const eat = city
    ? `nwr(${bb})[amenity~"^(cafe|pub|ice_cream)$"][name];
 nwr(${bb})[amenity=restaurant][name~"caf|tea|coffee|bakery|kitchen|brunch",i];`
    : `nwr(${bb})[amenity~"^(cafe|pub|restaurant|ice_cream)$"][name];`;
  return `[out:json][timeout:90];
rel(${bb})[route~"^(hiking|foot|walking)$"][name]->.t;
foreach.t->.r(.r out tags; way(r.r)(${bb}); out ids;);
make stage name="geometry"; out;
way(r.t)(${bb});
out skel geom;
make stage name="ferries"; out;
way(r.t)(${bb})[route=ferry];
out ids;
make stage name="streets"; out;
way(${local})[highway~"^(footway|path|pedestrian|steps|living_street|residential|unclassified|tertiary|secondary|service|track|bridleway|cycleway)$"][access!~"^(private|no)$"];
out skel geom;
make stage name="places"; out;
(
 nwr(${bb})[natural~"^(beach|peak|cape|wood)$"][name];
 nwr(${bb})[tourism=attraction][name][wikipedia];
 nwr(${bb})[leisure~"^(park|garden)$"][name][wikipedia];
 nwr(${bb})[leisure=nature_reserve][name];
 nwr(${bb})[waterway=waterfall][name];
 nwr(${bb})[tourism=viewpoint][name];
 nwr(${bb})[historic~"^(castle|fort|ruins)$"][name];
 nwr(${bb})[man_made=lighthouse];
);
out tags bb;
(
 ${eat}
 nwr(${bb})[amenity=fast_food][cuisine~"fish_and_chips"][name];
);
out center tags;
${city ? "" : `node(${bb})[highway=bus_stop];
out skel;
`}nwr(${bb})[amenity=ferry_terminal];
out center tags;
nwr(${bb})[railway=station][name];
out center tags;
node(${bb})[place~"^(town|village|hamlet|suburb)$"][name];
out center tags;`;
}

// "Thames Path - northern bank" and "Green Chain Walk section 11" are the Thames Path
// and the Green Chain Walk.
const cleanTrail = (s = "") => s.replace(/\s*\([^)]*\)/g, "")
  .replace(/\s*[-–:,]\s*(section|stage|part|leg|link|spur|loop|northern|southern|eastern|western|north|south|east|west)\b.*$/i, "")
  .replace(/\s+(section|stage|part|leg)\s*\d+[a-z]?\b.*$/i, "")
  .replace(/\s*[-–:]\s*[^-–:]+\bto\b.+$/i, "")
  .replace(/\s+/g, " ").trim();
const llOf = (e) => (e.center ? [e.center.lat, e.center.lon]
  : e.bounds ? [(e.bounds.minlat + e.bounds.maxlat) / 2, (e.bounds.minlon + e.bounds.maxlon) / 2]
  : e.lat != null ? [e.lat, e.lon] : null);
// Rough area of an element's bounding box, in km².
const sizeOf = (b) => (b ? (b.maxlat - b.minlat) * 111 * (b.maxlon - b.minlon) * 111 * Math.cos((b.minlat * Math.PI) / 180) : null);
const wikiTitle = (t) => (t.wikipedia?.startsWith("en:") ? t.wikipedia.slice(3) : null);

function spotKind(t) {
  if (t.natural === "beach") return "beach";
  if (t.leisure === "nature_reserve") return "reserve";
  if (t.natural === "peak") return "peak";
  if (t.natural === "cape") return "cape";
  if (t.waterway === "waterfall") return "waterfall";
  if (t.tourism === "viewpoint") return "viewpoint";
  if (t.historic === "castle") return "castle";
  if (t.historic === "fort") return "fort";
  if (t.historic === "ruins") return "ruins";
  if (t.man_made === "lighthouse") return "lighthouse";
  if (t.natural === "wood") return "wood";
  if (t.tourism === "attraction") return "attraction";
  if (t.leisure === "park" || t.leisure === "garden") return "park";
  return null;
}

function parse(json) {
  const trails = new Map();
  const wayTrails = new Map();
  const ways = [];
  const spots = [], food = [], stops = [], ferries = [], stations = [], villages = [];
  const ferryWays = new Set();
  const streets = [];
  let rel = null;
  let stage = "trails";
  for (const e of json.elements || []) {
    const t = e.tags || {};
    if (e.type === "stage") { stage = t.name; continue; }
    if (stage === "trails") {
      if (e.type === "relation") { rel = e.id; trails.set(e.id, { name: cleanTrail(t.name), network: t.network || "" }); }
      else if (e.type === "way" && rel !== null) (wayTrails.get(e.id) || wayTrails.set(e.id, []).get(e.id)).push(rel);
      continue;
    }
    if (stage === "geometry") { if (e.type === "way" && e.geometry) ways.push(e); continue; }
    if (stage === "ferries") { if (e.type === "way") ferryWays.add(e.id); continue; }
    if (stage === "streets") { if (e.type === "way" && e.geometry) streets.push(e); continue; }
    if (e.type === "node" && !e.tags) { stops.push([e.lat, e.lon]); continue; }
    const ll = llOf(e);
    if (!ll) continue;
    if (t.amenity && (/^(cafe|pub|restaurant|ice_cream)$/.test(t.amenity) || t.amenity === "fast_food")) {
      if (/^(private|no|members|customers)$/.test(t.access || "") || NOT_PUBLIC.test(t.name)) continue;
      const kind = t.amenity === "fast_food" ? "chippy" : /tea ?room|caf[eé]|coffee|bakery/i.test(t.name) && t.amenity === "restaurant" ? "cafe" : t.amenity;
      food.push({ id: `osm-${e.type[0]}${e.id}`, n: t.name, kind, ll, hours: t.opening_hours || null, url: t.website || t["contact:website"] || null, chain: !!(t.brand || t["brand:wikidata"]), cuisine: t.cuisine || null });
    } else if (t.amenity === "ferry_terminal") {
      ferries.push({ name: t.name || "", ll });
    } else if (t.railway === "station") {
      stations.push({ name: t.name, ll });
    } else if (t.place) {
      villages.push({ name: t.name, ll, place: t.place });
    } else {
      const kind = spotKind(t);
      // Green spaces need to be big enough to walk to (not a garden square).
      const size = sizeOf(e.bounds);
      if (kind && ["park", "wood", "reserve"].includes(kind) && size !== null && size < 0.06) continue;
      if (kind) spots.push({ id: `${e.type[0]}${e.id}`, name: t.name || "", kind, ll, wiki: wikiTitle(t), notable: !!(t.wikipedia || t.wikidata) });
    }
  }
  return { trails, wayTrails, ways, ferryWays, streets, spots, food, stops, ferries, stations, villages };
}

// ── the footpath network ─────────────────────────────────────────
function buildGraph({ ways, wayTrails, trails, ferryWays, streets = [] }) {
  const idx = new Map();
  const lat = [], lon = [], adj = [];
  const node = (id, g) => {
    let i = idx.get(id);
    if (i === undefined && g) { i = lat.length; idx.set(id, i); lat.push(g.lat); lon.push(g.lon); adj.push([]); }
    return i;
  };
  for (const w of ways) {
    const ts = (wayTrails.get(w.id) || []).map((r) => trails.get(r)).filter(Boolean);
    // Name the edge after the most important trail it belongs to.
    const rank = (t) => ({ nwn: 0, rwn: 1, iwn: 2, lwn: 3 }[t.network] ?? 4);
    const best = ts.sort((a, b) => rank(a) - rank(b))[0];
    const name = best?.name || "";
    const national = ts.some((t) => t.network === "nwn" || t.network === "iwn");
    const ferry = ferryWays?.has(w.id) || false;
    for (let k = 0; k < w.nodes.length; k++) node(w.nodes[k], w.geometry[k]);
    for (let k = 0; k + 1 < w.nodes.length; k++) {
      const a = idx.get(w.nodes[k]), b = idx.get(w.nodes[k + 1]);
      if (a === undefined || b === undefined) continue;
      const d = km([lat[a], lon[a]], [lat[b], lon[b]]);
      adj[a].push([b, d, name, national, ferry]);
      adj[b].push([a, d, name, national, ferry]);
    }
  }
  for (const w of streets) {
    for (let k = 0; k < w.nodes.length; k++) node(w.nodes[k], w.geometry[k]);
    for (let k = 0; k + 1 < w.nodes.length; k++) {
      const a = idx.get(w.nodes[k]), b = idx.get(w.nodes[k + 1]);
      if (a === undefined || b === undefined) continue;
      const d = km([lat[a], lon[a]], [lat[b], lon[b]]) * 1.15;
      adj[a].push([b, d, "", false, false]);
      adj[b].push([a, d, "", false, false]);
    }
  }
  // A coarse grid so "nearest footpath" is quick.
  const grid = new Map();
  const cell = (la, lo) => `${Math.floor(la * 100)},${Math.floor(lo * 100)}`;
  for (let i = 0; i < lat.length; i++) {
    const k = cell(lat[i], lon[i]);
    (grid.get(k) || grid.set(k, []).get(k)).push(i);
  }
  // Trails that meet on the ground don't always share a node in the data (or one
  // trail ends where another begins). Join any pieces that come within ~40 m.
  const comp = new Int32Array(lat.length).fill(-1);
  let nc = 0;
  for (let i = 0; i < lat.length; i++) {
    if (comp[i] >= 0) continue;
    const stack = [i];
    comp[i] = nc;
    while (stack.length) for (const e of adj[stack.pop()]) if (comp[e[0]] < 0) { comp[e[0]] = nc; stack.push(e[0]); }
    nc++;
  }
  if (nc > 1) {
    for (let i = 0; i < lat.length; i++) {
      const ci = Math.floor(lat[i] * 100), cj = Math.floor(lon[i] * 100);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        for (const j of grid.get(`${ci + di},${cj + dj}`) || []) {
          if (j <= i || comp[j] === comp[i]) continue;
          const d = km([lat[i], lon[i]], [lat[j], lon[j]]);
          if (d <= 0.04) { adj[i].push([j, d * 1.2, "", false, false]); adj[j].push([i, d * 1.2, "", false, false]); }
        }
      }
    }
  }
  return { lat, lon, adj, n: lat.length, grid, cell, pieces: nc };
}

function nearestNode(g, [la, lo], maxKm) {
  const r = Math.ceil(maxKm / 0.7);
  const ci = Math.floor(la * 100), cj = Math.floor(lo * 100);
  let best = -1, bestD = maxKm;
  for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
    for (const i of g.grid.get(`${ci + di},${cj + dj}`) || []) {
      const d = km([la, lo], [g.lat[i], g.lon[i]]);
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  return best < 0 ? null : { i: best, d: bestD };
}

// Dijkstra with a small binary heap, stopping at maxKm.
function dijkstra(g, src, maxKm) {
  const dist = new Float64Array(g.n).fill(Infinity);
  const prev = new Int32Array(g.n).fill(-1);
  const prevEdge = new Array(g.n);
  const heap = [[0, src]];
  dist[src] = 0;
  const push = (x) => {
    heap.push(x);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u] || d > maxKm) continue;
    for (const e of g.adj[u]) {
      const nd = d + e[1];
      if (nd < dist[e[0]]) { dist[e[0]] = nd; prev[e[0]] = u; prevEdge[e[0]] = e; push([nd, e[0]]); }
    }
  }
  return { dist, prev, prevEdge };
}

function rebuild(g, dij, target) {
  const pts = [];
  const byTrail = new Map();
  let national = 0, total = 0, ferry = 0;
  for (let v = target; v >= 0; v = dij.prev[v]) {
    pts.push([g.lat[v], g.lon[v]]);
    const e = dij.prevEdge[v];
    if (e) {
      total += e[1];
      if (e[2]) byTrail.set(e[2], (byTrail.get(e[2]) || 0) + e[1]);
      if (e[3]) national += e[1];
      if (e[4]) ferry += e[1];
    }
  }
  pts.reverse();
  const [name, len] = [...byTrail.entries()].sort((a, b) => b[1] - a[1])[0] || ["", 0];
  const trailKm = [...byTrail.values()].reduce((s, x) => s + x, 0);
  return {
    pts, ferryKm: ferry, streetKm: Math.max(0, total - trailKm - ferry),
    trail: name && len / Math.max(total, 0.001) >= 0.4 ? { name, share: len / total, national: national / total >= 0.4, coastal: /coast/i.test(name) } : null,
  };
}

// Douglas–Peucker, so cached routes stay small.
function simplify(pts, tol = 0.00012) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const pathKm = (pts) => pts.reduce((s, p, i) => (i ? s + km(pts[i - 1], p) : 0), 0);

// ── composing candidates ─────────────────────────────────────────
const KIND_SCORE = { beach: 3, reserve: 3, waterfall: 3, castle: 3, lighthouse: 2.5, cape: 2.5, peak: 2.5, attraction: 2.5, park: 2.5, viewpoint: 2, wood: 2, fort: 2, ruins: 1.5, food: 1 };
const VIA_WEIGHT = { castle: 3, lighthouse: 3, fort: 2, cape: 2, ruins: 1.5 };
const LANDMARK_KINDS = new Set(["castle", "fort", "ruins", "lighthouse", "viewpoint", "peak", "cape"]);
const COASTAL = new Set(["beach", "cape", "lighthouse"]);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function dedupeSpots(spots) {
  const out = [];
  for (const s of spots) {
    // Not a walk's payoff: practical sites, and places built for kids or for a fee.
    if (!s.name || /golf|cemetery|sewage|works|quarry|landfill|school|water ?park|splash|theme park|\bzoo\b|farm park|soft play|leisure centre|holiday (park|village)|caravan|camp ?site|adventure park|play ?(area|park)|go ?kart|paintball|trampoline/i.test(s.name)) continue;
    const twin = out.find((o) => norm(o.name) === norm(s.name) && km(o.ll, s.ll) < 1.2);
    if (twin) { if (s.notable && !twin.notable) Object.assign(twin, s); continue; }
    out.push({ ...s });
  }
  return out;
}

function near(list, ll, maxKm) {
  return list.map((x) => ({ x, d: km(ll, x.ll || x) })).filter((o) => o.d <= maxKm).sort((a, b) => a.d - b.d);
}

// In a city the payoff is green space or water (attractions are better as their own
// dates), and the walk should be on paths, not an hour of pavement to reach one.
const CITY_SCORE = { ...KIND_SCORE, attraction: 1, park: 3, wood: 2.5, viewpoint: 2.5 };
function compose(data, g, start, dij, dests, maxKm, vias = []) {
  const out = [];
  const KS = data.city ? CITY_SCORE : KIND_SCORE;
  const snapStart = start.snap;
  for (const dest of dests) {
    if (km(start.ll, dest.ll) < 0.9) continue;
    // Don't drive somewhere to walk back to what's on your doorstep.
    if (start.kind !== "door" && data.home && km(dest.ll, data.home) < 2.5) continue;
    let walk, pts, trail = null, ferryKm = 0, streetKm = 0;
    if (dest.snap && dij && Number.isFinite(dij.dist[dest.snap.i])) {
      const direct = dij.dist[dest.snap.i];
      // The shortest way isn't always the best one: go past a notable landmark if it
      // only adds up to ~45% (Dartmouth → Dartmouth Castle → coast path → beach).
      const via = vias
        .filter((v) => v.name !== dest.name && Number.isFinite(dij.dist[v.snap.i]) && Number.isFinite(v.dij.dist[dest.snap.i])
          && dij.dist[v.snap.i] > 0.3 && dij.dist[v.snap.i] < direct)
        .map((v) => ({ v, total: dij.dist[v.snap.i] + v.dij.dist[dest.snap.i] }))
        .filter((o) => o.total <= direct * 1.45 + 0.3)
        // The most worthwhile landmark wins (a castle beats a small ruin), then the shorter detour.
        .sort((a, b) => (VIA_WEIGHT[b.v.kind] || 1) - (VIA_WEIGHT[a.v.kind] || 1) || a.total - b.total)[0];
      let r;
      if (via) {
        const a1 = rebuild(g, dij, via.v.snap.i);
        const a2 = rebuild(g, via.v.dij, dest.snap.i);
        r = { pts: [...a1.pts, ...a2.pts.slice(1)], ferryKm: a1.ferryKm + a2.ferryKm, streetKm: a1.streetKm + a2.streetKm, trail: a2.trail || a1.trail };
        const both = [a1.trail, a2.trail].filter(Boolean);
        if (both.length === 2 && both[0].name === both[1].name) r.trail = { ...both[1], national: both[0].national || both[1].national };
      } else {
        r = rebuild(g, dij, dest.snap.i);
      }
      const graphKm = via ? via.total : direct;
      ferryKm = r.ferryKm;
      streetKm = r.streetKm;
      walk = snapStart.d * 1.25 + graphKm - ferryKm + dest.snap.d * 1.2;
      pts = [start.ll, ...r.pts, dest.ll];
      trail = r.trail;
    } else {
      const straight = km(start.ll, dest.ll);
      if (straight > 3 || dest.kind === "food") continue; // without a trail: short scenic walks only
      walk = straight * 1.35;
      pts = [start.ll, dest.ll];
    }
    if (walk < 1.2 || walk > maxKm) continue;
    if (start.kind !== "door" && walk < 3) continue; // worth the drive (short walks start at the door)
    if (dest.kind === "food" && !trail) continue; // a pub walk needs a proper trail
    const refuels = dest.kind === "food"
      ? [{ ...dest.food, d: 0 }]
      : near(data.food, dest.ll, ["beach", "reserve", "cape"].includes(dest.kind) ? 0.6 : 0.45).slice(0, 5).map((o) => ({ ...o.x, d: o.d }));
    // Distance along the route at every point, measured once.
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + km(pts[k - 1], pts[k]));
    const total = cum[cum.length - 1] || 1;
    const scale = walk / total; // map path distance onto the walking distance
    // Landmarks within ~150 m of the route, in the order you'd pass them.
    const landmarks = [];
    const nearby = data.landmarkSpots.filter((s) => s.name !== dest.name && (s.notable || !data.city) && km(s.ll, start.ll) >= 0.3 && km(s.ll, dest.ll) >= 0.3
      && km(s.ll, start.ll) <= walk + 0.5);
    for (let k = 0; k < pts.length; k += 2) {
      for (const s of nearby) {
        if (km(s.ll, pts[k]) > 0.15 || landmarks.some((l) => l.name === s.name)) continue;
        landmarks.push({ ...s, atKm: cum[k] * scale });
      }
    }
    // A pub or café between roughly a third and three-quarters of the way.
    let halfway = null;
    for (let k = 0; k < pts.length && !halfway; k += 3) {
      if (cum[k] < total * 0.3 || cum[k] > total * 0.75) continue;
      const f = near(data.food, pts[k], 0.15).find((o) => o.x.kind === "pub" || o.x.kind === "cafe");
      if (f) halfway = { ...f.x, atKm: cum[k] * scale };
    }
    const ret = (() => {
      if (start.kind === "drive") return null; // the car's back at the start
      const ferry = near(data.ferries, dest.ll, 0.6)[0];
      if (ferry) return { kind: "ferry", name: ferry.x.name, ll: ferry.x.ll };
      const train = near(data.stations, dest.ll, 0.9)[0];
      if (train) return { kind: data.city ? "tube" : "train", name: train.x.name, ll: train.x.ll };
      const bus = near(data.stops, dest.ll, 0.45)[0];
      if (bus) return { kind: "bus", name: "", ll: bus.x };
      return null;
    })();
    const coastal = COASTAL.has(dest.kind) || !!trail?.coastal;
    const score = (KS[dest.kind] || 1) + (dest.notable ? 1.5 : 0)
      + (trail ? 2 + (trail.national ? 1 : 0) : -1.5) + (coastal ? 1 : 0)
      + Math.min(3, landmarks.length + 0.5 * landmarks.filter((l) => l.notable).length)
      + (refuels.length ? 1.5 : 0) + (halfway ? 0.5 : 0) - (start.driveMins || 0) / 20
      - Math.max(0, streetKm - (data.city ? 1 : 1.5)) * (data.city ? 0.9 : 0.5)
      + (refuels.length && ret && dest.kind !== "food" ? 1.5 : 0);
    out.push({
      id: `adv-${dest.id}-${start.kind !== "door" ? norm(start.name).replace(/ /g, "-") : "here"}`,
      dest: { id: dest.id, name: dest.name, kind: dest.kind, ll: dest.ll, wiki: dest.wiki || null, notable: !!dest.notable },
      start: { name: start.name, ll: start.ll, kind: start.kind, driveMins: start.driveMins || 0 },
      trail, coastal, walkKm: walk, ferry: ferryKm > 0.05,
      landmarks: landmarks.filter((l) => !/bench|memorial|plaque/i.test(l.name)).sort((a, b) => (b.notable ? 1 : 0) - (a.notable ? 1 : 0)).slice(0, 3).sort((a, b) => a.atKm - b.atKm).map((l) => ({ name: l.name, kind: l.kind, ll: l.ll, atKm: l.atKm, wiki: l.wiki || null, notable: l.notable })),
      refuels, halfway, ret,
      path: simplify(pts),
      score,
    });
  }
  return out;
}

async function addClimb(list) {
  // Sample each route every ~250 m (max 25 points), batched 100 points per request.
  const samples = [];
  list.forEach((a, ai) => {
    const total = pathKm(a.path);
    const n = Math.min(25, Math.max(2, Math.ceil(total / 0.25)));
    let acc = 0, k = 1;
    const pts = [a.path[0]];
    for (let s = 1; s < n; s++) {
      const target = (total * s) / (n - 1);
      while (k < a.path.length && acc + km(a.path[k - 1], a.path[k]) < target) { acc += km(a.path[k - 1], a.path[k]); k++; }
      pts.push(a.path[Math.min(k, a.path.length - 1)]);
    }
    pts.forEach((p) => samples.push({ ai, p }));
  });
  const heights = [];
  for (let i = 0; i < samples.length; i += 100) {
    const chunk = samples.slice(i, i + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((c) => c.p[0].toFixed(5)).join(",")}&longitude=${chunk.map((c) => c.p[1].toFixed(5)).join(",")}`;
    let got = null;
    for (let attempt = 0; attempt < 3 && !got; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
      try { const res = await fetch(url); if (res.ok) got = (await res.json()).elevation; } catch { /* retry */ }
    }
    heights.push(...(got || chunk.map(() => null)));
  }
  list.forEach((a, ai) => {
    const hs = samples.map((s, i) => (s.ai === ai ? heights[i] : undefined)).filter((h) => h !== undefined);
    let up = 0, down = 0;
    for (let i = 1; i < hs.length; i++) {
      if (hs[i] == null || hs[i - 1] == null) continue;
      const d = hs[i] - hs[i - 1];
      if (d > 3) up += d; else if (d < -3) down -= d;
    }
    a.ascent = Math.round(up);
    a.descent = Math.round(down);
  });
}

async function addAbout(list) {
  const titles = [...new Set(list.flatMap((a) => [a.dest.wiki, a.landmarks.find((l) => l.wiki)?.wiki]).filter(Boolean))].slice(0, 8);
  const about = {};
  await Promise.all(titles.map(async (t) => {
    try {
      const r = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`)).json();
      const first = (r.extract || "").split(/(?<=[.!?])\s+/)[0];
      if (first && first.length < 260) about[t] = first;
    } catch { /* a nice-to-have */ }
  }));
  for (const a of list) {
    if (a.dest.wiki) a.dest.about = about[a.dest.wiki] || null;
    for (const l of a.landmarks) if (l.wiki) l.about = about[l.wiki] || null;
  }
}

function walkMinutes(a) {
  const base = (a.walkKm / 4.2) * 60 * (a.trail ? 1.1 : 1);
  return Math.round((base + ((a.ascent || 0) / 100) * 10) / 5) * 5;
}

async function generate(loc) {
  const json = await overpass(query(loc.ll));
  const data = parse(json);
  data.city = inLondon(loc.ll);
  data.home = loc.ll;
  const g = buildGraph(data);
  const spots = dedupeSpots(data.spots);
  data.landmarkSpots = spots.filter((s) => LANDMARK_KINDS.has(s.kind));
  // Destinations: scenic spots, plus pubs and cafés right by a trail ("walk to lunch").
  const dests = spots.filter((s) => s.kind !== "lighthouse" || s.name).map((s) => ({ ...s, snap: g.n ? nearestNode(g, s.ll, 0.6) : null }));
  if (g.n) {
    for (const f of data.food) {
      if (f.kind !== "pub") continue;
      const snap = nearestNode(g, f.ll, 0.2);
      if (snap) dests.push({ id: f.id, name: f.n, kind: "food", ll: f.ll, snap, food: f, notable: false });
    }
  }
  let all = [];
  // From the door…
  const door = { name: loc.name, ll: loc.ll, kind: "door", snap: g.n ? nearestNode(g, loc.ll, 0.3) || nearestNode(g, loc.ll, 1.2) : null };
  const vias = data.landmarkSpots
    .filter((l) => l.notable && ["castle", "fort", "lighthouse", "ruins", "cape"].includes(l.kind) && km(l.ll, loc.ll) < 12)
    .map((l) => ({ ...l, snap: g.n ? nearestNode(g, l.ll, 0.3) : null }))
    .filter((l) => l.snap)
    .sort((a, b) => km(a.ll, loc.ll) - km(b.ll, loc.ll))
    .slice(0, 8)
    .map((l) => ({ ...l, dij: dijkstra(g, l.snap.i, 14) }));
  const doorKm = data.city ? 6.5 : 14; // in a city, longer walks start a ride away
  const doorDij = door.snap ? dijkstra(g, door.snap.i, doorKm) : null;
  if (door.snap) all.push(...compose(data, g, door, doorDij, dests, doorKm, vias));
  else all.push(...compose(data, g, { ...door, snap: { d: 0 } }, null, dests, 4));
  // …or a short drive to a village on a trail.
  if (g.n) {
    const heads = data.villages
      .map((v) => ({ ...v, snap: nearestNode(g, v.ll, 0.5), driveMins: travel(v.ll, loc.ll).mins, by: travel(v.ll, loc.ll).mode }))
      .filter((v) => v.snap && km(v.ll, loc.ll) > 2.5 && v.driveMins <= 35)
      .sort((a, b) => a.driveMins - b.driveMins)
      .filter((v, i, arr) => arr.findIndex((o) => km(o.ll, v.ll) < 2) === i)
      .slice(0, 8);
    for (const h of heads) {
      const start = { name: h.name, ll: h.ll, kind: h.by === "transit" ? "ride" : "drive", driveMins: h.driveMins, snap: h.snap };
      all.push(...compose(data, g, start, dijkstra(g, h.snap.i, 8), dests, 8, vias));
    }
  }
  // One adventure per destination: keep the best way to get there.
  all.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const stem = (n) => n.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
  all = all.filter((a) => (seen.has(stem(a.dest.name)) ? false : seen.add(stem(a.dest.name))));
  // Variety: within each length (short, half day, long), routes along the same corridor
  // (same start, trail and first landmark) get marked down. A short walk to the castle
  // and the longer one past it to the beach suit different afternoons, so both stay.
  const band = (a) => (a.walkKm < 4.5 ? 0 : a.walkKm < 8.5 ? 1 : 2);
  const chosen = [];
  const corridor = (a) => `${band(a)}|${a.start.name}|${a.trail?.name || ""}|${a.landmarks.find((l) => l.notable)?.name || a.landmarks[0]?.name || ""}`;
  const pool = all.slice();
  while (pool.length && chosen.length < 15) {
    pool.forEach((a) => { a.adj = a.score * Math.pow(0.6, chosen.filter((c) => corridor(c) === corridor(a)).length); });
    pool.sort((a, b) => b.adj - a.adj);
    chosen.push(pool.shift());
  }
  const keep = new Set([0, 1, 2].flatMap((b) => chosen.filter((a) => band(a) === b).slice(0, 5)));
  all = chosen.filter((a) => keep.has(a));
  all.forEach((a) => delete a.adj);
  await Promise.all([addClimb(all), addAbout(all)]);
  for (const a of all) a.walkMins = walkMinutes(a);
  const food = data.food.map((f) => ({ id: f.id, n: f.n, kind: f.kind, ll: f.ll.map((x) => +x.toFixed(5)), hours: f.hours, url: f.url, chain: f.chain || undefined, cuisine: f.cuisine || undefined }));
  return { list: all, food };
}

// ── loading per place ────────────────────────────────────────────
const keyOf = (l) => `${l.ll[0].toFixed(2)},${l.ll[1].toFixed(2)}`;

export async function loadAdventures(loc = getLoc()) {
  const key = keyOf(loc);
  if (state.key === key && (state.status === "ready" || state.status === "loading")) return state.list;
  const mine = ++token;
  try {
    const c = JSON.parse(localStorage.getItem(STORE + key));
    if (c && Date.now() - c.at < TTL) { state = { key, status: "ready", list: c.list, food: c.food || [] }; emit(); return state.list; }
  } catch { /* fall through */ }
  state = { key, status: "loading", list: [], food: [] };
  emit();
  loadWeather(loc.ll);
  for (let round = 0; round < 2; round++) {
    try {
      const { list, food } = await generate(loc);
      if (mine !== token) return [];
      state = { key, status: "ready", list, food };
      try { localStorage.setItem(STORE + key, JSON.stringify({ at: Date.now(), list, food })); } catch { /* cache is optional */ }
      emit();
      return list;
    } catch {
      await new Promise((r) => setTimeout(r, 6000));
    }
  }
  if (mine === token) { state = { key, status: "error", list: [], food: [] }; emit(); }
  return [];
}

onChange(({ loc }) => loadAdventures(loc));

// ── turning an adventure into a date for a particular moment ─────
const STAY = 60; // minutes at the far end (beach walk, lunch…)
const BACK_RIDE = 35; // bus, ferry or train back, roughly

const EMOJI = { beach: "🏖️", reserve: "🌿", peak: "⛰️", cape: "🌊", waterfall: "💧", viewpoint: "🔭", castle: "🏰", fort: "🏰", ruins: "🏚️", lighthouse: "🌊", wood: "🌳", park: "🌳", attraction: "✨", food: "🥾" };
const QUESTIONS = [
  "What's the most beautiful place you've ever been, and who were you with?",
  "Where in the world would you most love to walk together one day?",
  "What did you love doing outdoors when you were a kid?",
  "Sea, hills or city: if we could live anywhere, which would you pick?",
  "What have you noticed here that you'd never see at home?",
  "What's a small adventure you'd like us to have this year?",
  "When do you feel most like yourself?",
];

export const theTrail = (n) => (/^the\s/i.test(n) ? n : `the ${n}`);
const fmtKm = (k) => (k < 10 ? k.toFixed(1) : Math.round(k)) + " km";
export const fmtMins = (m) => {
  const h = Math.floor(m / 60), r = Math.round((m % 60) / 15) * 15;
  if (!h) return `${Math.max(10, Math.round(m / 5) * 5)} min`;
  if (r === 60) return `${h + 1} hrs`;
  const frac = { 0: "", 15: "¼", 30: "½", 45: "¾" }[r];
  return `${h}${frac} hr${h > 1 || frac ? "s" : ""}`;
};
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);

const backMinutes = (a) => (a.ret ? BACK_RIDE : a.walkMins);
const totalMinutes = (a) => 2 * a.start.driveMins + a.walkMins + STAY + backMinutes(a);
const timeCat = (a) => { const t = totalMinutes(a); return t <= 135 ? 1 : t <= 285 ? 2 : 3; };

function leaveTime(mode, now) {
  if (mode !== "plan") return startFor(mode, now);
  const t = new Date(now); t.setDate(t.getDate() + (now.getHours() >= 10 ? 1 : 0)); t.setHours(10, 0, 0, 0);
  return t;
}

// The full timeline for leaving at a given moment.
export function timeline(a, mode, now = new Date()) {
  const leave = leaveTime(mode, now);
  const addM = (d, m) => new Date(d.getTime() + m * 60e3);
  const setOff = addM(leave, a.start.driveMins);
  const perKm = a.walkMins / Math.max(a.walkKm, 0.1);
  const stops = a.landmarks.map((l) => ({ ...l, at: addM(setOff, l.atKm * perKm) }));
  const arrive = addM(setOff, a.walkMins);
  const back = addM(arrive, STAY);
  const home = a.start.kind === "ride" && a.ret ? addM(back, a.start.driveMins + 10) : addM(back, backMinutes(a) + a.start.driveMins);
  const lastLit = a.ret ? back : addM(home, -a.start.driveMins);
  return { leave, setOff, stops, arrive, back, home, lastLit };
}

// Why it won't work at this moment (null if it will).
export function whyNotAdventure(a, mode, now = new Date()) {
  if (mode === "plan") return null;
  const tl = timeline(a, mode, now);
  const sun = sunTimes(tl.leave, a.dest.ll);
  if (sun) {
    if (tl.setOff < new Date(sun.sunrise.getTime() - 30 * 60e3)) return "before sunrise";
    if (tl.lastLit > new Date(sun.sunset.getTime() + 15 * 60e3)) return "not enough daylight";
  }
  const w = weatherWindow(tl.setOff, tl.lastLit);
  if (w?.storm) return "storm forecast";
  return null;
}

// The latest you could leave and still be done before dark.
export function latestLeave(a, mode, now = new Date()) {
  if (mode === "plan") return null;
  const tl = timeline(a, mode, now);
  const sun = sunTimes(tl.leave, a.dest.ll);
  if (!sun) return null;
  const needed = tl.lastLit.getTime() - tl.leave.getTime();
  return new Date(sun.sunset.getTime() + 15 * 60e3 - needed);
}

// Which place to refuel at: open when you arrive, suited to the hour and the budget.
export function refuelFor(a, arrive, cost) {
  const h = arrive.getHours() + arrive.getMinutes() / 60;
  const kinds = h < 11.5 ? ["cafe", "ice_cream", "pub", "restaurant"] : h < 15 ? ["cafe", "pub", "chippy", "restaurant", "ice_cream"] : h < 17.5 ? ["cafe", "ice_cream", "chippy", "pub", "restaurant"] : ["pub", "chippy", "restaurant", "cafe"];
  const treat = (r) => (r.g?.price && /££/.test(r.g.price) ? 2 : 0) + (r.kind === "restaurant" ? 1 : 0);
  const pool = a.refuels.filter((r) => openAt(r, arrive) !== false && kinds.includes(r.kind));
  const score = (r) => (openAt(r, arrive) ? 3 : 0) + (3 - kinds.indexOf(r.kind)) + (r.g?.rating ? (r.g.rating - 4) * 4 : 0) + (cost === 2 ? treat(r) * 2 : 0) - r.d * 3 - chainPenalty(r);
  return pool.sort((x, y) => score(y) - score(x))[0] || null;
}

const ACTIVITY = {
  beach: "Beach walk (and a paddle, if you're brave)",
  reserve: "Wander the reserve and keep an eye out for wildlife",
  peak: "Take in the view from the top",
  cape: "Stand at the end and watch the sea",
  waterfall: "Find a rock by the falls and catch your breath",
  viewpoint: "Soak up the view",
  castle: "Take in the castle and the views",
  fort: "Explore the old fort",
  ruins: "Explore the ruins",
  lighthouse: "Watch the waves by the lighthouse",
  wood: "Wander the woods and find the biggest tree",
  park: "Find the best bench in the park and stay a while",
  attraction: "Take it all in",
  food: "Grab a table",
};
const REFUEL_PHRASE = { cafe: "coffee and grub", ice_cream: "ice creams", pub: "a drink and some pub grub", restaurant: "a proper meal", chippy: "fish and chips" };

export function title(a) {
  const D = a.dest.name;
  const T = a.trail && !/\bto\b/i.test(a.trail.name) ? a.trail : null; // a route named "A to B" doesn't make a title
  const L = a.landmarks.find((l) => l.notable && ["castle", "fort", "lighthouse"].includes(l.kind));
  if (a.dest.kind === "food") return `${T ? `${T.name} walk` : "A walk"} to ${D}`;
  if (L) return `Past ${L.name} to ${D}`;
  if (a.trail?.coastal) return `Coast path to ${D}`;
  if (T && ["beach", "reserve", "waterfall", "castle", "fort", "ruins"].includes(a.dest.kind)) return `${T.name} to ${D}`;
  if (a.dest.kind === "peak") return `Up ${D}`;
  if (a.dest.kind === "reserve") return `${D} ramble`;
  if (a.dest.kind === "park") return T ? `${T.name} to ${D}` : `Walk to ${D}`;
  if (a.dest.kind === "viewpoint") return `Walk up to ${D}`;
  if (a.dest.kind === "cape") return `Out to ${D}`;
  return `Walk to ${D}`;
}

export function blurb(a, refuel) {
  const start = a.start.kind === "drive" ? `Drive ${a.start.driveMins} minutes to ${a.start.name}, then walk` : a.start.kind === "ride" ? `Tube or bus to ${a.start.name} (${a.start.driveMins} min), then walk` : `Walk from ${a.start.name === "Home" ? "home" : a.start.name}`;
  const via = a.landmarks.length ? ` past ${a.landmarks.slice(0, 2).map((l) => l.name).join(" and ")}` : "";
  const along = a.trail ? ` along ${theTrail(a.trail.name)}` : "";
  const food = refuel && a.dest.kind !== "food" ? `, then ${REFUEL_PHRASE[refuel.kind] || "a bite to eat"} at ${refuel.n}` : "";
  const act = a.dest.kind === "food" ? `${ACTIVITY.food} for ${REFUEL_PHRASE[a.refuels[0]?.kind] || "lunch"}` : ACTIVITY[a.dest.kind];
  return `${start}${via}${along} to ${a.dest.name}. ${act}${food}.`;
}

export function steps(a, mode, now, refuel, cost) {
  const tl = timeline(a, mode, now);
  const when = (d) => (mode === "plan" ? "" : ` (around ${clock(d)})`);
  const out = [];
  const perKm = a.walkMins / Math.max(a.walkKm, 0.1);
  if (a.start.kind === "drive") out.push(`Drive to ${a.start.name} (about ${a.start.driveMins} min) and park up.`);
  if (a.start.kind === "ride") out.push(`Get the Tube or bus to ${a.start.name} (about ${a.start.driveMins} min).`);
  let prev = 0;
  a.landmarks.forEach((l, i) => {
    const leg = l.atKm - prev;
    out.push(`${i ? "Carry on" : mode === "plan" ? "Set off on foot" : "Leave now"} to ${l.name}: ${fmtKm(leg)}, about ${fmtMins(leg * perKm)}${when(tl.stops[i].at)}.${l.about ? ` ${l.about}` : ""}`);
    prev = l.atKm;
  });
  const rest = a.walkKm - prev;
  const hilly = (a.ascent || 0) >= 120 ? `, with about ${a.ascent} m of climbing` : "";
  out.push(`${a.landmarks.length ? "On" : mode === "plan" ? "Walk" : "Leave now and walk"} ${a.trail ? `along ${theTrail(a.trail.name)} ` : ""}to ${a.dest.name}: ${fmtKm(rest)}, about ${fmtMins(rest * perKm)}${hilly}${when(tl.arrive)}.${a.dest.about ? ` ${a.dest.about}` : ""}`);
  if (a.ferry) out.push("The route includes a short ferry crossing, so bring some change.");
  if (a.halfway) out.push(`Halfway treat if you need it: ${a.halfway.n}.`);
  const act = a.dest.kind === "food" ? "" : `${ACTIVITY[a.dest.kind]}. `;
  out.push(refuel
    ? `${act}Then ${REFUEL_PHRASE[refuel.kind] || "food"} at ${refuel.n}${refuel.hours ? "" : " (check it's open)"}.`
    : `${act}${cost === 0 ? "Bring a flask and a picnic." : "Bring a picnic: Theo can't find anywhere open nearby then."}`);
  out.push(a.ret
    ? `Getting back: ${{ bus: "there's a bus stop by the end", ferry: `the ferry from ${a.ret.name || "the terminal"}`, train: `the train from ${a.ret.name}`, tube: `the Tube or train from ${a.ret.name}` }[a.ret.kind]} (check times), a taxi, or walk back the way you came (about ${fmtMins(a.walkMins)}).`
    : `Walk back the way you came (about ${fmtMins(a.walkMins)})${a.start.kind === "drive" ? " to the car" : ""}.`);
  return out;
}

export function adventureIdea(a) {
  const moods = ["adventure"];
  if (a.walkKm >= 5 || (a.ascent || 0) >= 150) moods.push("active"); else moods.push("cosy");
  if (a.refuels.length) moods.push("food");
  if (["castle", "fort", "ruins"].includes(a.dest.kind) || a.landmarks.some((l) => ["castle", "fort", "ruins"].includes(l.kind) && l.notable)) moods.push("culture");
  const interests = ["nature", "adventure"];
  if (moods.includes("active")) interests.push("exercise");
  if (a.coastal) interests.push("water");
  if (moods.includes("culture")) interests.push("history");
  if (["viewpoint", "peak", "cape"].includes(a.dest.kind) || a.landmarks.some((l) => l.kind === "viewpoint")) interests.push("photography");
  if (a.refuels.length) interests.push("eating-out");
  if (a.start.kind !== "door") interests.push("travel");
  return {
    id: a.id,
    e: EMOJI[a.dest.kind] || "🥾",
    t: title(a),
    b: blurb(a, a.refuels[0]),
    s: [],
    q: QUESTIONS[Math.abs(hash(a.id)) % QUESTIONS.length],
    v: moods,
    w: "outdoor",
    time: timeCat(a),
    cost: 0,
    flexCost: true,
    i: interests,
    adv: a,
    whyNot: (mode, ll, now) => whyNotAdventure(a, mode, now),
    latestStart: (mode, ll, now) => latestLeave(a, mode, now),
  };
}

export const adventureIdeas = () => state.list.map(adventureIdea);
export const _debug = { query };
export { fmtKm };
