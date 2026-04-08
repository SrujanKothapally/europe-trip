const destinations = [
    { name: "Austin", lat: 30.2672, lng: -97.7431, emoji: "✈️", color: "#4CAF50",
      activities: [] },
    { name: "Venice", lat: 45.4408, lng: 12.3155, emoji: "🚣", color: "#2196F3",
      activities: [
        { icon: "🚣", name: "Grand Canal", lat: 45.4370, lng: 12.3280 },
        { icon: "⛪", name: "St. Mark's", lat: 45.4345, lng: 12.3389 },
        { icon: "🎭", name: "Rialto", lat: 45.4380, lng: 12.3360 }
      ]},
    { name: "Lucerne", lat: 47.0502, lng: 8.3093, emoji: "🏔️", color: "#FF9800",
      activities: [
        { icon: "🌉", name: "Chapel Bridge", lat: 47.0515, lng: 8.3075 },
        { icon: "⛰️", name: "Mt. Pilatus", lat: 46.9790, lng: 8.2554 },
        { icon: "🏞️", name: "Lake Cruise", lat: 47.0450, lng: 8.3200 }
      ]},
    { name: "Lauterbrunnen", lat: 46.5936, lng: 7.9091, emoji: "💧", color: "#00BCD4",
      activities: [
        { icon: "💧", name: "Staubbach Falls", lat: 46.5960, lng: 7.9070 },
        { icon: "🚠", name: "Schilthorn", lat: 46.5587, lng: 7.8350 },
        { icon: "🚂", name: "Jungfraujoch", lat: 46.5472, lng: 7.9853 }
      ]},
    { name: "Paris", lat: 48.8566, lng: 2.3522, emoji: "🗼", color: "#E91E63",
      activities: [
        { icon: "🗼", name: "Eiffel Tower", lat: 48.8584, lng: 2.2945 },
        { icon: "🎨", name: "Louvre", lat: 48.8606, lng: 2.3376 },
        { icon: "⛪", name: "Sacré-Cœur", lat: 48.8867, lng: 2.3431 }
      ]},
    { name: "Bruges", lat: 51.2093, lng: 3.2247, emoji: "🏰", color: "#9C27B0",
      activities: [
        { icon: "🏰", name: "Belfry", lat: 51.2081, lng: 3.2248 },
        { icon: "🚤", name: "Canal Cruise", lat: 51.2070, lng: 3.2270 },
        { icon: "🍫", name: "Chocolate Tour", lat: 51.2100, lng: 3.2230 }
      ]},
    { name: "Amsterdam", lat: 52.3676, lng: 4.9041, emoji: "🚲", color: "#FF5722",
      activities: [
        { icon: "🎨", name: "Van Gogh", lat: 52.3584, lng: 4.8811 },
        { icon: "🏠", name: "Anne Frank", lat: 52.3752, lng: 4.8840 },
        { icon: "🌷", name: "Vondelpark", lat: 52.3580, lng: 4.8686 }
      ]}
];

// --- Map ---
const map = L.map('map', { zoomControl: false, scrollWheelZoom: true, dragging: true, attributionControl: false });

// Warm illustrated-style map
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

const fullBounds = L.latLngBounds(destinations.map(d => [d.lat, d.lng]));
map.fitBounds(fullBounds, { padding: [50, 50] });

// --- City Markers (colored dots with emoji) ---
const cityMarkers = destinations.map((d, i) => {
    const m = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
            className: 'city-marker',
            html: `<div class="marker-dot" style="background:${d.color}">${d.emoji}</div><div class="marker-name">${d.name}</div>`,
            iconSize: [80, 60], iconAnchor: [40, 55]
        }),
        zIndexOffset: 1000
    }).addTo(map);
    m.on('click', () => {
        highlightMarker(i);
        document.querySelector(`.destination[data-index="${i}"]`)?.scrollIntoView({ behavior: 'smooth' });
    });
    return m;
});

// --- Activity markers (smaller, shown on zoom) ---
const activityMarkers = [];
destinations.forEach(d => {
    d.activities.forEach(a => {
        const m = L.marker([a.lat, a.lng], {
            icon: L.divIcon({
                className: 'activity-marker',
                html: `<div class="activity-icon">${a.icon}</div><div class="activity-name">${a.name}</div>`,
                iconSize: [60, 40], iconAnchor: [30, 35]
            }),
            zIndexOffset: 500
        });
        activityMarkers.push(m);
    });
});
const activityGroup = L.layerGroup(activityMarkers);
// Show activities only when zoomed in
map.on('zoomend', () => {
    if (map.getZoom() >= 10) activityGroup.addTo(map);
    else map.removeLayer(activityGroup);
});

// --- Bezier curve between two points ---
function bezierCurve(start, end, steps, curvature) {
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;
    const dx = end[1] - start[1];
    const dy = end[0] - start[0];
    const cp = [midLat + dx * curvature, midLng - dy * curvature];
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lat = (1-t)*(1-t)*start[0] + 2*(1-t)*t*cp[0] + t*t*end[0];
        const lng = (1-t)*(1-t)*start[1] + 2*(1-t)*t*cp[1] + t*t*end[1];
        pts.push([lat, lng]);
    }
    return pts;
}

function arcPath(start, end, steps, height) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lat = start[0] + (end[0] - start[0]) * t + Math.sin(t * Math.PI) * height;
        const lng = start[1] + (end[1] - start[1]) * t;
        pts.push([lat, lng]);
    }
    return pts;
}

// --- Build all route segments ---
const legs = [];
// Flight: Austin → Venice (big arc)
legs.push({
    from: destinations[0], to: destinations[1],
    points: arcPath([destinations[0].lat, destinations[0].lng], [destinations[1].lat, destinations[1].lng], 80, 8),
    color: destinations[0].color, type: 'flight', label: '✈️ Austin → Venice'
});
// Train legs with curves
const curvatures = [0.15, -0.1, 0.12, -0.08, 0.1];
for (let i = 1; i < destinations.length - 1; i++) {
    legs.push({
        from: destinations[i], to: destinations[i + 1],
        points: bezierCurve(
            [destinations[i].lat, destinations[i].lng],
            [destinations[i + 1].lat, destinations[i + 1].lng],
            40, curvatures[i - 1] || 0.1
        ),
        color: destinations[i + 1].color, type: 'train',
        label: `🚂 ${destinations[i].name} → ${destinations[i + 1].name}`
    });
}

// --- Route lines (one per leg, drawn during animation) ---
const legLines = legs.map(leg => {
    return L.polyline([], {
        color: leg.color, weight: leg.type === 'flight' ? 3 : 5,
        opacity: 0.8, dashArray: leg.type === 'flight' ? '10 8' : null,
        lineCap: 'round', lineJoin: 'round'
    }).addTo(map);
});

// --- Day labels on map ---
const dayLabels = [];
function addDayLabel(leg, idx) {
    const mid = leg.points[Math.floor(leg.points.length / 2)];
    const label = L.marker(mid, {
        icon: L.divIcon({
            className: '',
            html: `<div class="day-label" style="border-color:${leg.color};color:${leg.color}">${leg.type === 'flight' ? '✈️' : '🚂'} Leg ${idx + 1}</div>`,
            iconSize: [100, 24], iconAnchor: [50, 12]
        }),
        zIndexOffset: 800
    }).addTo(map);
    dayLabels.push(label);
    return label;
}

// --- Vehicle ---
const planeHtml = `<div class="plane-vehicle"><div class="plane-body">✈️</div><div class="plane-trail"></div></div>`;
const trainHtml = `<div class="train-vehicle"><div class="smoke-stack"><div class="smoke s1"></div><div class="smoke s2"></div><div class="smoke s3"></div></div><div class="train-body">🚂</div><div class="wheels"><div class="wheel"></div><div class="wheel"></div></div></div>`;

const vehicle = L.marker([destinations[0].lat, destinations[0].lng], {
    icon: L.divIcon({ className: 'vehicle-icon', html: planeHtml, iconSize: [60, 60], iconAnchor: [30, 30] }),
    zIndexOffset: 3000
}).addTo(map);

function setVehicle(type) {
    vehicle.setIcon(L.divIcon({
        className: 'vehicle-icon',
        html: type === 'plane' ? planeHtml : trainHtml,
        iconSize: [60, 60], iconAnchor: [30, 30]
    }));
}

// --- UI elements ---
const progressBar = document.getElementById('progress-bar');
const currentLeg = document.getElementById('current-leg');

function showLeg(text, color) {
    currentLeg.textContent = text;
    currentLeg.style.borderLeft = `4px solid ${color}`;
    currentLeg.classList.add('visible');
}
function hideLeg() { currentLeg.classList.remove('visible'); }

// --- Animation engine ---
function animateLeg(legIdx) {
    const leg = legs[legIdx];
    const line = legLines[legIdx];
    const totalLegs = legs.length;

    return new Promise(resolve => {
        let i = 0;
        function step() {
            if (i >= leg.points.length) {
                progressBar.style.width = `${((legIdx + 1) / totalLegs) * 100}%`;
                resolve();
                return;
            }
            vehicle.setLatLng(leg.points[i]);
            line.addLatLng(leg.points[i]);
            // Update progress
            const legProgress = i / leg.points.length;
            progressBar.style.width = `${((legIdx + legProgress) / totalLegs) * 100}%`;
            i++;
            setTimeout(step, leg.type === 'flight' ? 55 : 75);
        }
        step();
    });
}

async function runFullAnimation() {
    vehicle.setOpacity(1);
    progressBar.style.width = '0%';

    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];

        // Set vehicle type
        setVehicle(leg.type === 'flight' ? 'plane' : 'train');

        // Show leg label
        showLeg(leg.label, leg.color);

        // Zoom to show this leg
        const legBounds = L.latLngBounds(
            [leg.from.lat, leg.from.lng],
            [leg.to.lat, leg.to.lng]
        );
        map.flyToBounds(legBounds, { padding: [120, 120], duration: 1.8 });
        await new Promise(r => setTimeout(r, 2000));

        // Animate
        await animateLeg(i);

        // Add day label at midpoint
        addDayLabel(leg, i);

        // Pause at city
        await new Promise(r => setTimeout(r, 800));
    }

    // Done — zoom out
    hideLeg();
    await new Promise(r => setTimeout(r, 500));
    vehicle.setOpacity(0);
    map.flyToBounds(fullBounds, { padding: [50, 50], duration: 2 });
}

// --- Reset & replay ---
function resetAnimation() {
    legLines.forEach(l => l.setLatLngs([]));
    dayLabels.forEach(l => map.removeLayer(l));
    dayLabels.length = 0;
    vehicle.setLatLng([destinations[0].lat, destinations[0].lng]);
    vehicle.setOpacity(1);
    progressBar.style.width = '0%';
    hideLeg();
}

document.getElementById('replay-btn').addEventListener('click', () => {
    resetAnimation();
    map.flyToBounds(fullBounds, { padding: [50, 50], duration: 1 });
    setTimeout(runFullAnimation, 1200);
});

document.getElementById('fullview-btn').addEventListener('click', () => {
    map.flyToBounds(fullBounds, { padding: [50, 50], duration: 1.5 });
});

// --- Auto-start ---
const mapObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { setTimeout(runFullAnimation, 600); mapObserver.disconnect(); }
}, { threshold: 0.3 });
mapObserver.observe(document.getElementById('map'));

// --- Scroll interactions ---
function highlightMarker(idx) {
    document.querySelectorAll('.city-marker').forEach((el, i) => el.classList.toggle('active', i === idx));
    map.flyTo([destinations[idx].lat, destinations[idx].lng], idx === 0 ? 5 : 12, { duration: 1.2 });
}

const scrollObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            const i = parseInt(e.target.dataset.index);
            if (!isNaN(i)) highlightMarker(i);
        }
    });
}, { threshold: 0.3 });
document.querySelectorAll('.destination').forEach(el => scrollObs.observe(el));

const mapResetObs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && entries[0].intersectionRatio > 0.8) {
        map.flyToBounds(fullBounds, { padding: [50, 50], duration: 1 });
        document.querySelectorAll('.city-marker').forEach(el => el.classList.remove('active'));
    }
}, { threshold: 0.8 });
mapResetObs.observe(document.querySelector('.map-section'));
