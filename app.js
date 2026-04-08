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

// Detailed segments for Venice → Lucerne (Gotthard Panorama Express)
const gotthardSegments = [
    { key: 'Venice → Milan', color: '#1565C0', width: 4, label: '🚄 High-Speed Train' },
    { key: 'Milan → Lugano', color: '#1976D2', width: 4, label: '🚂 Train to Lugano' },
    { key: 'Lugano → Flüelen (Gotthard)', color: '#D32F2F', width: 5, label: '🚂 Gotthard Panorama Express' },
    { key: 'Flüelen → Lucerne (Boat)', color: '#0288D1', width: 4, label: '⛴️ Lake Lucerne Cruise', dash: [6, 4] }
];

// Other legs (from routes.json)
const otherLegs = [
    { key: 'Lucerne → Lauterbrunnen', color: '#00BCD4', width: 4 },
    { key: 'Lauterbrunnen → Paris', color: '#E91E63', width: 4 },
    { key: 'Paris → Bruges', color: '#9C27B0', width: 4 },
    { key: 'Bruges → Amsterdam', color: '#FF5722', width: 4 }
];

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [5, 47], zoom: 4, pitch: 40, bearing: 0, projection: 'globe'
});

function lerp(a, b, t) { return a + (b - a) * t; }

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
            map.flyTo({ center: [d.lng, d.lat], zoom: 13, pitch: 60, duration: 2000 });
            document.querySelector(`.destination[data-index="${i}"]`)?.scrollIntoView({ behavior: 'smooth' });
        });
        new mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map);
    });

    // Flight arc
    const arc = [];
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        arc.push([lerp(-97.7431, 12.3155, t), lerp(30.2672, 45.4408, t) + Math.sin(t * Math.PI) * 8]);
    }
    map.addSource('flight', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: arc } } });
    map.addLayer({ id: 'flight', type: 'line', source: 'flight', paint: { 'line-color': '#4CAF50', 'line-width': 2.5, 'line-opacity': 0.7, 'line-dasharray': [4, 4] }, layout: { 'line-cap': 'round' } });

    // Load Gotthard detailed routes
    const gotthardResp = await fetch('gotthard-routes.json');
    const gotthardRoutes = await gotthardResp.json();

    gotthardSegments.forEach((seg, i) => {
        const coords = gotthardRoutes[seg.key];
        if (!coords) return;
        const id = `gotthard-${i}`;
        map.addSource(id, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
        map.addLayer({
            id, type: 'line', source: id,
            paint: { 'line-color': seg.color, 'line-width': seg.width, 'line-opacity': 0.8, ...(seg.dash ? { 'line-dasharray': seg.dash } : {}) },
            layout: { 'line-cap': 'round', 'line-join': 'round' }
        });
    });

    // Load other legs
    const routesResp = await fetch('routes.json');
    const routes = await routesResp.json();

    otherLegs.forEach((leg, i) => {
        const coords = routes[leg.key];
        if (!coords) return;
        const id = `leg-${i}`;
        map.addSource(id, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
        map.addLayer({
            id, type: 'line', source: id,
            paint: { 'line-color': leg.color, 'line-width': leg.width, 'line-opacity': 0.75 },
            layout: { 'line-cap': 'round', 'line-join': 'round' }
        });
    });

    // Fit to show all
    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 40, duration: 2000 });
});

// Scroll: fly to city
const scrollObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            const i = parseInt(e.target.dataset.index);
            if (!isNaN(i)) {
                const d = destinations[i];
                map.flyTo({ center: [d.lng, d.lat], zoom: i === 0 ? 5 : 13, pitch: 60, bearing: Math.random() * 30 - 15, duration: 2500 });
            }
        }
    });
}, { threshold: 0.3 });
document.querySelectorAll('.destination').forEach(el => scrollObs.observe(el));

document.getElementById('fullview-btn').addEventListener('click', () => {
    const bounds = new mapboxgl.LngLatBounds();
    destinations.forEach(d => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 60, pitch: 40, bearing: 0, duration: 2000 });
});
