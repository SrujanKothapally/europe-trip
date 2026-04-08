mapboxgl.accessToken = CONFIG.t;

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [10, 46], zoom: 7, pitch: 50, bearing: -10, projection: 'globe'
});

// Vehicle icon
const iconEl = document.createElement('div');
iconEl.className = 'nav-icon';
iconEl.textContent = '🚂';
const iconMarker = new mapboxgl.Marker({ element: iconEl, anchor: 'center' }).setLngLat([0, 0]);

map.on('style.load', async () => {
    map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.setFog({ color: 'rgb(220,230,240)', 'high-color': 'rgb(180,200,230)', 'horizon-blend': 0.04 });

    // Load route
    const resp = await fetch('venice-lucerne.json');
    const coords = await resp.json();

    // Draw the single route line
    map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
    map.addLayer({ id: 'route-bg', type: 'line', source: 'route', paint: { 'line-color': '#1976D2', 'line-width': 6, 'line-opacity': 0.3, 'line-blur': 3 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#1976D2', 'line-width': 3, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

    // Start/end markers
    addMarker(coords[0], '🚣 Venice', '#2196F3');
    addMarker(coords[coords.length - 1], '🏔️ Lucerne', '#FF9800');

    // Fit to route
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach(c => bounds.extend(c));
    map.fitBounds(bounds, { padding: 80, pitch: 50, duration: 2000 });

    // Start button
    document.getElementById('start-btn').addEventListener('click', () => startNavigation(coords));
});

function addMarker(coord, label, color) {
    const el = document.createElement('div');
    el.className = 'city-marker-3d';
    el.innerHTML = `<div class="marker-dot-3d" style="background:${color}">${label.split(' ')[0]}</div><div class="marker-name-3d">${label.split(' ')[1]}</div>`;
    new mapboxgl.Marker({ element: el }).setLngLat(coord).addTo(map);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function bearing(a, b) { return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360; }

function startNavigation(coords) {
    const total = coords.length;
    const duration = 60000; // 60 seconds
    let start = null;

    iconMarker.setLngLat(coords[0]).addTo(map);

    function animate(ts) {
        if (!start) start = ts;
        const t = Math.min((ts - start) / duration, 1);
        const exact = t * (total - 1);
        const idx = Math.floor(exact);
        const frac = exact - idx;

        const pt = coords[idx];
        const next = coords[Math.min(idx + 1, total - 1)];
        const pos = [lerp(pt[0], next[0], frac), lerp(pt[1], next[1], frac)];

        // Move icon
        iconMarker.setLngLat(pos);

        // Rotate icon to face direction of travel
        const lookAhead = Math.min(idx + 15, total - 1);
        const b = bearing(pos, coords[lookAhead]);
        iconEl.style.transform = `rotate(${b}deg)`;

        // Camera follows — fixed north, no rotation
        map.jumpTo({
            center: pos,
            zoom: 11,
            pitch: 60,
            bearing: 0
        });

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            // Done — zoom out to show full route
            const bounds = new mapboxgl.LngLatBounds();
            coords.forEach(c => bounds.extend(c));
            map.fitBounds(bounds, { padding: 80, pitch: 50, duration: 2000 });
        }
    }

    // Zoom to start
    map.flyTo({ center: coords[0], zoom: 11, pitch: 60, bearing: 0, duration: 2000 });
    setTimeout(() => requestAnimationFrame(animate), 2500);
}
