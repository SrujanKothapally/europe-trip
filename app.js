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

const legMeta = [
    { name: 'Austin → Venice', type: 'flight', color: '#4CAF50', label: '✈️ Austin → Venice' },
    { name: 'Venice → Lucerne', type: 'train', color: '#2196F3', label: '🚂 Gotthard Panorama Express' },
    { name: 'Lucerne → Lauterbrunnen', type: 'train', color: '#00BCD4', label: '🚂 Lucerne → Lauterbrunnen' },
    { name: 'Lauterbrunnen → Paris', type: 'train', color: '#E91E63', label: '🚂 Lauterbrunnen → Paris' },
    { name: 'Paris → Bruges', type: 'train', color: '#9C27B0', label: '🚂 Paris → Bruges' },
    { name: 'Bruges → Amsterdam', type: 'train', color: '#FF5722', label: '🚂 Bruges → Amsterdam' }
];

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-20, 40], zoom: 2.5, pitch: 0, bearing: 0, projection: 'globe'
});

function lerp(a, b, t) { return a + (b - a) * t; }
function angleDeg(a, b) { return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360; }

function buildFlightArc() {
    const f = destinations[0], t = destinations[1], pts = [];
    for (let i = 0; i <= 200; i++) {
        const frac = i / 200;
        pts.push([lerp(f.lng, t.lng, frac), lerp(f.lat, t.lat, frac) + Math.sin(frac * Math.PI) * 8]);
    }
    return pts;
}

map.on('style.load', async () => {
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

    // Load real routes
    const resp = await fetch('routes.json');
    const routes = await resp.json();

    // Build full coordinate array
    const flightArc = buildFlightArc();
    const allLegs = [flightArc];
    const legNames = Object.keys(routes);
    legNames.forEach(name => allLegs.push(routes[name]));

    // Flatten into one array for animation
    let allCoords = [...flightArc];
    const legBounds = [0, flightArc.length];
    legNames.forEach(name => {
        const pts = routes[name];
        allCoords = allCoords.concat(pts.slice(1));
        legBounds.push(allCoords.length);
    });

    // Draw each leg as colored line
    allLegs.forEach((coords, i) => {
        const meta = legMeta[i];
        map.addSource(`leg-${i}`, {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
        });
        map.addLayer({
            id: `leg-${i}`, type: 'line', source: `leg-${i}`,
            paint: {
                'line-color': meta.color,
                'line-width': meta.type === 'flight' ? 2.5 : 4,
                'line-opacity': 0.75,
                'line-dasharray': meta.type === 'flight' ? [4, 4] : [1, 0]
            },
            layout: { 'line-cap': 'round', 'line-join': 'round' }
        });
    });

    // Animate
    setTimeout(() => animateJourney(allCoords, legBounds), 1500);
});

const progressBar = document.getElementById('progress-bar');
const currentLeg = document.getElementById('current-leg');
function showLeg(t) { currentLeg.textContent = t; currentLeg.classList.add('visible'); }
function hideLeg() { currentLeg.classList.remove('visible'); }

function animateJourney(coords, legBounds) {
    const total = coords.length;
    const duration = 120000; // 2 minutes
    let start = null;

    const vehicleEl = document.createElement('div');
    vehicleEl.className = 'gmap-vehicle';
    vehicleEl.innerHTML = '<div class="gmap-icon">✈️</div>';
    const marker = new mapboxgl.Marker({ element: vehicleEl, anchor: 'center' })
        .setLngLat(coords[0]).addTo(map);

    let lastCamTime = 0;

    function getLeg(idx) {
        for (let i = legBounds.length - 1; i >= 0; i--) {
            if (idx >= legBounds[i]) return i;
        }
        return 0;
    }

    function animate(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const exact = progress * (total - 1);
        const idx = Math.floor(exact);
        const frac = exact - idx;

        const pt = coords[idx];
        const next = coords[Math.min(idx + 1, total - 1)];
        const pos = [lerp(pt[0], next[0], frac), lerp(pt[1], next[1], frac)];

        // Leg info
        const legIdx = getLeg(idx);
        const meta = legMeta[legIdx];
        showLeg(meta.label);
        vehicleEl.querySelector('.gmap-icon').textContent = meta.type === 'flight' ? '✈️' : '🚂';

        // Move vehicle
        marker.setLngLat(pos);

        // Rotate
        const ahead = Math.min(idx + 8, total - 1);
        vehicleEl.querySelector('.gmap-icon').style.transform = `rotate(${angleDeg(pt, coords[ahead])}deg)`;

        // Camera (throttled)
        if (ts - lastCamTime > 800) {
            lastCamTime = ts;
            const camAhead = Math.min(idx + 20, total - 1);
            const bearing = angleDeg(pos, coords[camAhead]);
            const isFlight = meta.type === 'flight';
            map.easeTo({
                center: pos,
                zoom: isFlight ? lerp(3, 5, (idx / legBounds[1])) : 10,
                pitch: isFlight ? 30 : 50,
                bearing: bearing * 0.2,
                duration: 1000,
                easing: t => t * (2 - t)
            });
        }

        progressBar.style.width = `${progress * 100}%`;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            marker.remove();
            hideLeg();
            const bounds = new mapboxgl.LngLatBounds();
            destinations.forEach(d => bounds.extend([d.lng, d.lat]));
            map.fitBounds(bounds, { padding: 60, pitch: 40, duration: 3000 });
        }
    }

    map.flyTo({ center: coords[0], zoom: 4, pitch: 30, bearing: 30, duration: 2000 });
    setTimeout(() => requestAnimationFrame(animate), 2500);

    document.getElementById('replay-btn').onclick = () => {
        marker.setLngLat(coords[0]).addTo(map);
        start = null; lastCamTime = 0;
        progressBar.style.width = '0%';
        map.flyTo({ center: coords[0], zoom: 4, pitch: 30, bearing: 30, duration: 1500 });
        setTimeout(() => requestAnimationFrame(animate), 2000);
    };
}

document.getElementById('fullview-btn').addEventListener('click', () => {
    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 30, bearing: 0, duration: 2000 });
});

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
