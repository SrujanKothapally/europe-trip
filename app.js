const destinations = [
    { name: "Austin", lat: 30.2672, lng: -97.7431 },
    { name: "Venice", lat: 45.4408, lng: 12.3155 },
    { name: "Lucerne", lat: 47.0502, lng: 8.3093 },
    { name: "Lauterbrunnen", lat: 46.5936, lng: 7.9091 },
    { name: "Paris", lat: 48.8566, lng: 2.3522 },
    { name: "Bruges", lat: 51.2093, lng: 3.2247 },
    { name: "Amsterdam", lat: 52.3676, lng: 4.9041 }
];

// --- Map Setup ---
// Start zoomed out to show Austin + Europe, then zoom to Europe
const map = L.map('map', {
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: true,
    attributionControl: false
}).setView([40, -20], 3);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18
}).addTo(map);

// --- Markers ---
const markers = destinations.map((d) => {
    return L.marker([d.lat, d.lng], {
        icon: L.divIcon({ className: 'custom-marker', iconSize: [16, 16] })
    }).addTo(map).bindPopup(`<b>${d.name}</b>`);
});

// --- Animated Route ---
const routeCoords = destinations.map(d => [d.lat, d.lng]);
const routeLine = L.polyline([], { color: '#c9a84c', weight: 3, opacity: 0.8, dashArray: '8 12' }).addTo(map);

// For the transatlantic leg (Austin→Venice), draw a curved great-circle-ish path
function interpolatePoints(start, end, steps) {
    const points = [];
    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        points.push([
            start[0] + (end[0] - start[0]) * t,
            start[1] + (end[1] - start[1]) * t
        ]);
    }
    return points;
}

function buildFullRoute() {
    const allPoints = [];
    for (let i = 0; i < routeCoords.length - 1; i++) {
        // More points for the long Austin→Venice leg
        const steps = i === 0 ? 40 : 15;
        const seg = interpolatePoints(routeCoords[i], routeCoords[i + 1], steps);
        allPoints.push(...seg);
    }
    return allPoints;
}

function animateRoute() {
    const allPoints = buildFullRoute();
    let step = 0;
    function draw() {
        if (step < allPoints.length) {
            routeLine.addLatLng(allPoints[step]);
            step++;
            requestAnimationFrame(draw);
        }
    }
    draw();
}

// --- Scroll Animations ---
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

function highlightMarker(activeIdx) {
    markers.forEach((m, i) => {
        const el = m.getElement();
        if (el) el.classList.toggle('active', i === activeIdx);
    });
    const d = destinations[activeIdx];
    // Zoom level: wide for Austin, closer for Europe stops
    const zoom = activeIdx === 0 ? 5 : 8;
    map.flyTo([d.lat, d.lng], zoom, { duration: 1.2 });
}

// --- Start route animation when map is visible ---
const mapObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        animateRoute();
        mapObserver.disconnect();
    }
}, { threshold: 0.3 });
mapObserver.observe(document.getElementById('map'));
