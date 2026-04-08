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
    zoomControl: false,
    scrollWheelZoom: true,
    dragging: true,
    attributionControl: false
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18
}).addTo(map);

const fullBounds = L.latLngBounds(destinations.map(d => [d.lat, d.lng]));
map.fitBounds(fullBounds, { padding: [50, 50] });

// --- City Markers ---
const markers = destinations.map((d, i) => {
    const marker = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
            className: 'city-marker',
            html: `<div class="marker-pin">${d.emoji}</div><div class="marker-label">${d.name}</div>`,
            iconSize: [80, 50],
            iconAnchor: [40, 45]
        })
    }).addTo(map);
    marker.on('click', () => {
        highlightMarker(i);
        const el = document.querySelector(`.destination[data-index="${i}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
    return marker;
});

// --- Helpers ---
function lerp(a, b, t) { return a + (b - a) * t; }

function interpolate(start, end, steps) {
    const pts = [];
    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        pts.push([lerp(start[0], end[0], t), lerp(start[1], end[1], t)]);
    }
    return pts;
}

function buildArc(start, end, steps, arcHeight) {
    const pts = [];
    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        pts.push([lerp(start[0], end[0], t) + Math.sin(t * Math.PI) * arcHeight, lerp(start[1], end[1], t)]);
    }
    return pts;
}

// --- Route data ---
const flightPath = buildArc(
    [destinations[0].lat, destinations[0].lng],
    [destinations[1].lat, destinations[1].lng],
    60, 8
);

const trainLegs = [];
for (let i = 1; i < destinations.length - 1; i++) {
    trainLegs.push({
        from: destinations[i],
        to: destinations[i + 1],
        points: interpolate(
            [destinations[i].lat, destinations[i].lng],
            [destinations[i + 1].lat, destinations[i + 1].lng],
            30
        )
    });
}

// --- Route lines ---
const flightLine = L.polyline([], { color: '#c9a84c', weight: 2.5, opacity: 0.6, dashArray: '8 8' }).addTo(map);

// Train track: thick gray base + thinner dashed white on top = track look
const trackBase = L.polyline([], { color: '#666', weight: 5, opacity: 0.5 }).addTo(map);
const trackTies = L.polyline([], { color: '#fff', weight: 5, opacity: 0.7, dashArray: '2 8' }).addTo(map);
const trackRail = L.polyline([], { color: '#c9a84c', weight: 2, opacity: 0.9 }).addTo(map);

// --- Vehicle ---
const vehicleMarker = L.marker([destinations[0].lat, destinations[0].lng], {
    icon: L.divIcon({
        className: 'vehicle-icon',
        html: '<div class="vehicle">✈️</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    }),
    zIndexOffset: 2000
}).addTo(map);

function setVehicleEmoji(emoji) {
    const el = vehicleMarker.getElement();
    if (el) el.querySelector('.vehicle').textContent = emoji;
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

function addTrackPoints(points) {
    points.forEach(p => {
        trackBase.addLatLng(p);
        trackTies.addLatLng(p);
        trackRail.addLatLng(p);
    });
}

function animateTrainLeg(leg, speed) {
    return new Promise(resolve => {
        let i = 0;
        function step() {
            if (i >= leg.points.length) { resolve(); return; }
            const pt = leg.points[i];
            vehicleMarker.setLatLng(pt);
            trackBase.addLatLng(pt);
            trackTies.addLatLng(pt);
            trackRail.addLatLng(pt);
            i++;
            setTimeout(step, speed);
        }
        step();
    });
}

async function runFullAnimation() {
    // Phase 1: Flight — zoom out to show full Atlantic crossing
    setVehicleEmoji('✈️');
    map.flyToBounds(L.latLngBounds(
        [destinations[0].lat, destinations[0].lng],
        [destinations[1].lat, destinations[1].lng]
    ), { padding: [80, 80], duration: 1.5 });
    await new Promise(r => setTimeout(r, 1800));
    await animatePath(flightPath, flightLine, 35);

    // Pause at Venice
    await new Promise(r => setTimeout(r, 600));

    // Phase 2: Train through Europe — zoom into each leg
    setVehicleEmoji('🚂');
    for (const leg of trainLegs) {
        // Zoom to show this leg (from → to)
        const legBounds = L.latLngBounds(
            [leg.from.lat, leg.from.lng],
            [leg.to.lat, leg.to.lng]
        );
        map.flyToBounds(legBounds, { padding: [100, 100], duration: 1.2 });
        await new Promise(r => setTimeout(r, 1400));

        await animateTrainLeg(leg, 50);

        // Pause at city
        await new Promise(r => setTimeout(r, 500));
    }

    // Zoom back out to full route
    await new Promise(r => setTimeout(r, 800));
    vehicleMarker.setOpacity(0);
    map.flyToBounds(fullBounds, { padding: [50, 50], duration: 1.5 });
}

// --- Replay button ---
document.getElementById('replay-btn').addEventListener('click', () => {
    // Reset lines
    flightLine.setLatLngs([]);
    trackBase.setLatLngs([]);
    trackTies.setLatLngs([]);
    trackRail.setLatLngs([]);
    vehicleMarker.setLatLng([destinations[0].lat, destinations[0].lng]);
    vehicleMarker.setOpacity(1);
    map.flyToBounds(fullBounds, { padding: [50, 50], duration: 1 });
    setTimeout(runFullAnimation, 1200);
});

// --- Start on scroll ---
const mapObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        setTimeout(runFullAnimation, 600);
        mapObserver.disconnect();
    }
}, { threshold: 0.3 });
mapObserver.observe(document.getElementById('map'));

// --- Scroll: highlight markers ---
function highlightMarker(activeIdx) {
    document.querySelectorAll('.city-marker').forEach((el, i) => {
        el.classList.toggle('active', i === activeIdx);
    });
    const d = destinations[activeIdx];
    map.flyTo([d.lat, d.lng], activeIdx === 0 ? 5 : 9, { duration: 1.2 });
}

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            const idx = parseInt(entry.target.dataset.index);
            if (!isNaN(idx)) highlightMarker(idx);
        }
    });
}, { threshold: 0.3 });
document.querySelectorAll('.destination').forEach(el => observer.observe(el));

const mapSection = document.querySelector('.map-section');
const mapResetObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && entries[0].intersectionRatio > 0.8) {
        map.flyToBounds(fullBounds, { padding: [50, 50], duration: 1 });
        document.querySelectorAll('.city-marker').forEach(el => el.classList.remove('active'));
    }
}, { threshold: 0.8 });
mapResetObserver.observe(mapSection);
