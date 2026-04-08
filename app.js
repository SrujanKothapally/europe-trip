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

// Vehicle — simple clean icon
const vehicleEl = document.createElement('div');
vehicleEl.className = 'gmap-vehicle';
vehicleEl.innerHTML = '<div class="gmap-icon">✈️</div>';
const vehicleMarker = new mapboxgl.Marker({ element: vehicleEl, anchor: 'center' })
    .setLngLat([0, 0]).addTo(map);
vehicleEl.style.display = 'none';

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

    map.addSource('route-drawn', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'route-glow', type: 'line', source: 'route-drawn', paint: { 'line-color': '#c9a84c', 'line-width': 8, 'line-opacity': 0.2, 'line-blur': 6 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route-drawn', paint: { 'line-color': '#c9a84c', 'line-width': 3.5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

    setTimeout(runJourney, 1500);
});

// --- Build route with LOTS of points for smooth interpolation ---
function lerp(a, b, t) { return a + (b - a) * t; }

function buildRoute() {
    const pts = [];
    const legStarts = [0];
    for (let i = 0; i < destinations.length - 1; i++) {
        const f = destinations[i], t = destinations[i + 1];
        const steps = i === 0 ? 500 : 400;
        for (let s = 0; s <= steps; s++) {
            const frac = s / steps;
            let lat = lerp(f.lat, t.lat, frac);
            let lng = lerp(f.lng, t.lng, frac);
            if (i === 0) lat += Math.sin(frac * Math.PI) * 8;
            pts.push([lng, lat]);
        }
        legStarts.push(pts.length - 1);
    }
    return { pts, legStarts };
}

function angleDeg(a, b) { return Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI; }

const progressBar = document.getElementById('progress-bar');
const currentLeg = document.getElementById('current-leg');
function showLeg(t) { currentLeg.textContent = t; currentLeg.classList.add('visible'); }
function hideLeg() { currentLeg.classList.remove('visible'); }

let animId = null;

function runJourney() {
    const { pts, legStarts } = buildRoute();
    const total = pts.length;
    const drawn = [];

    // Duration in seconds for the ENTIRE journey
    const flightDuration = 15;  // 15 seconds for transatlantic
    const trainLegDuration = 12; // 12 seconds per train leg

    // Calculate total duration and speed per point
    const flightPts = legStarts[1];
    const trainPts = total - flightPts;
    const trainLegs = destinations.length - 2;
    const totalDuration = (flightDuration + trainLegDuration * trainLegs) * 1000; // ms

    let progress = 0; // 0 to 1
    let startTime = null;
    let legIdx = 0;
    let lastDrawnIdx = -1;

    vehicleEl.style.display = '';
    vehicleEl.querySelector('.gmap-icon').textContent = '✈️';

    map.flyTo({ center: [destinations[0].lng, destinations[0].lat], zoom: 4, pitch: 30, bearing: 30, duration: 2000, essential: true });

    function getIdxFromProgress(p) {
        // Map progress 0-1 to point index
        return Math.min(Math.floor(p * (total - 1)), total - 1);
    }

    function getSubProgress(p, idx) {
        // Get fractional position between idx and idx+1
        const exact = p * (total - 1);
        return exact - Math.floor(exact);
    }

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        progress = Math.min(elapsed / totalDuration, 1);

        const idx = getIdxFromProgress(progress);
        const subT = getSubProgress(progress, idx);

        // Interpolate between current and next point for sub-pixel smoothness
        const pt = pts[idx];
        let smoothPt;
        if (idx < total - 1) {
            const next = pts[idx + 1];
            smoothPt = [lerp(pt[0], next[0], subT), lerp(pt[1], next[1], subT)];
        } else {
            smoothPt = pt;
        }

        // Update leg
        const newLeg = legStarts.findIndex((s, i) => i < legStarts.length - 1 && idx >= s && idx < legStarts[i + 1]);
        if (newLeg >= 0 && newLeg !== legIdx) {
            legIdx = newLeg;
            const isFlight = legIdx === 0;
            vehicleEl.querySelector('.gmap-icon').textContent = isFlight ? '✈️' : '🚂';
        }
        const isFlight = legIdx === 0;
        const from = destinations[legIdx], to = destinations[legIdx + 1];

        // Leg label
        if (idx === 0 || idx === legStarts[legIdx]) {
            showLeg(isFlight ? `✈️ ${from.name} → ${to.name}` : `🚂 ${from.name} → ${to.name}`);
        }

        // Move vehicle (sub-pixel smooth)
        vehicleMarker.setLngLat(smoothPt);

        // Rotate toward direction of travel
        if (idx < total - 2) {
            const lookAhead = Math.min(idx + 10, total - 1);
            const angle = angleDeg(pt, pts[lookAhead]);
            vehicleEl.querySelector('.gmap-icon').style.transform = `rotate(${-angle}deg)`;
        }

        // Draw route trail (add points we've passed)
        if (idx > lastDrawnIdx) {
            for (let i = lastDrawnIdx + 1; i <= idx; i++) drawn.push(pts[i]);
            lastDrawnIdx = idx;
            map.getSource('route-drawn').setData({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: drawn }
            });
        }

        // Camera: smooth continuous follow
        const lookAheadCam = Math.min(idx + 60, total - 1);
        const camTarget = pts[lookAheadCam];
        const camBearing = angleDeg(smoothPt, camTarget);
        const zoom = isFlight ? lerp(3, 5.5, idx / legStarts[1]) : 10;

        map.easeTo({
            center: smoothPt,
            zoom,
            pitch: isFlight ? 35 : 55,
            bearing: camBearing * 0.3,
            duration: 100,
            easing: t => t
        });

        progressBar.style.width = `${progress * 100}%`;

        if (progress < 1) {
            animId = requestAnimationFrame(animate);
        } else {
            // Done
            vehicleEl.style.display = 'none';
            hideLeg();
            const bounds = new mapboxgl.LngLatBounds();
            destinations.forEach(d => bounds.extend([d.lng, d.lat]));
            map.fitBounds(bounds, { padding: 60, pitch: 40, bearing: 0, duration: 3000 });
        }
    }

    setTimeout(() => { animId = requestAnimationFrame(animate); }, 2500);
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
