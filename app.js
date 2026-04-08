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
    center: [-20, 40], zoom: 2.5, pitch: 0, bearing: 0, projection: 'globe'
});

// Simple clean vehicle marker — like Google Maps blue dot/arrow
const vehicleEl = document.createElement('div');
vehicleEl.className = 'gmap-vehicle';
vehicleEl.innerHTML = '<div class="gmap-icon">✈️</div>';
const vehicleMarker = new mapboxgl.Marker({ element: vehicleEl, anchor: 'center', rotationAlignment: 'map' })
    .setLngLat([0, 0]).addTo(map);
vehicleEl.style.display = 'none';

map.on('style.load', () => {
    map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.setFog({ color: 'rgb(220,230,240)', 'high-color': 'rgb(180,200,230)', 'horizon-blend': 0.05, 'space-color': 'rgb(15,15,30)', 'star-intensity': 0.3 });

    // City markers
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

    // Route layers
    map.addSource('route-drawn', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'route-glow', type: 'line', source: 'route-drawn', paint: { 'line-color': '#c9a84c', 'line-width': 8, 'line-opacity': 0.2, 'line-blur': 6 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route-drawn', paint: { 'line-color': '#c9a84c', 'line-width': 3.5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

    setTimeout(runJourney, 1500);
});

// --- Build dense route ---
function lerp(a, b, t) { return a + (b - a) * t; }

function buildRoute() {
    const pts = [];
    const legStarts = [0];
    for (let i = 0; i < destinations.length - 1; i++) {
        const f = destinations[i], t = destinations[i + 1];
        const steps = i === 0 ? 300 : 200;
        for (let s = 0; s <= steps; s++) {
            const frac = s / steps;
            let lat = lerp(f.lat, t.lat, frac);
            let lng = lerp(f.lng, t.lng, frac);
            if (i === 0) lat += Math.sin(frac * Math.PI) * 8; // arc for flight
            pts.push([lng, lat]);
        }
        legStarts.push(pts.length - 1);
    }
    return { pts, legStarts };
}

function bearing(a, b) { return Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI; }

const progressBar = document.getElementById('progress-bar');
const currentLeg = document.getElementById('current-leg');
function showLeg(t) { currentLeg.textContent = t; currentLeg.classList.add('visible'); }
function hideLeg() { currentLeg.classList.remove('visible'); }

// --- Smooth animation using requestAnimationFrame ---
let animId = null;

function runJourney() {
    const { pts, legStarts } = buildRoute();
    const drawn = [];
    const total = pts.length;
    let idx = 0;
    let legIdx = 0;
    let lastTime = 0;

    // Speed: ms per point. Lower = faster
    const flightSpeed = 12;  // fast flight
    const trainSpeed = 22;   // smooth train

    vehicleEl.style.display = '';

    // Initial view
    map.flyTo({ center: [destinations[0].lng, destinations[0].lat], zoom: 4, pitch: 30, bearing: 30, duration: 2000, essential: true });

    function setIcon(emoji) {
        vehicleEl.querySelector('.gmap-icon').textContent = emoji;
    }

    function animate(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const isFlight = legIdx === 0;
        const speed = isFlight ? flightSpeed : trainSpeed;

        if (timestamp - lastTime < speed) {
            animId = requestAnimationFrame(animate);
            return;
        }
        lastTime = timestamp;

        if (idx >= total) {
            // Done
            vehicleEl.style.display = 'none';
            hideLeg();
            progressBar.style.width = '100%';
            const bounds = new mapboxgl.LngLatBounds();
            destinations.forEach(d => bounds.extend([d.lng, d.lat]));
            map.fitBounds(bounds, { padding: 60, pitch: 40, bearing: 0, duration: 3000 });
            return;
        }

        const pt = pts[idx];
        drawn.push(pt);

        // Update leg
        while (legIdx < legStarts.length - 1 && idx >= legStarts[legIdx + 1]) legIdx++;
        const from = destinations[legIdx], to = destinations[legIdx + 1];

        // Vehicle icon
        if (idx === 0 || idx === legStarts[legIdx]) {
            setIcon(isFlight ? '✈️' : '🚂');
            showLeg(isFlight ? `✈️ ${from.name} → ${to.name}` : `🚂 ${from.name} → ${to.name}`);
        }

        // Move vehicle smoothly
        vehicleMarker.setLngLat(pt);

        // Rotate toward next point
        if (idx < total - 1) {
            const deg = bearing(pt, pts[idx + 1]);
            vehicleEl.querySelector('.gmap-icon').style.transform = `rotate(${-deg}deg)`;
        }

        // Update route line every 3 frames
        if (idx % 3 === 0) {
            map.getSource('route-drawn').setData({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: drawn }
            });
        }

        // Camera: smooth follow every 3 frames
        if (idx % 3 === 0) {
            const lookAhead = Math.min(idx + 40, total - 1);
            const ahead = pts[lookAhead];
            const b = bearing(pt, ahead);
            const zoom = isFlight
                ? lerp(3, 5.5, idx / legStarts[1])
                : 10;
            map.easeTo({
                center: pt,
                zoom,
                pitch: isFlight ? 35 : 55,
                bearing: b * 0.35,
                duration: speed * 3,
                easing: t => t
            });
        }

        progressBar.style.width = `${(idx / total) * 100}%`;
        idx++;
        animId = requestAnimationFrame(animate);
    }

    setTimeout(() => {
        animId = requestAnimationFrame(animate);
    }, 2500);
}

// --- Controls ---
document.getElementById('replay-btn').addEventListener('click', () => {
    if (animId) cancelAnimationFrame(animId);
    map.getSource('route-drawn')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    progressBar.style.width = '0%';
    hideLeg();
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
