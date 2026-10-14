// The date diary, kept in this browser only. Every access is guarded, so a
// private window or blocked storage just means an empty diary, not a broken page.

const KEY = "theo.diary.v1";
const PREFS_KEY = "theo.prefs.v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: carry on without saving */
  }
}

export const diary = {
  all: () => read(KEY, []),
  save: (entries) => write(KEY, entries),
  add(idea, place) {
    const entries = diary.all();
    const entry = { key: `${Date.now()}`, id: idea.id, placeId: place?.id ?? null, plannedAt: new Date().toISOString(), doneAt: null };
    entries.unshift(entry);
    diary.save(entries);
    return entry;
  },
  update(key, patch) {
    diary.save(diary.all().map((e) => (e.key === key ? { ...e, ...patch } : e)));
  },
  remove(key) {
    diary.save(diary.all().filter((e) => e.key !== key));
  },
};

export const savedPrefs = {
  get: () => read(PREFS_KEY, null),
  set: (p) => write(PREFS_KEY, p),
};

// Ideas planned or done in the last 45 days, so Theo doesn't keep repeating himself.
export function recentIds(entries, days = 45) {
  const cutoff = Date.now() - days * 864e5;
  return new Set(entries.filter((e) => new Date(e.plannedAt).getTime() > cutoff).map((e) => e.id));
}

function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

// Consecutive weeks (Mon–Sun) with at least one date done. This week gets
// grace: an empty current week doesn't break a streak that ran to last week.
export function weekStreak(entries, now = new Date()) {
  const weeks = new Set(entries.filter((e) => e.doneAt).map((e) => mondayOf(new Date(e.doneAt))));
  const prev = (t) => {
    const d = new Date(t);
    d.setDate(d.getDate() - 7);
    return d.getTime();
  };
  let wk = mondayOf(now);
  if (!weeks.has(wk)) wk = prev(wk);
  let n = 0;
  while (weeks.has(wk)) {
    n++;
    wk = prev(wk);
  }
  return n;
}
