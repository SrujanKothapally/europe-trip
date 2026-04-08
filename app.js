const destinations = [
    { name: "Austin", lat: 30.2672, lng: -97.7431, emoji: "✈️" },
    { name: "Venice", lat: 45.4408, lng: 12.3155, emoji: "🚣" },
    { name: "Lucerne", lat: 47.0502, lng: 8.3093, emoji: "🏔️" },
    { name: "Lauterbrunnen", lat: 46.5936, lng: 7.9091, emoji: "💧" },
    { name: "Paris", lat: 48.8566, lng: 2.3522, emoji: "🗼" },
    { name: "Bruges", lat: 51.2093, lng: 3.2247, emoji: "🏰" },
    { name: "Amsterdam", lat: 52.3676, lng: 4.9041, emoji: "🚲" }
];

const map = L.map('map', {
    zoomControl: false, scrollWheelZoom: true, dragging: true, attributionControl: false
});
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
const fullBounds = L.latLngBounds(destinations.map(d => [d.lat, d.lng]));
map.fitBounds(fullBounds, { padding: [50, 50] });

// --- City Markers ---
const markers = destinations.map((d, i) => {
    const m = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
            className: 'city-marker',
            html: `<div class="marker-pin">${d.emoji}</div><div class="marker-label">${d.name}</div>`,
            iconSize: [80, 50], iconAnchor: [40, 45]
        })
    }).addTo(map);
    m.on('click', () => {
        highlightMarker(i);
        document.querySelector(`.destination[data-index="${i}"]`)?.scrollIntoView({ behavior: 'smooth' });
    });
    return m;
});

// --- Helpers ---
function lerp(a, b, t) { return a + (b - a) * t; }
function interpolate(s, e, n) {
    const p = [];
    for (let i = 0; i <= n; i++) { const t = i / n; p.push([lerp(s[0], e[0], t), lerp(s[1], e[1], t)]); }
    return p;
}
function buildArc(s, e, n, h) {
    const p = [];
    for (let i = 0; i <= n; i++) { const t = i / n; p.push([lerp(s[0], e[0], t) + Math.sin(t * Math.PI) * h, lerp(s[1], e[1], t)]); }
    return p;
}

// --- Route data ---
const flightPath = buildArc([destinations[0].lat, destinations[0].lng], [destinations[1].lat, destinations[1].lng], 80, 8);
const trainLegs = [];
for (let i = 1; i < destinations.length - 1; i++) {
    trainLegs.push({
        from: destinations[i], to: destinations[i + 1],
        points: interpolate([destinations[i].lat, destinations[i].lng], [destinations[i + 1].lat, destinations[i + 1].lng], 40)
    });
}

// --- Lines ---
const flightLine = L.polyline([], { color: '#c9a84c', weight: 2.5, opacity: 0.6, dashArray: '8 8' }).addTo(map);
const trackBase = L.polyline([], { color: '#666', weight: 5, opacity: 0.5 }).addTo(map);
const trackTies = L.polyline([], { color: '#fff', weight: 5, opacity: 0.7, dashArray: '2 8' }).addTo(map);
const trackRail = L.polyline([], { color: '#c9a84c', weight: 2, opacity: 0.9 }).addTo(map);

// --- Vehicle marker (switches between plane and train HTML) ---
const planeHtml = `<div class="plane-vehicle">
    <div class="plane-body">✈️</div>
    <div class="plane-trail"></div>
</div>`;

const trainHtml = `<div class="train-vehicle">
    <div class="smoke-stack">
        <div class="smoke s1"></div>
        <div class="smoke s2"></div>
        <div class="smoke s3"></div>
    </div>
    <div class="train-body">🚂</div>
    <div class="wheels">
        <div class="wheel w1"></div>
        <div class="wheel w2"></div>
    </div>
</div>`;

const vehicleMarker = L.marker([destinations[0].lat, destinations[0].lng], {
    icon: L.divIcon({ className: 'vehicle-icon', html: planeHtml, iconSize: [60, 60], iconAnchor: [30, 30] }),
    zIndexOffset: 2000
}).addTo(map);

function setVehicle(type) {
    vehicleMarker.setIcon(L.divIcon({
        className: 'vehicle-icon',
        html: type === 'plane' ? planeHtml : trainHtml,
        iconSize: [60, 60], iconAnchor: [30, 30]
    }));
}

// --- Animation ---
function animatePath(points, line, speed) {
    return new Promise(resolve => {
        let i = 0;
        function step() {
            if (i >= points.length) { resolve(); return; }
            vehicleMarker.setLatLng(points[i]);
            line.addLatLng(points[i]);
            i++;
            setTimeout(step, speed);
        }
        step();
    });
}

function animateTrainLeg(leg, speed) {
    return new Promise(resolve => {
        let i = 0;
        function step() {
            if (i >= leg.points.length) { resolve(); return; }
            const pt = leg.points[i];
            vehicleMarker.setLatLng(pt);
            trackBase.addLatLng(pt); trackTies.addLatLng(pt); trackRail.addLatLng(pt);
            i++;
            setTimeout(step, speed);
        }
        step();
    });
}

async function runFullAnimation() {
    setVehicle('plane');
    vehicleMarker.setOpacity(1);

    // Flight: Austin → Venice
    map.flyToBounds(L.latLngBounds(
        [destinations[0].lat, destinations[0].lng],
        [destinations[1].lat, destinations[1].lng]
    ), { padding: [80, 80], duration: 2 });
    await new Promise(r => setTimeout(r, 2200));
    await animatePath(flightPath, flightLine, 60);
    await new Promise(r => setTimeout(r, 800));

    // Train through Europe
    setVehicle('train');
    for (const leg of trainLegs) {
        const legBounds = L.latLngBounds([leg.from.lat, leg.from.lng], [leg.to.lat, leg.to.lng]);
        map.flyToBounds(legBounds, { padding: [100, 100], duration: 1.5 });
        await new Promise(r => setTimeout(r, 1800));
        await animateTrainLeg(leg, 80);
        await new Promise(r => setTimeout(r, 700));
    }

    await new Promise(r => setTimeout(r, 1000));
    vehicleMarker.setOpacity(0);
    map.flyToBounds(fullBounds, { padding: [50, 50], duration: 2 });
}

// --- Replay ---
document.getElementById('replay-btn').addEventListener('click', () => {
    flightLine.setLatLngs([]);
    trackBase.setLatLngs([]); trackTies.setLatLngs([]); trackRail.setLatLngs([]);
    vehicleMarker.setLatLng([destinations[0].lat, destinations[0].lng]);
    vehicleMarker.setOpacity(1);
    map.flyToBounds(fullBounds, { padding: [50, 50], duration: 1 });
    setTimeout(runFullAnimation, 1200);
});

// --- Start ---
const mapObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { setTimeout(runFullAnimation, 600); mapObserver.disconnect(); }
}, { threshold: 0.3 });
mapObserver.observe(document.getElementById('map'));

// --- Scroll highlight ---
function highlightMarker(idx) {
    document.querySelectorAll('.city-marker').forEach((el, i) => el.classList.toggle('active', i === idx));
    map.flyTo([destinations[idx].lat, destinations[idx].lng], idx === 0 ? 5 : 9, { duration: 1.2 });
}
const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); const i = parseInt(e.target.dataset.index); if (!isNaN(i)) highlightMarker(i); } });
}, { threshold: 0.3 });
document.querySelectorAll('.destination').forEach(el => obs.observe(el));

const mapResetObs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && entries[0].intersectionRatio > 0.8) {
        map.flyToBounds(fullBounds, { padding: [50, 50], duration: 1 });
        document.querySelectorAll('.city-marker').forEach(el => el.classList.remove('active'));
    }
}, { threshold: 0.8 });
mapResetObs.observe(document.querySelector('.map-section'));
