const destinations = [
    { name: "Austin", lat: 30.2672, lng: -97.7431, emoji: "✈️" },
    { name: "Venice", lat: 45.4408, lng: 12.3155, emoji: "🚣" },
    { name: "Lucerne", lat: 47.0502, lng: 8.3093, emoji: "🏔️" },
    { name: "Lauterbrunnen", lat: 46.5936, lng: 7.9091, emoji: "💧" },
    { name: "Paris", lat: 48.8566, lng: 2.3522, emoji: "🗼" },
    { name: "Bruges", lat: 51.2093, lng: 3.2247, emoji: "🏰" },
    { name: "Amsterdam", lat: 52.3676, lng: 4.9041, emoji: "🚲" }
];

// --- Map ---
const map = L.map('map', {
    zoomControl: false,
    scrollWheelZoom: true,
    dragging: true,
    attributionControl: false
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18
}).addTo(map);

const bounds = L.latLngBounds(destinations.map(d => [d.lat, d.lng]));
map.fitBounds(bounds, { padding: [50, 50] });

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

// --- Interpolation helpers ---
function lerp(a, b, t) { return a + (b - a) * t; }

function interpolate(start, end, steps) {
    const pts = [];
    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        pts.push([lerp(start[0], end[0], t), lerp(start[1], end[1], t)]);
    }
    return pts;
}

function angleDeg(from, to) {
    return Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
}

// --- Build route segments ---
// Segment 0: Austin→Venice (flight, curved arc)
// Segments 1+: train through Europe
function buildArc(start, end, steps, arcHeight) {
    const pts = [];
    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const lat = lerp(start[0], end[0], t);
        const lng = lerp(start[1], end[1], t);
        const arc = Math.sin(t * Math.PI) * arcHeight;
        pts.push([lat + arc, lng]);
    }
    return pts;
}

const flightPath = buildArc(
    [destinations[0].lat, destinations[0].lng],
    [destinations[1].lat, destinations[1].lng],
    60, 8 // arc curves north over Atlantic
);

const trainSegments = [];
for (let i = 1; i < destinations.length - 1; i++) {
    trainSegments.push(interpolate(
        [destinations[i].lat, destinations[i].lng],
        [destinations[i + 1].lat, destinations[i + 1].lng],
        25
    ));
}

// --- Route lines (drawn progressively) ---
const flightLine = L.polyline([], { color: '#c9a84c', weight: 2.5, opacity: 0.6, dashArray: '8 8' }).addTo(map);
const trainLine = L.polyline([], { color: '#c9a84c', weight: 3, opacity: 0.8 }).addTo(map);

// --- Moving vehicle marker ---
const vehicleMarker = L.marker([destinations[0].lat, destinations[0].lng], {
    icon: L.divIcon({
        className: 'vehicle-icon',
        html: '<div class="vehicle">✈️</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    }),
    zIndexOffset: 2000
}).addTo(map);

function setVehicle(emoji, angle) {
    const el = vehicleMarker.getElement();
    if (el) {
        el.querySelector('.vehicle').textContent = emoji;
        el.querySelector('.vehicle').style.transform = `rotate(${angle}deg)`;
    }
}

// --- Animation engine ---
function animateAlongPath(points, line, emoji, speed, onDone) {
    let i = 0;
    function step() {
        if (i >= points.length) { if (onDone) onDone(); return; }
        const pt = points[i];
        vehicleMarker.setLatLng(pt);
        line.addLatLng(pt);
        if (i < points.length - 1) {
            const angle = angleDeg(pt, points[i + 1]);
            setVehicle(emoji, angle);
        }
        i++;
        setTimeout(step, speed);
    }
    step();
}

function runFullAnimation() {
    // Phase 1: Flight Austin → Venice
    setVehicle('✈️', 0);
    animateAlongPath(flightPath, flightLine, '✈️', 40, () => {
        // Phase 2: Train through Europe
        let segIdx = 0;
        function nextTrain() {
            if (segIdx >= trainSegments.length) {
                // Done — hide vehicle
                vehicleMarker.setOpacity(0);
                return;
            }
            setVehicle('🚂', 0);
            animateAlongPath(trainSegments[segIdx], trainLine, '🚂', 50, () => {
                segIdx++;
                // Brief pause at each city
                setTimeout(nextTrain, 400);
            });
        }
        setTimeout(nextTrain, 500);
    });
}

// --- Start animation when map is visible ---
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
    const zoom = activeIdx === 0 ? 5 : 9;
    map.flyTo([d.lat, d.lng], zoom, { duration: 1.2 });
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

// Reset to full view when scrolling back to map
const mapSection = document.querySelector('.map-section');
const mapResetObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && entries[0].intersectionRatio > 0.8) {
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1 });
        document.querySelectorAll('.city-marker').forEach(el => el.classList.remove('active'));
    }
}, { threshold: 0.8 });
mapResetObserver.observe(mapSection);
