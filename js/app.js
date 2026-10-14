import { IDEAS } from "./ideas.js?v=1";
import { VIBES, deal, TIME_LABEL, COST_LABEL, WHERE_LABEL } from "./picker.js?v=1";
import { THEO_SVG, theoLine } from "./theo.js?v=1";
import { diary, savedPrefs, recentIds, weekStreak } from "./store.js?v=1";

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

// ── Dealing ──────────────────────────────────────────────────────
const results = $("#results");
const deck = $("#deck");
let hand = [];
let seen = new Set();
let lastMode = "ask";

function cardFront(idea) {
  const vibes = idea.v.map((v) => VIBES.find((x) => x.id === v)?.label).filter(Boolean).slice(0, 2).join(" · ");
  return `
    <div class="front-top">
      <span class="pc-stamp" aria-hidden="true">${idea.e}</span>
      <span class="pc-mark">${esc(vibes)}</span>
    </div>
    <h3>${esc(idea.t)}</h3>
    <p class="pc-blurb">${esc(idea.b)}</p>
    <ul class="meta" aria-label="Details">
      <li>${idea.w === "in" ? "🏠" : "🚪"} ${WHERE_LABEL[idea.w]}</li>
      <li>⏱ ${SHORT_TIME[idea.time]}</li>
      <li>${idea.cost ? "💷 " + COST_LABEL[idea.cost] : "✨ Free"}</li>
    </ul>
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

function renderHand() {
  deck.classList.toggle("single", hand.length === 1);
  deck.innerHTML = hand
    .map((idea, i) => `
      <article class="card" style="--i:${i}" data-index="${i}">
        <div class="card-inner">
          <div class="face back" aria-hidden="true">${CARD_BACK}</div>
          <div class="face front" inert>${cardFront(idea)}</div>
        </div>
      </article>`)
    .join("");
  $$(".card", deck).forEach(async (card, i) => {
    await wait(650 + i * 380);
    flipUp(card);
  });
}

function flipUp(card) {
  card.classList.add("flipped");
  $(".front", card).inert = false;
}

async function run(mode) {
  lastMode = mode;
  const prefs = readPrefs();
  if (mode === "ask") savedPrefs.set({ vibes: prefs.vibes, where: prefs.where, cost: prefs.cost, whose: prefs.whose });
  const recent = recentIds(diary.all());

  say(theoLine("thinking"), "think");
  $("#ask").disabled = $("#surprise").disabled = true;
  await wait(900);

  let relaxed = false;
  if (mode === "surprise") {
    hand = deal(IDEAS, { vibes: [], where: "any", time: 3, cost: 2, whose: "both" }, { n: 1, recent }).picks;
  } else {
    ({ picks: hand, relaxed } = deal(IDEAS, prefs, { recent }));
  }
  seen = new Set(hand.map((i) => i.id));

  $("#resultsTitle").textContent = mode === "surprise" ? "Theo's wildcard" : "Theo's picks";
  $("#resultsNote").textContent = mode === "surprise" ? "No rules. Just this. Go on." : "Pick the one that makes you both grin.";
  results.hidden = false;
  renderHand();
  say(theoLine(relaxed ? "relaxed" : "done"), "happy");
  $("#ask").disabled = $("#surprise").disabled = false;
  results.scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "start" });
}

form.addEventListener("submit", (e) => { e.preventDefault(); run("ask"); });
$("#surprise").addEventListener("click", () => run("surprise"));
$("#again").addEventListener("click", () => run(lastMode));

deck.addEventListener("click", async (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const i = Number(card.dataset.index);
  if (e.target.closest("[data-choose]")) return choose(hand[i]);
  if (!e.target.closest("[data-swap]")) return;

  const prefs = lastMode === "surprise" ? { vibes: [], where: "any", time: 3, cost: 2, whose: "both" } : readPrefs();
  let [next] = deal(IDEAS, prefs, { n: 1, recent: recentIds(diary.all()), exclude: seen }).picks;
  if (!next) { seen = new Set(hand.map((x) => x.id)); [next] = deal(IDEAS, prefs, { n: 1, exclude: seen }).picks; }
  if (!next) return;
  seen.add(next.id);
  hand[i] = next;
  card.classList.remove("flipped");
  $(".front", card).inert = true;
  await wait(420);
  $(".front", card).innerHTML = cardFront(next);
  flipUp(card);
  $("[data-swap]", card).focus();
});

// ── It's a date! ─────────────────────────────────────────────────
const dlg = $("#dateDialog");
let openEntry = null;

function showIdea(idea, { fresh }) {
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

function choose(idea) {
  openEntry = diary.add(idea);
  renderDiary();
  showIdea(idea, { fresh: true });
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
            <span class="entry-date">${e.doneAt ? `Done ${fmt(e.doneAt)}` : `Picked ${fmt(e.plannedAt)}`}</span>
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
    if (entry) showIdea(byId.get(entry.id), { fresh: false });
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
