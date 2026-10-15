import { IDEAS } from "./ideas.js?v=4";
import { VIBES, deal, bends, ANYTHING, COST_LABEL, WHERE_LABEL, WHERE_EMOJI } from "./picker.js?v=4";
import { INTERESTS, PEOPLE, interestById, getInterests, setInterests, resetInterests } from "./interests.js?v=4";
import { THEO_SVG, theoLine } from "./theo.js?v=4";
import { diary, savedPrefs, recentIds, weekStreak } from "./store.js?v=4";
import { PLACES, travelLabel, mapsSearch, mapsDirections } from "./places.js?v=4";
import { initMap, showPicks, pickPlace, focusPlace } from "./map.js?v=4";
import { getLoc, getPlaces, getStatus, onChange, setLoc, resume, whenReady, searchPlaces, locate, recentLocs, HOME_LOC } from "./locale.js?v=4";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const byId = new Map(IDEAS.map((i) => [i.id, i]));
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, calm() ? 0 : ms));
const SHORT_TIME = { 1: "2 hrs", 2: "Evening", 3: "All day" };

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
    ? [`${day} morning, Tom & Cat.`, "A whole day's stretching out ahead of you. Let Theo fill it."]
    : ["Morning, Tom & Cat.", "Planning tonight already? Theo loves a plan almost as much as breakfast."];
  if (h < 17) return weekend
    ? [`${day} afternoon, Tom & Cat.`, "Plenty of day left. Tell Theo the vibe and go."]
    : [`${day} afternoon, Tom & Cat.`, "Get tonight sorted now, so there's nothing to decide later."];
  if (now.getDay() === 5) return ["It's Friday night, Tom & Cat.", "Week's done. Tell Theo the vibe and he'll deal you three ideas."];
  if (weekend) return [`${day} night, Tom & Cat.`, "Tell Theo the vibe, pick a postcard, then close the laptop and go and do it."];
  return [`${day} night, Tom & Cat.`, "School-night dates count double. Tell Theo the vibe."];
}
const [hello, lede] = greet();
$("#greeting").textContent = hello;
$("#lede").textContent = lede;

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
  };
}


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
  locNow.textContent = locLabel(loc);
  $("#mapWhere").textContent = loc.kind === "home" ? "home" : loc.name;
  locStatus.textContent = status === "loading"
    ? `Sniffing around ${loc.name}… The first visit can take up to a minute; after that it's instant.`
    : status === "error"
      ? "Couldn't load places just now. The ideas still work."
      : loc.kind === "home"
        ? "Using Theo's hand-picked spots near home."
        : `${getPlaces().length} real places nearby, live from OpenStreetMap.`;
  const recents = recentLocs().filter((r) => r.name !== loc.name);
  $("#locRecent").innerHTML = [
    loc.kind === "home" ? "" : `<button type="button" class="loc-chip" data-home>🏠 Home</button>`,
    ...recents.map((r) => `<button type="button" class="loc-chip" data-recent="${esc(r.name)}">📍 ${esc(r.name)}</button>`),
  ].join("");
}

$("#locRecent").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-home")) return setLoc(HOME_LOC);
  const r = recentLocs().find((x) => x.name === b.dataset.recent);
  if (r) setLoc({ ...r, kind: "search" });
});

function chooseLoc(l) {
  locResults.hidden = true;
  locResults.innerHTML = "";
  locInput.value = "";
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
$("#mapChange").addEventListener("click", () => {
  $("#whereAreWe").scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "center" });
  setTimeout(() => locInput.focus({ preventScroll: true }), calm() ? 0 : 400);
});

// ── Dealing ──────────────────────────────────────────────────────
// Each card in the hand is { idea, place }, where place is a real spot nearby (or null).
const results = $("#results");
const deck = $("#deck");
let hand = []; // [{ idea, bends, place }]
let seen = new Set();
let lastMode = "ask";
let lastPrefs = ANYTHING;
const prefsFor = (mode) => (mode === "surprise" ? ANYTHING : readPrefs());

function placeLine(place, idea) {
  if (!place) {
    return idea?.go && getStatus() === "loading"
      ? `<p class="pc-place pc-place-wait"><span aria-hidden="true">🐾</span><span>Theo's still sniffing out a spot nearby…</span></p>`
      : "";
  }
  return `
    <button type="button" class="pc-place" data-map="${place.id}">
      <span aria-hidden="true">📍</span>
      <span><b>${esc(place.n)}</b>${place.isNew ? ` <span class="new">New</span>` : ""}<small>${esc(place.osm ? place.b : place.town)} · ${travelLabel(place.ll, getLoc().ll)} · see on map</small></span>
    </button>`;
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
  const liked = who ? idea.i.filter((x) => ints[who].includes(x)) : idea.i.filter((x) => ints.tom.includes(x) && ints.cat.includes(x));
  if (liked.length) {
    const what = interestById(liked[0]).label.toLowerCase();
    bits.push(who ? `${PEOPLE[who]} loves ${what}` : `you both love ${what}`);
  }
  return bits.length ? `<p class="pc-why"><span aria-hidden="true">✓</span> ${esc(bits.join(" · "))}</p>` : "";
}

function cardFront({ idea, place, bends: bendList = [] }) {
  const vibes = idea.v.map((v) => VIBES.find((x) => x.id === v)?.label).filter(Boolean).slice(0, 2).join(" · ");
  return `
    <div class="front-top">
      <span class="pc-stamp" aria-hidden="true">${idea.e}</span>
      <span class="pc-mark">${esc(vibes)}</span>
    </div>
    <h3>${esc(idea.t)}</h3>
    <p class="pc-blurb">${esc(idea.b)}</p>
    ${placeLine(place, idea)}
    <ul class="meta" aria-label="Details">
      <li>${WHERE_EMOJI[idea.w]} ${WHERE_LABEL[idea.w]}</li>
      <li>⏱ ${SHORT_TIME[idea.time]}</li>
      <li>${idea.cost ? "💷 " + COST_LABEL[idea.cost] : "✨ Free"}</li>
    </ul>
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

function withPlaces(picks, prefs) {
  const avoid = new Set();
  return picks.map((card) => {
    const place = pickPlace(card.idea, { time: prefs.time, avoid });
    if (place) avoid.add(place.id);
    return { ...card, place };
  });
}

// Hungry + going somewhere should put a real place to eat on the table, as long
// as one fits everything else you picked.
const DINNER_TAGS = ["new", "pub", "romantic", "cheap", "world", "treat"];
function ensureDinner(picks, prefs) {
  if (!prefs.vibes.includes("food") || !["venue", "any"].includes(prefs.where)) return picks;
  if (picks.some((c) => !c.bends.length && c.idea.go?.some((g) => DINNER_TAGS.includes(g)))) return picks;
  const options = IDEAS.filter((i) => i.go?.some((g) => DINNER_TAGS.includes(g)) && !bends(i, prefs).length && !picks.some((c) => c.idea === i));
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

  const { picks, exact } = deal(IDEAS, prefs, { n: mode === "surprise" ? 1 : 3, recent, interests: getInterests() });
  hand = withPlaces(mode === "surprise" ? picks : ensureDinner(picks, prefs), prefs);
  seen = new Set(hand.map((c) => c.idea.id));
  const bent = hand.filter((c) => c.bends.length).length;

  $("#resultsTitle").textContent = mode === "surprise" ? "Theo's wildcard" : "Theo's picks";
  $("#resultsNote").textContent = mode === "surprise"
    ? "No rules. Just this. Go on."
    : !bent
      ? "Every one fits what you picked. Choose the one that makes you both grin."
      : exact
        ? `Only ${exact} idea${exact === 1 ? " fits" : "s fit"} everything you picked, so Theo added the closest near miss${bent > 1 ? "es" : ""} (marked).`
        : "Nothing fits all of that exactly, so these are the closest. Each says which rule it bends.";
  results.hidden = false;
  renderHand();
  say(theoLine(bent ? "relaxed" : "done"), "happy");
  $("#ask").disabled = $("#surprise").disabled = false;
  results.scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "start" });
}

function refreshHandPlaces() {
  if (!hand.length) return;
  hand = withPlaces(hand, lastPrefs);
  $$(".card", deck).forEach((card, i) => { $(".front", card).innerHTML = cardFront(hand[i]); });
  showPicks(hand);
}
onChange(() => { renderWhere(); refreshHandPlaces(); });

form.addEventListener("submit", (e) => { e.preventDefault(); run("ask"); });
$("#surprise").addEventListener("click", () => run("surprise"));
$("#again").addEventListener("click", () => run(lastMode));

deck.addEventListener("click", async (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const i = Number(card.dataset.index);
  const mapBtn = e.target.closest("[data-map]");
  if (mapBtn) return focusPlace(mapBtn.dataset.map);
  if (e.target.closest("[data-choose]")) return choose(hand[i]);
  if (!e.target.closest("[data-swap]")) return;

  const prefs = lastPrefs;
  const opts = { n: 1, recent: recentIds(diary.all()), interests: getInterests() };
  let [next] = deal(IDEAS, prefs, { ...opts, exclude: seen }).picks;
  if (!next) { seen = new Set(hand.map((c) => c.idea.id)); [next] = deal(IDEAS, prefs, { ...opts, exclude: seen }).picks; }
  if (!next) return;
  seen.add(next.idea.id);
  const others = new Set(hand.filter((_, j) => j !== i).map((c) => c.place?.id).filter(Boolean));
  hand[i] = { ...next, place: pickPlace(next.idea, { time: prefs.time, avoid: others }) };
  card.classList.remove("flipped");
  $(".front", card).inert = true;
  await wait(420);
  $(".front", card).innerHTML = cardFront(hand[i]);
  flipUp(card);
  showPicks(hand);
  $("[data-swap]", card).focus();
});

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

function showIdea(idea, place, { fresh }) {
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
      <p>${esc(idea.b)}</p>
      ${place ? `
      <div class="dlg-place">
        <p class="dlg-place-name"><span aria-hidden="true">📍</span> <b>${esc(place.n)}</b>${place.town ? `, ${esc(place.town)}` : ""}${fresh ? ` <small>${travelLabel(place.ll, getLoc().ll)}</small>` : ""}</p>
        <p>${esc(place.b)}</p>
        <p class="pop-links">
          <a href="${mapsDirections(place)}" target="_blank" rel="noopener">Directions ↗</a>
          <a href="${mapsSearch(place)}" target="_blank" rel="noopener">Hours &amp; booking ↗</a>
        </p>
      </div>` : ""}
      <h3>The plan</h3>
      <ol class="steps">${idea.s.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <div class="spark"><span>Ask each other</span><p>${esc(idea.q)}</p></div>
      <p class="rule">Theo's house rule: phones face down until you're home.</p>
      <div class="dlg-actions">
        <button class="btn btn-ask" value="go">${fresh ? "We're off! 🐾" : "Close"}</button>
        ${fresh ? `<button class="btn btn-ghost" value="undo">Actually, not this one</button>` : ""}
      </div>
    </form>`;
  dlg.showModal();
}

function choose({ idea, place }) {
  openEntry = diary.add(idea, place);
  renderDiary();
  showIdea(idea, place, { fresh: true });
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
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

// ── Diary ────────────────────────────────────────────────────────
const curated = new Map(PLACES.map((p) => [p.id, p]));
const entryPlace = (e) => e.place || curated.get(e.placeId) || null;
const fmt = (iso) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function renderDiary() {
  const entries = diary.all().filter((e) => byId.has(e.id));
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
        const idea = byId.get(e.id);
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
    if (entry) showIdea(byId.get(entry.id), entryPlace(entry), { fresh: false });
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
initMap($("#map"), $("#placeList"), $("#mapChips"), $("#mapStatus"));
renderWhere();
resume();

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
