// The forecast where you are (Open-Meteo: free, no key), so outdoor ideas know
// whether to pack a coat, or wait for another day. Kept for an hour.
const TTL = 60 * 60 * 1000;
let cache = { key: "", at: 0, hours: [] };
let pending = null;

const WMO = (c) =>
  c === 0 ? ["☀️", "clear"] : c <= 2 ? ["🌤️", "mostly sunny"] : c === 3 ? ["☁️", "cloudy"] : c <= 48 ? ["🌫️", "foggy"]
    : c <= 57 ? ["🌦️", "drizzly"] : c <= 67 ? ["🌧️", "rainy"] : c <= 77 ? ["🌨️", "snowy"] : c <= 82 ? ["🌦️", "showery"] : ["⛈️", "stormy"];

export async function loadWeather(ll) {
  const key = `${ll[0].toFixed(2)},${ll[1].toFixed(2)}`;
  if (cache.key === key && Date.now() - cache.at < TTL) return cache.hours;
  if (pending?.key === key) return pending.p;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${ll[0]}&longitude=${ll[1]}&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&timeformat=unixtime&forecast_days=3`;
  const p = fetch(url)
    .then((r) => r.json())
    .then((d) => {
      const h = d.hourly || {};
      cache = {
        key, at: Date.now(),
        hours: (h.time || []).map((t, i) => ({ t: t * 1000, temp: h.temperature_2m[i], prob: h.precipitation_probability[i] ?? 0, mm: h.precipitation[i] ?? 0, code: h.weather_code[i], wind: h.wind_speed_10m[i] })),
      };
      return cache.hours;
    })
    .catch(() => cache.hours)
    .finally(() => { pending = null; });
  pending = { key, p };
  return p;
}

// The weather across a stretch of time (null if we don't know).
export function weatherWindow(from, to) {
  const a = from.getTime() - 30 * 60e3, b = to.getTime() + 30 * 60e3;
  const hrs = cache.hours.filter((h) => h.t >= a && h.t <= b);
  if (!hrs.length) return null;
  const wettest = hrs.reduce((m, h) => (h.prob > m.prob ? h : m), hrs[0]);
  const worst = Math.max(...hrs.map((h) => h.code));
  return {
    maxProb: wettest.prob,
    wetAt: wettest.prob >= 40 ? new Date(wettest.t) : null,
    mm: hrs.reduce((s, h) => s + h.mm, 0),
    temp: Math.round(hrs.reduce((s, h) => s + h.temp, 0) / hrs.length),
    wind: Math.round(Math.max(...hrs.map((h) => h.wind))),
    code: worst,
    storm: worst >= 95,
    wet: wettest.prob >= 70 && hrs.reduce((s, h) => s + h.mm, 0) >= 2,
  };
}

// "☀️ 13°C and dry" / "🌦️ 60% chance of showers around 3pm, pack a coat".
export function weatherLine(w, fmt) {
  if (!w) return "";
  const [icon, word] = WMO(w.code);
  const windy = w.wind >= 40 ? ", and blowy" : "";
  if (w.storm) return `⛈️ Thunderstorms forecast. Maybe not today.`;
  if (w.wet) return `🌧️ ${w.temp}°C and rain likely (${w.maxProb}%). Waterproofs, or save it for a drier day.`;
  if (w.maxProb >= 40) return `🌦️ ${w.temp}°C, ${w.maxProb}% chance of rain${w.wetAt ? ` around ${fmt(w.wetAt)}` : ""}. Pack a coat${windy}.`;
  return `${icon} ${w.temp}°C and ${w.maxProb >= 20 ? "probably dry" : "dry"}${word === "clear" || word === "mostly sunny" ? `, ${word}` : ""}${windy}.`;
}

export function hasWeather() { return cache.hours.length > 0; }
