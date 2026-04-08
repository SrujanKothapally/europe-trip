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
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: [-20, 40],
    zoom: 2.5,
    pitch: 0,
    bearing: 0,
    projection: 'globe'
});

// --- Vehicle elements ---
const planeEl = document.createElement('div');
planeEl.className = 'vehicle-3d plane';
planeEl.innerHTML = `<div class="plane-model">
    <div class="fuselage"></div>
    <div class="wing-l"></div>
    <div class="wing-r"></div>
    <div class="tail"></div>
    <div class="contrail"></div>
</div>`;

const trainEl = document.createElement('div');
trainEl.className = 'vehicle-3d train';
trainEl.innerHTML = `<div class="train-model">
    <div class="loco">
        <div class="loco-body"></div>
        <div class="chimney"></div>
        <div class="smoke-puff p1"></div>
        <div class="smoke-puff p2"></div>
        <div class="smoke-puff p3"></div>
        <div class="cabin"></div>
        <div class="loco-window"></div>
    </div>
    <div class="wheel-set">
        <div class="rail-wheel rw1"></div>
        <div class="rail-wheel rw2"></div>
        <div class="rail-wheel rw3"></div>
    </div>
    <div class="car car1">
        <div class="car-body"></div>
        <div class="car-windows"></div>
        <div class="car-wheel cw1"></div>
        <div class="car-wheel cw2"></div>
    </div>
</div>`;

const planeMarker = new mapboxgl.Marker({ element: planeEl, anchor: 'center' }).setLngLat([0,0]).addTo(map);
const trainMarker = new mapboxgl.Marker({ element: trainEl, anchor: 'center' }).setLngLat([0,0]).addTo(map);
planeEl.style.display = 'none';
trainEl.style.display = 'none';

map.on('style.load', () => {
    map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.setFog({ color: 'rgb(186,210,235)', 'high-color': 'rgb(36,92,223)', 'horizon-blend': 0.02, 'space-color': 'rgb(11,11,25)', 'star-intensity': 0.6 });

    // City markers
    destinations.forEach((d, i) => {
        const el = document.createElement('div');
        el.className = 'city-marker-3d';
        el.innerHTML = `<div class="marker-dot-3d" style="background:${d.color}">${d.emoji}</div><div class="marker-name-3d">${d.name}</div>`;
        el.addEventListener('click', () => {
            flyToCity(i);
            document.querySelector(`.destination[data-index="${i}"]`)?.scrollIntoView({ behavior: 'smooth' });
        });
        new mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map);
    });

    // Route source
    map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'route-glow', type: 'line', source: 'route', paint: { 'line-color': '#fff', 'line-width': 6, 'line-opacity': 0.3, 'line-blur': 4 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#c9a84c', 'line-width': 3, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

    setTimeout(runCinematicJourney, 1500);
});

// --- Helpers ---
function lerp(a, b, t) { return a + (b - a) * t; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function interpolate(from, to, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) { const t = i / steps; pts.push([lerp(from[0], to[0], t), lerp(from[1], to[1], t)]); }
    return pts;
}

function angleBetween(a, b) {
    return Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI;
}

const progressBar = document.getElementById('progress-bar');
const currentLeg = document.getElementById('current-leg');
function showLeg(t) { currentLeg.textContent = t; currentLeg.classList.add('visible'); }
function hideLeg() { currentLeg.classList.remove('visible'); }

function flyToCity(idx) {
    const d = destinations[idx];
    map.flyTo({ center: [d.lng, d.lat], zoom: idx === 0 ? 6 : 14, pitch: idx === 0 ? 20 : 65, bearing: Math.random() * 50 - 25, duration: 3000, essential: true });
}

// --- Main animation ---
async function runCinematicJourney() {
    const drawnCoords = [];
    const totalLegs = destinations.length - 1;

    for (let i = 0; i < totalLegs; i++) {
        const from = destinations[i], to = destinations[i + 1];
        const isFlight = i === 0;
        const steps = isFlight ? 120 : 60;
        const pts = interpolate([from.lng, from.lat], [to.lng, to.lat], steps);
        const label = isFlight ? `✈️ ${from.name} → ${to.name}` : `🚂 ${from.name} → ${to.name}`;

        showLeg(label);

        // Show correct vehicle
        if (isFlight) { planeEl.style.display = ''; trainEl.style.display = 'none'; }
        else { planeEl.style.display = 'none'; trainEl.style.display = ''; }

        // Zoom to show the leg
        const midLng = (from.lng + to.lng) / 2, midLat = (from.lat + to.lat) / 2;
        const dist = Math.sqrt((to.lng - from.lng) ** 2 + (to.lat - from.lat) ** 2);
        const zoom = isFlight ? 3.5 : Math.max(7, 11 - dist * 1.2);
        const bearing = angleBetween([from.lng, from.lat], [to.lng, to.lat]);

        map.flyTo({ center: [midLng, midLat], zoom, pitch: isFlight ? 25 : 55, bearing: bearing * 0.4, duration: 2500, essential: true });
        await sleep(3000);

        // Animate vehicle along route
        for (let p = 0; p < pts.length; p++) {
            const pt = pts[p];
            drawnCoords.push(pt);

            // Move vehicle
            if (isFlight) planeMarker.setLngLat(pt);
            else trainMarker.setLngLat(pt);

            // Rotate vehicle toward next point
            if (p < pts.length - 1) {
                const angle = angleBetween(pt, pts[p + 1]);
                const vEl = isFlight ? planeEl.querySelector('.plane-model') : trainEl.querySelector('.train-model');
                vEl.style.transform = `rotate(${-angle}deg)`;
            }

            // Update route line
            if (p % 2 === 0 || p === pts.length - 1) {
                map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: drawnCoords } });
            }

            // Camera follows vehicle (subtle)
            if (!isFlight && p % 8 === 0) {
                map.easeTo({ center: pt, duration: 600, easing: t => t });
            }

            progressBar.style.width = `${((i + p / pts.length) / totalLegs) * 100}%`;
            await sleep(isFlight ? 35 : 65);
        }

        // Hide vehicle, fly into city
        planeEl.style.display = 'none';
        trainEl.style.display = 'none';

        map.flyTo({ center: [to.lng, to.lat], zoom: 15, pitch: 70, bearing: bearing * 0.5 + 15, duration: 3000, essential: true });
        await sleep(3500);

        // Orbit city
        map.easeTo({ bearing: map.getBearing() + 50, duration: 4000, easing: t => t });
        await sleep(4200);
    }

    hideLeg();
    progressBar.style.width = '100%';
    await sleep(500);

    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 35, bearing: 0, duration: 3000 });
}

// --- Controls ---
document.getElementById('replay-btn').addEventListener('click', () => {
    map.getSource('route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    progressBar.style.width = '0%';
    hideLeg();
    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 0, bearing: 0, duration: 1500 });
    setTimeout(runCinematicJourney, 2000);
});

document.getElementById('fullview-btn').addEventListener('click', () => {
    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 30, bearing: 0, duration: 2000 });
});

// --- Scroll ---
const scrollObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); const i = parseInt(e.target.dataset.index); if (!isNaN(i)) flyToCity(i); } });
}, { threshold: 0.3 });
document.querySelectorAll('.destination').forEach(el => scrollObs.observe(el));
