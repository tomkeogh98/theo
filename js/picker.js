// How Theo chooses. Your picks are rules, not hints:
//   moods  → the idea must match at least one mood you picked
//   where  → stay home / get outdoors / go somewhere (ideas marked "out" work for either outing)
//   budget → Free = free, A little = up to £, Treat us = ££ only
//   time   → A couple of hours = short only, The evening = up to an evening, All day = evening or longer
// Ideas that fit everything are shuffled, leaning towards whoever's pick it is and
// away from things you've done lately. If fewer than three fit, Theo tops up with the
// nearest misses, bending the least important rule first, and says which rule he bent.

export const VIBES = [
  { id: "cosy", label: "Cosy", emoji: "🛋️" },
  { id: "adventure", label: "Adventurous", emoji: "🧭" },
  { id: "creative", label: "Creative", emoji: "🎨" },
  { id: "music", label: "Musical", emoji: "🎶" },
  { id: "food", label: "Hungry", emoji: "🍝" },
  { id: "culture", label: "Cultured", emoji: "🎭" },
  { id: "active", label: "Active", emoji: "🏃" },
];

export const TIME_LABEL = { 1: "A couple of hours", 2: "The whole evening", 3: "A whole day" };
export const COST_LABEL = { 0: "Free", 1: "£", 2: "££" };
export const WHERE_LABEL = { in: "Stay home", outdoor: "Outdoors", venue: "Go somewhere", out: "Out & about" };
export const WHERE_EMOJI = { in: "🏠", outdoor: "🌳", venue: "🍽️", out: "🚪" };

// No rules at all (the "Just surprise us" button).
export const ANYTHING = { vibes: [], where: "any", time: 0, cost: -1, whose: "both" };

const placeOk = (idea, where) =>
  where === "any" || (where === "in" ? idea.w === "in" : idea.w === where || idea.w === "out");
const budgetOk = (idea, cost) =>
  cost < 0 || (cost === 0 ? idea.cost === 0 : cost === 1 ? idea.cost <= 1 : idea.cost === 2);
const timeOk = (idea, time) =>
  !time || (time === 1 ? idea.time === 1 : time === 2 ? idea.time <= 2 : idea.time >= 2);

// Which of your rules an idea breaks. Empty means a perfect fit.
export function bends(idea, prefs) {
  const out = [];
  if (prefs.vibes.length && !idea.v.some((v) => prefs.vibes.includes(v))) out.push("mood");
  if (!placeOk(idea, prefs.where)) out.push("where");
  if (!budgetOk(idea, prefs.cost)) out.push("budget");
  if (!timeOk(idea, prefs.time)) out.push("time");
  return out;
}

// Which rule matters least when Theo has to bend one.
const BEND_COST = { time: 1, budget: 2, where: 3, mood: 4 };

function weight(idea, prefs, recent, interests) {
  let w = 1 + idea.v.filter((v) => prefs.vibes.includes(v)).length * 1.5;
  const tom = idea.i.filter((x) => interests.tom.includes(x)).length;
  const cat = idea.i.filter((x) => interests.cat.includes(x)).length;
  if (prefs.whose === "tom") w *= tom ? 1 + tom : 0.25;
  else if (prefs.whose === "cat") w *= cat ? 1 + cat : 0.25;
  else w *= 1 + (tom ? 0.5 : 0) + (cat ? 0.5 : 0) + (tom && cat ? 0.75 : 0);
  if (prefs.time && idea.time === prefs.time) w += 0.5;
  if (recent.has(idea.id)) w *= 0.2;
  return w;
}

// Weighted sample without replacement (Efraimidis–Spirakis).
function sample(pool, n, wfn) {
  return pool
    .map((x) => ({ x, key: Math.random() ** (1 / wfn(x.idea)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((s) => s.x);
}

// Returns { picks: [{ idea, bends }], exact } where exact = how many ideas fit perfectly.
// `possible` is a hard filter that is never bent (e.g. "can you start this right now?").
export function deal(ideas, prefs, { n = 3, recent = new Set(), exclude = new Set(), interests = { tom: [], cat: [] }, possible = () => true } = {}) {
  const wfn = (idea) => weight(idea, prefs, recent, interests);
  const avail = ideas.filter((i) => !exclude.has(i.id) && possible(i)).map((idea) => ({ idea, bends: bends(idea, prefs) }));
  const exact = avail.filter((x) => !x.bends.length);
  const picks = sample(exact, n, wfn);
  if (picks.length < n) {
    const near = avail
      .filter((x) => x.bends.length)
      .map((x) => ({ ...x, pen: x.bends.reduce((s, b) => s + BEND_COST[b], 0) }));
    for (const pen of [...new Set(near.map((x) => x.pen))].sort((a, b) => a - b)) {
      if (picks.length >= n) break;
      picks.push(...sample(near.filter((x) => x.pen === pen), n - picks.length, wfn));
    }
  }
  return { picks: picks.map(({ idea, bends: b }) => ({ idea, bends: b })), exact: exact.length };
}
