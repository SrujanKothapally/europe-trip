const destinations = [
    { name: "Austin", lat: 30.2672, lng: -97.7431, emoji: "✈️" },
    { name: "Venice", lat: 45.4408, lng: 12.3155, emoji: "🚣" },
    { name: "Lucerne", lat: 47.0502, lng: 8.3093, emoji: "🏔️" },
    { name: "Lauterbrunnen", lat: 46.5936, lng: 7.9091, emoji: "💧" },
    { name: "Paris", lat: 48.8566, lng: 2.3522, emoji: "🗼" },
    { name: "Bruges", lat: 51.2093, lng: 3.2247, emoji: "🏰" },
    { name: "Amsterdam", lat: 52.3676, lng: 4.9041, emoji: "🚲" }
];

// --- Map Setup (fit all destinations) ---
const map = L.map('map', {
    zoomControl: false,
    scrollWheelZoom: true,
    dragging: true,
    attributionControl: false
});

// Light/white map tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18
}).addTo(map);

// Fit map to show ALL destinations
const bounds = L.latLngBounds(destinations.map(d => [d.lat, d.lng]));
map.fitBounds(bounds, { padding: [40, 40] });

// --- Markers with city labels ---
const markers = destinations.map((d, i) => {
    const isFirst = i === 0;
    const isLast = i === destinations.length - 1;
    const label = isFirst ? 'Start' : isLast ? 'End' : `${i}`;

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

// --- Animated Route Line ---
const routeCoords = destinations.map(d => [d.lat, d.lng]);
const routeLine = L.polyline([], {
    color: '#c9a84c',
    weight: 3,
    opacity: 0.9,
    dashArray: '10 6'
}).addTo(map);

function interpolatePoints(start, end, steps) {
    const points = [];
    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        points.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
    }
    return points;
}

function animateRoute() {
    const allPoints = [];
    for (let i = 0; i < routeCoords.length - 1; i++) {
        const steps = i === 0 ? 40 : 15;
        allPoints.push(...interpolatePoints(routeCoords[i], routeCoords[i + 1], steps));
    }
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

// --- Scroll: highlight marker + fly to city ---
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

// --- Animate route when map becomes visible ---
const mapObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        animateRoute();
        mapObserver.disconnect();
    }
}, { threshold: 0.3 });
mapObserver.observe(document.getElementById('map'));

// --- Reset to full view when scrolling back to map ---
const mapSection = document.querySelector('.map-section');
const mapResetObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && entries[0].intersectionRatio > 0.8) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 1 });
        document.querySelectorAll('.city-marker').forEach(el => el.classList.remove('active'));
    }
}, { threshold: 0.8 });
mapResetObserver.observe(mapSection);
