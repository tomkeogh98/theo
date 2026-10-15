// What Tom and Cat are into. Every idea is tagged with interests (ideas.js `i`),
// and "Whose pick?" leans towards that person's. Editable on the site; saved in
// this browser. Adding a brand-new interest also needs ideas tagged with it.

export const INTERESTS = [
  { id: "making-music", label: "Making music", emoji: "🎸" },
  { id: "live-music", label: "Live music", emoji: "🎤" },
  { id: "vinyl", label: "Vinyl & listening", emoji: "💿" },
  { id: "exercise", label: "Exercise", emoji: "🏃" },
  { id: "adventure", label: "Adventure", emoji: "🧭" },
  { id: "photography", label: "Photography", emoji: "📷" },
  { id: "filmmaking", label: "Filmmaking", emoji: "🎥" },
  { id: "cooking", label: "Cooking", emoji: "🍳" },
  { id: "travel", label: "Local travel", emoji: "🚆" },
  { id: "movies", label: "Movies", emoji: "🍿" },
  { id: "embroidery", label: "Embroidery & crafts", emoji: "🪡" },
  { id: "cosy", label: "Cosy nights", emoji: "🛋️" },
  { id: "theatre", label: "Theatre", emoji: "🎭" },
  { id: "eating-out", label: "Eating out", emoji: "🍽️" },
  { id: "drinks", label: "Cocktails & drinks", emoji: "🍸" },
  { id: "art", label: "Art & museums", emoji: "🖼️" },
  { id: "reading", label: "Books", emoji: "📚" },
  { id: "writing", label: "Writing & stories", emoji: "✍️" },
  { id: "dancing", label: "Dancing", emoji: "💃" },
  { id: "nature", label: "Nature & walks", emoji: "🌳" },
  { id: "water", label: "Swimming & water", emoji: "🌊" },
  { id: "history", label: "History & castles", emoji: "🏰" },
  { id: "comedy", label: "Comedy", emoji: "😂" },
  { id: "games", label: "Games", emoji: "🎲" },
  { id: "wellness", label: "Pampering", emoji: "🧖" },
  { id: "animals", label: "Animals", emoji: "🐾" },
];

export const PEOPLE = { tom: "Tom", cat: "Cat" };

const DEFAULTS = {
  tom: ["making-music", "live-music", "exercise", "adventure", "photography", "filmmaking", "cooking", "travel", "vinyl"],
  cat: ["movies", "embroidery", "cooking", "cosy", "vinyl", "theatre"],
};

const KEY = "theo.interests.v1";
const byId = new Map(INTERESTS.map((x) => [x.id, x]));
export const interestById = (id) => byId.get(id);

export function getInterests() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.tom && saved?.cat) return { tom: saved.tom.filter((x) => byId.has(x)), cat: saved.cat.filter((x) => byId.has(x)) };
  } catch { /* fall through to defaults */ }
  return { tom: [...DEFAULTS.tom], cat: [...DEFAULTS.cat] };
}

export function setInterests(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ }
}

export function resetInterests() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  return getInterests();
}
