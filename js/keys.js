// API keys for the optional live data (Ticketmaster events, Google ratings).
// They live only in this browser, never in the public repo. A device can be set
// up from a link like …/theo/#connect=<base64 of {"tm":"…","g":"…"}>.

const KEY = "theo.keys.v1";

export function getKeys() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function setKeys(k) {
  const clean = {};
  for (const [name, v] of Object.entries(k)) {
    const s = String(v || "").replace(/[^\x21-\x7e]/g, ""); // pasted keys often carry stray spaces
    if (s) clean[name] = s;
  }
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* storage blocked */ }
  return clean;
}

export function setupLink() {
  const k = getKeys();
  const base = location.href.split("#")[0];
  return `${base}#connect=${btoa(JSON.stringify(k))}`;
}

// If the page was opened with a setup link, save the keys and tidy the address bar.
export function absorbSetupLink() {
  const m = location.hash.match(/^#connect=([A-Za-z0-9+/=]+)/);
  if (!m) return false;
  try {
    const k = JSON.parse(atob(m[1]));
    setKeys({ ...getKeys(), ...k });
  } catch { return false; }
  history.replaceState(null, "", location.pathname + location.search);
  return true;
}
