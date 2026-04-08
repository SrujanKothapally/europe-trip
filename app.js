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

// --- Map ---
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-20, 40],
    zoom: 2.5,
    pitch: 0,
    bearing: 0,
    projection: 'globe'
});

map.on('style.load', () => {
    // 3D terrain
    map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512, maxzoom: 14
    });
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

    // Sky / atmosphere
    map.setFog({
        color: 'rgb(220, 230, 240)',
        'high-color': 'rgb(180, 200, 230)',
        'horizon-blend': 0.05,
        'space-color': 'rgb(15, 15, 30)',
        'star-intensity': 0.3
    });

    // 3D buildings
    const layers = map.getStyle().layers;
    const labelLayer = layers.find(l => l.type === 'symbol' && l.layout['text-field']);
    map.addLayer({
        id: '3d-buildings', source: 'composite', 'source-layer': 'building',
        filter: ['==', 'extrude', 'true'], type: 'fill-extrusion',
        minzoom: 13,
        paint: {
            'fill-extrusion-color': '#ddd',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.7
        }
    }, labelLayer?.id);

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

    // Route source (animated)
    map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });

    // Route glow (outer)
    map.addLayer({
        id: 'route-glow', type: 'line', source: 'route',
        paint: { 'line-color': '#c9a84c', 'line-width': 8, 'line-opacity': 0.25, 'line-blur': 6 }
    });
    // Route line
    map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        paint: { 'line-color': '#c9a84c', 'line-width': 3.5, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
    });

    // Start animation after map loads
    setTimeout(runCinematicJourney, 1500);
});

// --- Route building ---
function greatCirclePoints(start, end, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
    }
    return pts;
}

function buildFullRoute() {
    const allPts = [];
    for (let i = 0; i < destinations.length - 1; i++) {
        const from = destinations[i], to = destinations[i + 1];
        const steps = i === 0 ? 100 : 50;
        const pts = greatCirclePoints([from.lng, from.lat], [to.lng, to.lat], steps);
        allPts.push(...(i === 0 ? pts : pts.slice(1)));
    }
    return allPts;
}

// --- Cinematic camera ---
function flyToCity(idx) {
    const d = destinations[idx];
    const isAustin = idx === 0;
    map.flyTo({
        center: [d.lng, d.lat],
        zoom: isAustin ? 6 : 13,
        pitch: isAustin ? 20 : 60,
        bearing: isAustin ? 0 : Math.random() * 60 - 30,
        duration: 3000,
        essential: true
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const progressBar = document.getElementById('progress-bar');
const currentLeg = document.getElementById('current-leg');

function showLeg(text) { currentLeg.textContent = text; currentLeg.classList.add('visible'); }
function hideLeg() { currentLeg.classList.remove('visible'); }

async function runCinematicJourney() {
    const fullRoute = buildFullRoute();
    const drawnCoords = [];
    const totalPts = fullRoute.length;

    for (let i = 0; i < destinations.length - 1; i++) {
        const from = destinations[i], to = destinations[i + 1];
        const isFlight = i === 0;
        const steps = isFlight ? 100 : 50;
        const label = isFlight ? `✈️ ${from.name} → ${to.name}` : `🚂 ${from.name} → ${to.name}`;

        showLeg(label);

        // Cinematic: zoom out to show the leg
        const midLng = (from.lng + to.lng) / 2;
        const midLat = (from.lat + to.lat) / 2;
        const dist = Math.sqrt((to.lng - from.lng) ** 2 + (to.lat - from.lat) ** 2);
        const zoom = isFlight ? 3 : Math.max(6, 10 - dist * 1.5);
        const bearing = Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180 / Math.PI;

        map.flyTo({
            center: [midLng, midLat],
            zoom: zoom,
            pitch: isFlight ? 30 : 50,
            bearing: bearing * 0.3,
            duration: 2500,
            essential: true
        });
        await sleep(3000);

        // Animate route drawing
        const segStart = drawnCoords.length;
        const pts = greatCirclePoints([from.lng, from.lat], [to.lng, to.lat], steps);

        for (let p = 0; p < pts.length; p++) {
            drawnCoords.push(pts[p]);
            if (p % 3 === 0 || p === pts.length - 1) {
                map.getSource('route').setData({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: drawnCoords }
                });
            }
            progressBar.style.width = `${(drawnCoords.length / totalPts) * 100}%`;
            await sleep(isFlight ? 40 : 60);
        }

        // Fly into the destination city
        map.flyTo({
            center: [to.lng, to.lat],
            zoom: 14,
            pitch: 65,
            bearing: bearing * 0.5 + 10,
            duration: 3000,
            essential: true
        });
        await sleep(3500);

        // Slow orbit at the city
        const startBearing = map.getBearing();
        map.easeTo({ bearing: startBearing + 40, duration: 3000, easing: t => t });
        await sleep(3200);
    }

    // Final: zoom out to show full route
    hideLeg();
    await sleep(500);

    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 40, bearing: 0, duration: 3000 });
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

// --- Scroll interactions ---
function highlightCity(idx) {
    document.querySelectorAll('.city-marker-3d').forEach((el, i) => el.classList.toggle('active', i === idx));
    flyToCity(idx);
}

const scrollObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            const i = parseInt(e.target.dataset.index);
            if (!isNaN(i)) highlightCity(i);
        }
    });
}, { threshold: 0.3 });
document.querySelectorAll('.destination').forEach(el => scrollObs.observe(el));
