// The map underneath Theo's patch: Google Maps when a Google key is connected (🔑
// Connections), otherwise Leaflet with OpenStreetMap tiles. Both draw the same HTML
// pins and popups, so map.js doesn't care which it's talking to.
//
//   view.layer()                          a group of things you can show/hide/clear
//   view.pin(ll, opts)                    an HTML pin; opts.popup makes it clickable
//   view.line(path, { title })            a walk's route (dashed)
//   view.dot(ll, { title })               a landmark on the way
//   view.fit(points, { padding, maxZoom })
//   view.setView(ll, zoom, animate) / view.getZoom()
//   view.onPopup(fn)                      fn({ place, el, setContent, isOpen }) on open
//
// Walks and most places come from OpenStreetMap whichever map you see, so it's
// credited either way.
import { getKeys } from "./keys.js?v=9";

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ROUTE = "#7a62b3";

// ── Google ───────────────────────────────────────────────────────
let googleReady = null;
function loadGoogle(key) {
  if (googleReady) return googleReady;
  googleReady = new Promise((resolve) => {
    const done = (ok) => { clearTimeout(timer); resolve(ok); };
    const timer = setTimeout(() => done(false), 10000);
    window.__theoGoogleMaps = () => done(true);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, v: "weekly", loading: "async", callback: "__theoGoogleMaps" })}`;
    s.async = true;
    s.onerror = () => done(false);
    document.head.append(s);
  });
  return googleReady;
}

// Muted night colours for dark mode (raster maps take a style list).
const NIGHT = [
  { elementType: "geometry", stylers: [{ color: "#2b2733" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b9b0c9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1f1c25" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#332e3d" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#2e3b30" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#403a4b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#575067" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#363042" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1b2433" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6f7f99" }] },
];

async function googleView(el, ll, zoom, popW) {
  const { Map, InfoWindow, Polyline, OverlayView } = await google.maps.importLibrary("maps");
  const { LatLng, LatLngBounds, Size } = await google.maps.importLibrary("core");
  const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
  const map = new Map(el, {
    center: { lat: ll[0], lng: ll[1] }, zoom,
    gestureHandling: "cooperative", clickableIcons: false,
    mapTypeControl: true, streetViewControl: true, fullscreenControl: true,
    styles: dark ? NIGHT : null,
  });
  const info = new InfoWindow({ maxWidth: popW });
  let openPin = null;
  const popupHooks = [];
  info.addListener("closeclick", () => { openPin = null; });

  // An HTML pin: the same markup and CSS as the Leaflet pins.
  class HtmlPin extends OverlayView {
    constructor(at, html, { title = "", z = 0, onClick = null } = {}) {
      super();
      this.pos = new LatLng(at[0], at[1]);
      this.div = document.createElement("div");
      this.div.className = `gpin${onClick ? " is-clickable" : ""}`;
      this.div.innerHTML = html;
      this.div.style.zIndex = String(100 + z);
      if (title) { this.div.title = title; this.div.setAttribute("aria-label", title); }
      if (onClick) {
        this.div.tabIndex = 0;
        this.div.setAttribute("role", "button");
        this.div.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
        this.div.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } });
      }
    }
    onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.div); }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(this.pos);
      if (p) { this.div.style.left = `${p.x}px`; this.div.style.top = `${p.y}px`; }
    }
    onRemove() { this.div.remove(); }
  }

  const showPopup = (pin, html, place, at, offset = -18) => {
    const box = document.createElement("div");
    box.innerHTML = typeof html === "function" ? html() : html;
    info.setContent(box);
    info.setOptions({ pixelOffset: new Size(0, offset), maxWidth: popW });
    info.setPosition(at);
    info.open({ map });
    openPin = pin;
    const handle = {
      place, el: () => box, isOpen: () => openPin === pin,
      setContent: (h) => { box.innerHTML = h; },
    };
    google.maps.event.addListenerOnce(info, "domready", () => popupHooks.forEach((fn) => fn(handle)));
  };

  const thing = (overlay, extra = {}) => ({
    show: () => overlay.setMap(map),
    hide: () => overlay.setMap(null),
    remove: () => overlay.setMap(null),
    ...extra,
  });

  return {
    kind: "google",
    layer() {
      const items = new Set();
      let visible = true;
      return {
        add(t) { items.add(t); if (visible) t.show(); return t; },
        clear() { items.forEach((t) => t.hide()); items.clear(); },
        setVisible(v) { visible = v; items.forEach((t) => (v ? t.show() : t.hide())); },
      };
    },
    pin(at, { html, title, z = 0, popup = null, place = null, offset = -16 }) {
      const pin = new HtmlPin(at, html, { title, z, onClick: popup ? () => api.openPopup() : null });
      const api = thing(pin, { openPopup: () => popup && showPopup(pin, popup, place, pin.pos, offset) });
      return api;
    },
    line(path, { title = "" } = {}) {
      const line = new Polyline({
        path: path.map(([a, b]) => ({ lat: a, lng: b })),
        strokeOpacity: 0,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeColor: ROUTE, strokeOpacity: 0.9, strokeWeight: 4, scale: 3 }, offset: "0", repeat: "14px" }],
      });
      if (title) line.addListener("click", (e) => showPopup(line, `<div class="pop"><h3>${title}</h3></div>`, null, e.latLng, 0));
      const bounds = new LatLngBounds();
      path.forEach(([a, b]) => bounds.extend({ lat: a, lng: b }));
      return thing(line, { bounds: () => path });
    },
    dot(at, { title = "" } = {}) {
      return thing(new HtmlPin(at, `<span class="map-dot"></span>`, { title, z: 2 }));
    },
    fit(points, { padding = 24, maxZoom = 14 } = {}) {
      if (!points.length) return;
      const b = new LatLngBounds();
      points.forEach(([a, c]) => b.extend({ lat: a, lng: c }));
      map.fitBounds(b, padding);
      google.maps.event.addListenerOnce(map, "idle", () => { if (map.getZoom() > maxZoom) map.setZoom(maxZoom); });
    },
    setView(at, z, animate = true) {
      if (animate) map.panTo({ lat: at[0], lng: at[1] }); else map.setCenter({ lat: at[0], lng: at[1] });
      map.setZoom(z);
    },
    getZoom: () => map.getZoom(),
    onPopup(fn) { popupHooks.push(fn); },
  };
}

// ── Leaflet + OpenStreetMap ──────────────────────────────────────
function leafletView(el, ll, zoom, popW) {
  const map = L.map(el, { scrollWheelZoom: false }).setView(ll, zoom);
  L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_CREDIT }).addTo(map);
  map.on("focus", () => map.scrollWheelZoom.enable());
  map.on("blur", () => map.scrollWheelZoom.disable());
  const popupHooks = [];
  map.on("popupopen", (e) => {
    const popup = e.popup;
    const handle = {
      place: popup._theoPlace || null,
      el: () => popup.getElement(),
      isOpen: () => popup.isOpen(),
      setContent: (h) => popup.setContent(h),
    };
    popupHooks.forEach((fn) => fn(handle));
  });
  const thing = (layer, extra = {}) => ({ layer, show: () => layer.addTo(map), hide: () => layer.remove(), remove: () => layer.remove(), ...extra });
  return {
    kind: "leaflet",
    layer() {
      const group = L.layerGroup().addTo(map);
      return {
        add(t) { t.layer.addTo(group); return t; },
        clear() { group.clearLayers(); },
        setVisible(v) { if (v) group.addTo(map); else map.removeLayer(group); },
      };
    },
    pin(at, { html, title, z = 0, popup = null, place = null, size = 32, interactive = !!popup }) {
      const m = L.marker(at, {
        icon: L.divIcon({ className: "", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2 + 2] }),
        title, alt: title, zIndexOffset: z * 100, riseOnHover: true, keyboard: interactive, interactive: interactive || !!title,
      });
      if (popup) {
        m.bindPopup(popup, { maxWidth: popW, autoPanPadding: [16, 16] });
        m.getPopup()._theoPlace = place;
      } else if (title) {
        m.bindTooltip(title.replace(/[<>&]/g, ""), { direction: "top", offset: [0, -16] });
      }
      return thing(m, { openPopup: () => m.openPopup() });
    },
    line(path, { title = "" } = {}) {
      const line = L.polyline(path, { color: ROUTE, weight: 5, opacity: 0.85, dashArray: "8 7", lineCap: "round" });
      if (title) line.bindTooltip(title, { sticky: true });
      return thing(line, { bounds: () => path });
    },
    dot(at, { title = "" } = {}) {
      const d = L.circleMarker(at, { radius: 7, color: "#27222f", weight: 2, fillColor: "#fffcf6", fillOpacity: 1 });
      if (title) d.bindTooltip(title, { direction: "top" });
      return thing(d);
    },
    fit(points, { padding = 24, maxZoom = 14 } = {}) {
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], maxZoom });
    },
    setView(at, z, animate = true) { map.setView(at, z, { animate }); },
    getZoom: () => map.getZoom(),
    onPopup(fn) { popupHooks.push(fn); },
  };
}

// Google if there's a key and it loads; OpenStreetMap otherwise (or if Google says no).
export async function createView(el, ll, zoom, popW, { onFallback } = {}) {
  const key = getKeys().g;
  if (key && (await loadGoogle(key)) && window.google?.maps?.importLibrary) {
    try {
      window.gm_authFailure = () => onFallback?.(); // a bad or over-quota key
      el.classList.add("is-google");
      return await googleView(el, ll, zoom, popW);
    } catch { el.classList.remove("is-google"); el.innerHTML = ""; }
  }
  if (!window.L) return null;
  return leafletView(el, ll, zoom, popW);
}

// For the Google → OpenStreetMap fallback: start again with a clean element.
export function leafletOnly(el, ll, zoom, popW) {
  el.classList.remove("is-google");
  el.innerHTML = "";
  return window.L ? leafletView(el, ll, zoom, popW) : null;
}
