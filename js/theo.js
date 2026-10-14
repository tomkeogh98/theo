// Theo: a whimsical black cat with white-tipped paws and a white chin and chest.
// One SVG drawing, used for the header logo, the big "dealer" Theo and the favicon
// (img/theo.svg is a copy of this markup: keep them in sync).

export const THEO_SVG = `
<svg class="theo" viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Theo the cat">
  <ellipse cx="100" cy="221" rx="64" ry="6" fill="#000" opacity=".12"/>
  <path class="theo-tail" d="M136 204 C 172 206, 186 178, 176 152 C 170 136, 178 122, 190 128" fill="none" stroke="#17151b" stroke-width="13" stroke-linecap="round"/>
  <path d="M60 216 C 48 172, 60 128, 100 118 C 140 128, 152 172, 140 216 Z" fill="#17151b"/>
  <ellipse cx="66" cy="200" rx="19" ry="18" fill="#17151b"/>
  <ellipse cx="134" cy="200" rx="19" ry="18" fill="#17151b"/>
  <ellipse cx="57" cy="214" rx="12" ry="6.5" fill="#fbf8f2"/>
  <ellipse cx="143" cy="214" rx="12" ry="6.5" fill="#fbf8f2"/>
  <rect x="73" y="148" width="22" height="64" rx="11" fill="#17151b"/>
  <rect x="105" y="148" width="22" height="64" rx="11" fill="#17151b"/>
  <path d="M100 112 C 74 118, 72 156, 100 192 C 128 156, 126 118, 100 112 Z" fill="#fbf8f2"/>
  <ellipse cx="84" cy="211" rx="13.5" ry="8.5" fill="#fbf8f2"/>
  <ellipse cx="116" cy="211" rx="13.5" ry="8.5" fill="#fbf8f2"/>
  <path d="M80 207 v6 M88 207 v6 M112 207 v6 M120 207 v6" stroke="#cfc8d6" stroke-width="1.6" stroke-linecap="round"/>
  <g class="theo-head">
    <path class="theo-ear-l" d="M55 64 Q 50 22 61 12 Q 72 15 95 40 Z" fill="#17151b"/>
    <path d="M62 54 Q 60 31 65 23 Q 74 29 86 42 Z" fill="#c9b8ea"/>
    <path class="theo-ear-r" d="M145 64 Q 150 22 139 12 Q 128 15 105 40 Z" fill="#17151b"/>
    <path d="M138 54 Q 140 31 135 23 Q 126 29 114 42 Z" fill="#c9b8ea"/>
    <ellipse cx="100" cy="76" rx="51" ry="45" fill="#17151b"/>
    <ellipse cx="100" cy="111" rx="20" ry="11.5" fill="#fbf8f2"/>
    <circle cx="65" cy="93" r="7.5" fill="#c9b8ea" opacity=".55"/>
    <circle cx="135" cy="93" r="7.5" fill="#c9b8ea" opacity=".55"/>
    <g class="theo-eyes">
      <circle cx="79" cy="73" r="13.5" fill="#e6d95c"/>
      <circle cx="121" cy="73" r="13.5" fill="#e6d95c"/>
      <ellipse class="theo-pupil" cx="80" cy="74" rx="5.5" ry="10" fill="#0d0c10"/>
      <ellipse class="theo-pupil" cx="122" cy="74" rx="5.5" ry="10" fill="#0d0c10"/>
      <circle cx="84" cy="68" r="3.4" fill="#fff"/>
      <circle cx="126" cy="68" r="3.4" fill="#fff"/>
      <circle cx="77" cy="80" r="1.6" fill="#fff"/>
      <circle cx="119" cy="80" r="1.6" fill="#fff"/>
    </g>
    <path d="M94.5 92 Q 100 90 105.5 92 Q 103 97.5 100 98.5 Q 97 97.5 94.5 92 Z" fill="#e8a2b6"/>
    <path d="M100 98.5 Q 100.5 104 94 104.5 M100 98.5 Q 99.5 104 106 104.5" stroke="#9a93a6" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M70 95 L 38 88 M70 100 L 40 104 M130 95 L 162 88 M130 100 L 160 104" stroke="#d9d3e2" stroke-width="1.7" stroke-linecap="round"/>
  </g>
  <path d="M72 120 Q 100 134 128 120" stroke="#8b74c4" stroke-width="7" fill="none" stroke-linecap="round"/>
  <circle cx="100" cy="132" r="6.5" fill="#e3b445"/>
  <path d="M100 136 l -3 -3 a 1.8 1.8 0 0 1 3 -2 a 1.8 1.8 0 0 1 3 2 Z" fill="#a8761a"/>
</svg>`;

const LINES = {
  idle: [
    "Mrrp. Tell me the vibe.",
    "Tom + Cat = TomCat. I'm the cat bit.",
    "I've hidden three good ideas under the sofa.",
    "Quality time beats screen time. Says the cat sat on the keyboard.",
    "Pick some moods. I'll do the rest.",
    "Feed me first, then date night.",
  ],
  thinking: [
    "Hmm… consulting my whiskers…",
    "Batting ideas off the table…",
    "Checking under the sofa…",
    "Thinking very hard (it looks like napping)…",
  ],
  done: [
    "Three postcards, fresh from under the sofa.",
    "Pick one. Go. I'll guard the house.",
    "Here you go. Now get off the internet.",
    "These are good. I'd do them, if I had thumbs.",
  ],
  relaxed: [
    "Slim pickings, so I bent your rules a little.",
    "I had to stretch your rules (I'm good at stretching).",
  ],
  pet: [
    "Purrrrrrr.",
    "Okay, one more chin scratch.",
    "Mrrrow. (That means 'go on your date'.)",
    "I am a very good boy.",
    "💜",
  ],
  chosen: [
    "Excellent choice. I'll be asleep when you get back.",
    "Go on then. Have fun. Bring me ham.",
    "Proud of you two. Now shoo.",
  ],
};

let last = "";
export function theoLine(kind) {
  const pool = LINES[kind].filter((l) => l !== last);
  last = pool[Math.floor(Math.random() * pool.length)];
  return last;
}
