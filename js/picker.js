// How Theo chooses: hard filters (in/out, time, budget), then a weighted shuffle
// that favours matching moods, whoever's turn it is, and ideas you haven't done lately.

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
export const WHERE_LABEL = { in: "Stay in", out: "Head out" };

// Each relax level drops one more constraint when there aren't enough matches.
const LEVELS = [
  { where: true, time: true, cost: true },
  { where: true, time: true, cost: false },
  { where: true, time: false, cost: false },
  { where: false, time: false, cost: false },
];

function fits(idea, prefs, level) {
  if (level.where && prefs.where !== "any" && idea.w !== prefs.where) return false;
  if (level.time && idea.time > prefs.time) return false;
  if (level.time && prefs.time === 3 && idea.time === 1) return false;
  if (level.cost && idea.cost > prefs.cost) return false;
  return true;
}

function weight(idea, prefs, recent) {
  let w = 1;
  const overlap = idea.v.filter((v) => prefs.vibes.includes(v)).length;
  if (prefs.vibes.length) w += overlap * 2.5 - (overlap ? 0 : 0.8);
  if (prefs.whose !== "both" && idea.who.includes(prefs.whose)) w += 2;
  if (prefs.whose !== "both" && !idea.who.includes(prefs.whose)) w -= 0.6;
  if (idea.time === prefs.time) w += 1;
  if (recent.has(idea.id)) w -= 3;
  return Math.max(0.15, w) ** 2;
}

// Weighted sample without replacement (Efraimidis–Spirakis).
function sample(pool, n, wfn) {
  return pool
    .map((idea) => ({ idea, key: Math.random() ** (1 / wfn(idea)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.idea);
}

export function deal(ideas, prefs, { n = 3, recent = new Set(), exclude = new Set() } = {}) {
  const avail = ideas.filter((i) => !exclude.has(i.id));
  for (let i = 0; i < LEVELS.length; i++) {
    const pool = avail.filter((idea) => fits(idea, prefs, LEVELS[i]));
    if (pool.length >= n || i === LEVELS.length - 1) {
      return { picks: sample(pool, n, (idea) => weight(idea, prefs, recent)), relaxed: i > 0 };
    }
  }
}
