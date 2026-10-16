// Time-of-day sense. "Right now" and "Tonight" only offer ideas you could actually
// start then: venues in their usual hours, daylight ideas before dark, starry ones
// after it, and nothing that has to be booked in advance. "Plan ahead" lifts all
// of that and labels anything that needs booking.

// ── Sunrise / sunset (after the well-known SunCalc formulas) ─────
const RAD = Math.PI / 180;
const DAY_MS = 864e5;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

export function sunTimes(date, [lat, lng]) {
  const noon = new Date(date); noon.setHours(12, 0, 0, 0);
  const d = noon.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = RAD * (357.5291 + 0.98560028 * ds);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
  const transit = (a) => J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const jNoon = transit(ds);
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return null; // polar day or night
  const w = Math.acos(cosW);
  const jSet = transit(0.0009 + (w + lw) / (2 * Math.PI) + n);
  const jRise = jNoon - (jSet - jNoon);
  const fromJ = (j) => new Date((j + 0.5 - J1970) * DAY_MS);
  return { sunrise: fromJ(jRise), sunset: fromJ(jSet) };
}

// ── When each idea can start ─────────────────────────────────────
// at:   start windows in local hours (26 = 2am the next night)
// sun:  "day" needs daylight · "dark" after dusk · "golden" the hours before sunset · "sunrise"
// book: has to be booked in advance (Plan ahead only)
// months: [from, to] seasonal
const SHOPS = [[9.5, 16.5]];
const SUPERMARKET = [[8, 20.5]];
const DINNER = [[12, 14], [17.5, 21]];
const GIG = [[18.5, 21]];
const DINNER_IN = [[16, 20.5]]; // shop, then cook, then eat at a sensible hour
export const TIMING = {
  // stay home, but you need to shop first
  "mystery-basket": { at: DINNER_IN }, "fresh-pasta": { at: [[15, 20]] }, "dumplings": { at: [[15, 20]] },
  "passport-dinner": { at: DINNER_IN }, "tapas-at-home": { at: DINNER_IN }, "pizza-blind": { at: DINNER_IN },
  "cookbook-roulette": { at: DINNER_IN }, "dinner-and-a-movie": { at: DINNER_IN }, "first-date-recreate": { at: DINNER_IN },
  "bake-off-technical": { at: [[10, 21]] }, "blind-tasting": { at: [[16, 21.5]] }, "album-cocktail": { at: [[16, 23]] },
  "fizz-fancy-bits": { at: [[16, 23]] }, "cocktail-masterclass": { at: [[16, 21.5]] }, "deluxe-spa-night": { at: [[16, 21.5]] },
  "lights-out": { at: [[17.5, 22]] }, "blanket-fort": { at: [[12, 22]] }, "spa-night": { at: [[16, 23]] },
  "stitch-and-spin": { at: [[9, 25]] }, "comfort-film-swap": { at: [[12, 23]] },
  "new-record-ritual": { at: SHOPS }, "scrapbook": { at: [[9, 17]] }, "breakfast-in-bed": { at: [[6, 11]] },
  "partner-workout": { at: [[6, 21]] }, "karaoke-duet": { at: [[12, 23]] },
  "online-class": { book: true }, "big-screen-home": { book: true }, "home-tasting-menu": { book: true }, "make-kit": { book: true },
  // outdoors
  "playlist-walk": { at: [[7, 22]] }, "coin-flip-walk": { at: [[7, 22]] }, "run-for-pancakes": { at: [[6, 20]] },
  "alphabet-photo": { sun: "day" }, "golden-hour-portraits": { sun: "golden" }, "golden-toast": { sun: "golden" },
  "night-photography": { sun: "dark", at: [[16, 24]] }, "stargazing": { sun: "dark", at: [[17, 26]] },
  "sunrise-cocoa": { sun: "sunrise" }, "fancy-picnic": { sun: "day", at: [[10, 17]] }, "proper-hamper": { sun: "day", at: [[10, 16]] },
  "coast-day": { sun: "day", at: [[8, 12]] }, "summit-sandwich": { sun: "day", at: [[7, 11.5]] }, "cycle-pub": { sun: "day", at: [[9, 13]] },
  "woodland-walk": { sun: "day" }, "wild-swim": { sun: "day", at: [[7, 19]] }, "paddle": { sun: "day", at: [[9, 15]] },
  "public-art-hunt": { sun: "day" }, "plaque-trail": { sun: "day" }, "sketch-walk": { sun: "day" }, "pressed-flowers": { sun: "day" },
  "busker-bingo": { at: [[11, 18]] }, "chips-with-a-view": { at: [[16, 21]] },
  "sleep-out": { book: true }, "sunset-boat": { book: true, sun: "golden" }, "treetop-adventure": { book: true },
  "countryside-hack": { book: true }, "open-air-show": { book: true, months: [5, 9] },
  // going somewhere
  "record-dash": { at: SHOPS }, "bookshop-date": { at: SHOPS }, "record-rummage": { at: SHOPS }, "charity-shop": { at: [[9.5, 15.5]] },
  "gallery-curators": { at: [[10, 16]] }, "one-room-only": { at: [[10, 16]] }, "paint-a-pot": { at: [[10, 16]] }, "library-date": { at: [[9.5, 17]] },
  "gig-roulette": { at: GIG }, "open-mic": { at: [[19, 21.5]] }, "jazz-bar": { at: [[19, 22.5]] }, "classical-night": { at: [[18.5, 19.5]] },
  "comedy-night": { at: [[18.5, 20.5]] }, "fringe-theatre": { at: [[18.5, 19.75]] }, "rush-theatre": { at: [[12, 19.25]] },
  "lunchtime-concert": { at: [[11.5, 13.5]] }, "piano-nightcap": { at: [[20, 23.5]] },
  "poster-cinema": { at: [[11, 21]] }, "matinee": { at: [[12, 16.5]] },
  "new-cuisine": { at: DINNER }, "somewhere-new": { at: DINNER }, "pub-supper": { at: [[12, 14], [17.5, 20.75]] },
  "dinner-lovely": { at: [[18, 21]] }, "cheap-and-cheerful": { at: [[11.5, 21.5]] }, "afternoon-tea": { at: [[12, 16]] },
  "cocktails-small-plates": { at: [[17, 22]] }, "wine-cheese-bar": { at: [[16, 22]] }, "dessert-crawl": { at: [[12, 21]] },
  "brunch-new": { at: [[8.5, 12.5]] }, "fireside-pint": { at: [[12, 22.5]] }, "board-game-cafe": { at: [[11, 21.5]] },
  "bouldering": { at: [[10, 20.5]] }, "roller-disco": { at: [[12, 20]] }, "escape-room": { at: [[10, 20.5]] },
  "bowling-shakes": { at: [[10, 22]] }, "drop-in-yoga": { at: [[6.5, 19.5]] }, "swim-steam": { at: [[7, 20]] },
  "axe-throwing": { at: [[11, 20.5]] }, "arcade-bar": { at: [[12, 23]] },
  "big-theatre": { book: true }, "pottery-class": { book: true }, "cooking-class": { book: true }, "volunteer-cats": { book: true },
  "dance-class": { book: true }, "chefs-counter": { book: true }, "life-drawing": { book: true }, "museum-late": { book: true },
  "spa-day": { book: true }, "improv-taster": { book: true },
  // either
  "disposable-day": { sun: "day", at: [[9, 15]] }, "market-to-plate": { at: [[8, 12]] }, "third-stop": { at: [[7, 12]] },
  "record-coffee-photo": { at: [[8, 11]] }, "tourists-at-home": { at: [[9, 12]] }, "castle-day": { sun: "day", at: [[9, 13]] },
  "crazy-golf": { at: [[10, 20]] }, "market-graze": { at: [[10, 18.5]] }, "swim-sauna": { at: [[7, 20]] },
  "vineyard-tasting": { book: true },
};

function timingFor(idea) {
  const t = TIMING[idea.id] || {};
  if (t.at || t.book) return t;
  const base = {
    in: { 1: [[5, 28]], 2: [[6, 21.5]], 3: [[6.5, 12.5]] }[idea.time],
    outdoor: [[6, 22]],
    venue: [[10, 21]],
    out: [[9, 18]],
  }[idea.w];
  return { ...t, at: base, sun: t.sun ?? (idea.w === "outdoor" ? "day" : undefined) };
}

export const needsBooking = (idea) => !!timingFor(idea).book;

const hourOf = (d) => d.getHours() + d.getMinutes() / 60;
const inWindows = (h, wins) => wins.some(([a, b]) => (h >= a && h <= b) || (h + 24 >= a && h + 24 <= b));
const DAYLIGHT_HOURS = { 1: 1.5, 2: 3, 3: 6 };

// The moment an idea would start: now, or 7:30pm for "Tonight" (or now, if later).
export function startFor(mode, now = new Date()) {
  if (mode !== "tonight") return now;
  const t = new Date(now); t.setHours(19, 30, 0, 0);
  return now > t ? now : t;
}

// null if it works, otherwise a short reason.
export function whyNot(idea, mode, ll, now = new Date()) {
  if (mode === "plan") return null;
  const t = timingFor(idea);
  if (t.book) return "needs booking";
  const start = startFor(mode, now);
  const h = hourOf(start);
  if (t.months) {
    const m = start.getMonth() + 1;
    if (m < t.months[0] || m > t.months[1]) return "out of season";
  }
  if (t.at && !inWindows(h, t.at)) return "wrong time";
  if (t.sun) {
    const sun = sunTimes(start, ll);
    if (sun) {
      const rise = hourOf(sun.sunrise), set = hourOf(sun.sunset);
      const dur = DAYLIGHT_HOURS[idea.time] || 2;
      if (t.sun === "day" && (h < rise - 0.25 || h + dur > set + 0.25)) return "needs daylight";
      if (t.sun === "dark" && !(h >= set + 0.75 || h <= rise - 1)) return "needs dark";
      if (t.sun === "golden" && !(h >= set - 2 && h <= set - 0.3)) return "not golden hour";
      if (t.sun === "sunrise" && !(h >= rise - 1.5 && h <= rise - 0.25)) return "not sunrise";
    }
  }
  return null;
}

const fmtTime = (h) => {
  const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60);
  const d = new Date(); d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: mm ? "2-digit" : undefined, hour12: true }).replace(" ", "").replace(":00", "");
};
export const clock = (d) => fmtTime(hourOf(d));

// A short "go by" hint for a doable idea, e.g. "Start by 9pm" or "Before dark (sunset 6:12pm)".
export function goByHint(idea, mode, ll, now = new Date()) {
  if (mode === "plan") return needsBooking(idea) ? "📅 Book ahead" : "";
  const t = timingFor(idea);
  const start = startFor(mode, now);
  const h = hourOf(start);
  if (t.sun === "day") {
    const sun = sunTimes(start, ll);
    if (sun) return `☀️ Before dark (sunset ${clock(sun.sunset)})`;
  }
  if (t.sun === "golden") {
    const sun = sunTimes(start, ll);
    if (sun) return `🌇 Sunset ${clock(sun.sunset)}`;
  }
  if (t.sun === "dark") return "🌙 Best after dark";
  const win = (t.at || []).find(([a, b]) => (h >= a && h <= b) || (h + 24 >= a && h + 24 <= b));
  if (!win || win[1] >= 24 || idea.w === "in") return "";
  return `⏰ Start by ${fmtTime(win[1])}`;
}

// A friendly line about the moment, for under the "When?" picker.
export function momentLine(mode, ll, now = new Date()) {
  const sun = sunTimes(now, ll);
  const t = clock(now);
  if (mode === "plan") return "Planning ahead: everything's possible, and anything that needs booking is marked.";
  if (mode === "tonight" && hourOf(now) < 19.5) return `Ideas for tonight from 7:30pm${sun ? ` (sunset's at ${clock(sun.sunset)})` : ""}.`;
  if (!sun) return `It's ${t}. Theo's only showing things you can start now.`;
  const h = hourOf(now), rise = hourOf(sun.sunrise), set = hourOf(sun.sunset);
  const light = h < rise ? `before sunrise (${clock(sun.sunrise)})` : h < set - 1 ? `sunset's at ${clock(sun.sunset)}` : h < set ? `the sun sets at ${clock(sun.sunset)}` : "after dark";
  return `It's ${t}, ${light}. Theo's only showing things you can start now.`;
}

// ── Opening hours (the common OpenStreetMap forms) ───────────────
// Handles "Mo-Fr 09:00-17:00; Sa 10:00-16:00", "Tu-Su 12:00-14:30,18:00-22:00",
// "24/7", "off". Anything fancier (months, holidays, sunrise…) returns null = unknown.
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function parseHours(str) {
  if (!str) return null;
  const s = str.trim();
  if (s === "24/7") return Array.from({ length: 7 }, () => [[0, 24]]);
  const week = Array(7).fill(null);
  let any = false;
  for (const raw of s.split(";")) {
    const rule = raw.trim();
    if (!rule) continue;
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/);
    if (!m) return null;
    const daysPart = m[1] || "Mo-Su";
    const rest = m[2].trim();
    if (/[A-Za-z]/.test(rest.replace(/\b(off|closed)\b/g, ""))) return null; // months, sunrise, comments…
    const days = new Set();
    for (const tok of daysPart.split(",").filter(Boolean)) {
      if (tok === "PH") continue;
      const [a, b] = tok.split("-");
      const i = DAYS.indexOf(a), j = b ? DAYS.indexOf(b) : i;
      if (i < 0 || j < 0) return null;
      for (let k = i; ; k = (k + 1) % 7) { days.add(k); if (k === j) break; }
    }
    if (!days.size) continue;
    let spans;
    if (/^(off|closed)$/.test(rest)) spans = [];
    else {
      spans = [];
      for (const part of rest.split(",")) {
        const t = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/);
        if (!t) return null;
        const a = +t[1] + +t[2] / 60;
        let b = +t[3] + +t[4] / 60;
        if (b <= a) b += 24; // past midnight
        spans.push([a, b]);
      }
    }
    days.forEach((d) => (week[d] = spans));
    any = true;
  }
  return any ? week.map((d) => d || []) : null;
}

// Rough typical hours for kinds of place that keep daytime hours, used only to
// avoid sending you to a market or museum at 9pm. Never shown as fact.
const TYPICAL = [
  [["market"], "Mo-Sa 09:00-17:00; Su 10:00-16:00"],
  [["museum"], "Mo-Su 10:00-17:00"],
  [["bookshop", "records"], "Mo-Sa 09:30-17:30; Su 11:00-16:00"],
  [["castle"], "Mo-Su 10:00-17:00"],
];
function typicalWeek(place) {
  if (place._typical !== undefined) return place._typical;
  const hit = TYPICAL.find(([tags]) => place.tags?.some((t) => tags.includes(t)));
  return (place._typical = hit ? parseHours(hit[1]) : null);
}

// true / false / null (unknown) for a place at a given moment.
export function openAt(place, when = new Date()) {
  const own = place._week === undefined ? (place._week = parseHours(place.hours)) : place._week;
  const week = own || typicalWeek(place);
  if (!week) return null;
  const d = (when.getDay() + 6) % 7;
  const h = hourOf(when);
  if (week[d].some(([a, b]) => h >= a && h < b)) return true;
  const prev = week[(d + 6) % 7];
  return prev.some(([a, b]) => b > 24 && h + 24 < b);
}

// "Open now · until 11pm" / "Closed now · opens 5:30pm" / "" when unknown.
export function hoursLine(place, when = new Date()) {
  const week = place._week === undefined ? (place._week = parseHours(place.hours)) : place._week;
  if (!week) return "";
  const d = (when.getDay() + 6) % 7;
  const h = hourOf(when);
  const today = week[d];
  const cur = today.find(([a, b]) => h >= a && h < b) || week[(d + 6) % 7].map(([a, b]) => [a - 24, b - 24]).find(([a, b]) => h >= a && h < b);
  if (cur) return `🟢 Open now · until ${fmtTime(cur[1])}`;
  const next = today.find(([a]) => a > h);
  return next ? `🔴 Closed now · opens ${fmtTime(next[0])}` : "🔴 Closed for today";
}
