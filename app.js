mapboxgl.accessToken = CONFIG.t;

const destinations = [
    { name: "Austin", lng: -97.7431, lat: 30.2672, emoji: "✈️", color: "#4CAF50" },
    { name: "Venice", lng: 12.3155, lat: 45.4408, emoji: "🚣", color: "#2196F3" },
    { name: "Lucerne", lng: 8.3093, lat: 47.0502, emoji: "🏔️", color: "#FF9800" },
    { name: "Lauterbrunnen", lng: 7.9091, lat: 46.5936, emoji: "💧", color: "#00BCD4" },
    { name: "Paris", lng: 2.3522, lat: 48.8566, emoji: "🗼", color: "#E91E63" },
    { name: "Bruges", lng: 3.2247, lat: 51.2093, emoji: "🏰", color: "#9C27B0" },
    { name: "Amsterdam", lng: 4.9041, lat: 52.3676, emoji: "🚲", color: "#FF5722" }
];

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-20, 40],
    zoom: 2.5,
    pitch: 0,
    bearing: 0,
    projection: 'globe'
});

// --- Vehicle elements ---
const trainEl = document.createElement('div');
trainEl.className = 'vehicle-3d train';
trainEl.innerHTML = `<div class="train-model">
    <div class="loco"><div class="loco-body"></div><div class="chimney"></div>
        <div class="smoke-puff p1"></div><div class="smoke-puff p2"></div><div class="smoke-puff p3"></div>
        <div class="cabin"></div><div class="loco-window"></div></div>
    <div class="wheel-set"><div class="rail-wheel rw1"></div><div class="rail-wheel rw2"></div><div class="rail-wheel rw3"></div></div>
    <div class="car car1"><div class="car-body"></div><div class="car-windows"></div><div class="car-wheel cw1"></div><div class="car-wheel cw2"></div></div>
</div>`;

const planeEl = document.createElement('div');
planeEl.className = 'vehicle-3d plane';
planeEl.innerHTML = `<div class="plane-model">
    <div class="fuselage"></div><div class="wing-l"></div><div class="wing-r"></div><div class="tail"></div><div class="contrail"></div>
</div>`;

const trainMarker = new mapboxgl.Marker({ element: trainEl, anchor: 'center' }).setLngLat([0,0]).addTo(map);
const planeMarker = new mapboxgl.Marker({ element: planeEl, anchor: 'center' }).setLngLat([0,0]).addTo(map);
trainEl.style.display = 'none';
planeEl.style.display = 'none';

map.on('style.load', () => {
    map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.setFog({ color: 'rgb(220,230,240)', 'high-color': 'rgb(180,200,230)', 'horizon-blend': 0.05, 'space-color': 'rgb(15,15,30)', 'star-intensity': 0.3 });

    destinations.forEach((d, i) => {
        const el = document.createElement('div');
        el.className = 'city-marker-3d';
        el.innerHTML = `<div class="marker-dot-3d" style="background:${d.color}">${d.emoji}</div><div class="marker-name-3d">${d.name}</div>`;
        el.addEventListener('click', () => {
            map.flyTo({ center: [d.lng, d.lat], zoom: 14, pitch: 60, duration: 2000 });
            document.querySelector(`.destination[data-index="${i}"]`)?.scrollIntoView({ behavior: 'smooth' });
        });
        new mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map);
    });

    map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'route-glow', type: 'line', source: 'route', paint: { 'line-color': '#c9a84c', 'line-width': 8, 'line-opacity': 0.25, 'line-blur': 6 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#c9a84c', 'line-width': 3.5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

    setTimeout(runJourney, 1500);
});

// --- Helpers ---
function lerp(a, b, t) { return a + (b - a) * t; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function angleDeg(a, b) { return Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI; }

// Build smooth route with many points
function buildRoute() {
    const allPts = [];
    const legIndices = [0]; // index where each leg starts
    for (let i = 0; i < destinations.length - 1; i++) {
        const from = destinations[i], to = destinations[i + 1];
        const steps = i === 0 ? 200 : 120; // more points = smoother
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            let lat = lerp(from.lat, to.lat, t);
            let lng = lerp(from.lng, to.lng, t);
            // Arc for flight
            if (i === 0) lat += Math.sin(t * Math.PI) * 8;
            allPts.push([lng, lat]);
        }
        legIndices.push(allPts.length - 1);
    }
    return { allPts, legIndices };
}

const progressBar = document.getElementById('progress-bar');
const currentLeg = document.getElementById('current-leg');
function showLeg(t) { currentLeg.textContent = t; currentLeg.classList.add('visible'); }
function hideLeg() { currentLeg.classList.remove('visible'); }

let animating = false;

async function runJourney() {
    if (animating) return;
    animating = true;

    const { allPts, legIndices } = buildRoute();
    const drawn = [];
    const total = allPts.length;

    // Initial zoom to show start
    map.flyTo({ center: [destinations[0].lng, destinations[0].lat], zoom: 4, pitch: 30, bearing: 30, duration: 2000, essential: true });
    await sleep(2500);

    let currentLegIdx = 0;
    const flightEnd = legIndices[1];

    for (let i = 0; i < total; i++) {
        const pt = allPts[i];
        drawn.push(pt);

        // Determine which leg we're on
        while (currentLegIdx < legIndices.length - 1 && i >= legIndices[currentLegIdx + 1]) currentLegIdx++;

        const isFlight = currentLegIdx === 0;
        const from = destinations[currentLegIdx];
        const to = destinations[currentLegIdx + 1];

        // Update leg label
        if (i === legIndices[currentLegIdx] || i === 0) {
            showLeg(isFlight ? `✈️ ${from.name} → ${to.name}` : `🚂 ${from.name} → ${to.name}`);
        }

        // Show/hide vehicles
        if (isFlight) {
            planeEl.style.display = '';
            trainEl.style.display = 'none';
            planeMarker.setLngLat(pt);
        } else {
            planeEl.style.display = 'none';
            trainEl.style.display = '';
            trainMarker.setLngLat(pt);
        }

        // Rotate vehicle
        if (i < total - 1) {
            const angle = angleDeg(pt, allPts[i + 1]);
            const model = isFlight ? planeEl.querySelector('.plane-model') : trainEl.querySelector('.train-model');
            model.style.transform = `rotate(${-angle}deg)`;
        }

        // Draw route
        if (i % 2 === 0 || i === total - 1) {
            map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: drawn } });
        }

        // Smooth camera follow — the key to "video" feel
        // Camera stays ahead of the vehicle, slowly adjusting
        if (i % 4 === 0) {
            const lookAhead = Math.min(i + 30, total - 1);
            const ahead = allPts[lookAhead];
            const bearing = angleDeg(pt, ahead);
            const zoom = isFlight ? lerp(3, 5, i / flightEnd) : 9;
            const pitch = isFlight ? 30 : 55;

            map.easeTo({
                center: pt,
                zoom,
                pitch,
                bearing: bearing * 0.4,
                duration: isFlight ? 140 : 260,
                easing: t => t // linear for smooth video feel
            });
        }

        progressBar.style.width = `${(i / total) * 100}%`;
        await sleep(isFlight ? 25 : 45);
    }

    // End: hide vehicles, zoom out
    planeEl.style.display = 'none';
    trainEl.style.display = 'none';
    hideLeg();
    progressBar.style.width = '100%';

    await sleep(500);
    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 40, bearing: 0, duration: 3000 });

    animating = false;
}

// --- Controls ---
document.getElementById('replay-btn').addEventListener('click', () => {
    map.getSource('route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    progressBar.style.width = '0%';
    hideLeg();
    animating = false;
    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 0, bearing: 0, duration: 1500 });
    setTimeout(runJourney, 2000);
});

document.getElementById('fullview-btn').addEventListener('click', () => {
    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 30, bearing: 0, duration: 2000 });
});

// --- Scroll ---
const scrollObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            const i = parseInt(e.target.dataset.index);
            if (!isNaN(i)) {
                const d = destinations[i];
                map.flyTo({ center: [d.lng, d.lat], zoom: i === 0 ? 6 : 14, pitch: 60, bearing: Math.random() * 40 - 20, duration: 2500 });
            }
        }
    });
}, { threshold: 0.3 });
document.querySelectorAll('.destination').forEach(el => scrollObs.observe(el));
