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

// Real route waypoints following actual train/road paths
const routeLegs = [
    {
        // Flight: Austin → Venice (arc over Atlantic)
        type: 'flight', label: '✈️ Austin → Venice', color: '#4CAF50',
        waypoints: null // generated as arc
    },
    {
        // Venice → Milan → Como → Lugano → Gotthard → Flüelen → Lake Lucerne → Lucerne
        type: 'train', label: '🚂 Venice → Lucerne (Gotthard Panorama Express)', color: '#2196F3',
        waypoints: [
            [12.3155, 45.4408],  // Venice Santa Lucia
            [12.2550, 45.4830],  // Mestre
            [11.8760, 45.4060],  // Verona
            [11.3440, 45.4380],  // Peschiera del Garda
            [10.6310, 45.4650],  // Brescia
            [9.6700, 45.5200],   // Bergamo area
            [9.1900, 45.4640],   // Milan Centrale
            [9.0850, 45.8100],   // Como San Giovanni
            [9.0170, 45.9700],   // Lugano approach
            [8.9510, 46.0037],   // Lugano
            [8.9250, 46.0900],   // Bellinzona
            [8.8050, 46.2540],   // Biasca
            [8.7510, 46.3300],   // Faido
            [8.6510, 46.4800],   // Airolo (south portal Gotthard)
            [8.6100, 46.5500],   // Göschenen (north portal)
            [8.6440, 46.6300],   // Wassen (spiral tunnels)
            [8.6430, 46.7100],   // Erstfeld
            [8.6310, 46.7700],   // Flüelen (boat starts)
            [8.6100, 46.8200],   // Lake Lucerne (Brunnen)
            [8.5200, 46.8800],   // Beckenried
            [8.4400, 46.9300],   // Stansstad
            [8.3093, 47.0502],   // Lucerne
        ]
    },
    {
        // Lucerne → Lauterbrunnen (via Interlaken)
        type: 'train', label: '🚂 Lucerne → Lauterbrunnen', color: '#00BCD4',
        waypoints: [
            [8.3093, 47.0502],   // Lucerne
            [8.1750, 46.9480],   // Alpnachstad
            [8.0600, 46.8830],   // Sarnen
            [8.0350, 46.7700],   // Lungern
            [8.0500, 46.7100],   // Brünig Pass
            [8.0330, 46.6950],   // Meiringen
            [7.8500, 46.6860],   // Brienz
            [7.8530, 46.6860],   // Lake Brienz
            [7.8500, 46.6830],   // Interlaken Ost
            [7.9091, 46.5936],   // Lauterbrunnen
        ]
    },
    {
        // Lauterbrunnen → Paris (via Bern, Basel, Strasbourg)
        type: 'train', label: '🚂 Lauterbrunnen → Paris', color: '#E91E63',
        waypoints: [
            [7.9091, 46.5936],   // Lauterbrunnen
            [7.8500, 46.6830],   // Interlaken
            [7.6290, 46.7520],   // Spiez
            [7.5890, 46.8500],   // Thun
            [7.4400, 46.9480],   // Bern
            [7.5900, 47.5470],   // Basel SBB
            [7.7340, 48.5850],   // Strasbourg
            [3.8700, 49.2100],   // Reims area
            [2.3522, 48.8566],   // Paris Gare de l'Est
        ]
    },
    {
        // Paris → Bruges (via Lille, Kortrijk)
        type: 'train', label: '🚂 Paris → Bruges', color: '#9C27B0',
        waypoints: [
            [2.3522, 48.8566],   // Paris Nord
            [2.7800, 49.4200],   // Compiègne area
            [3.0700, 50.6290],   // Lille
            [3.2640, 50.8270],   // Kortrijk
            [3.2247, 51.2093],   // Bruges
        ]
    },
    {
        // Bruges → Amsterdam (via Ghent, Antwerp, Rotterdam)
        type: 'train', label: '🚂 Bruges → Amsterdam', color: '#FF5722',
        waypoints: [
            [3.2247, 51.2093],   // Bruges
            [3.7210, 51.0540],   // Ghent
            [4.4210, 51.2190],   // Antwerp
            [4.4690, 51.4430],   // Breda
            [4.4700, 51.9230],   // Rotterdam
            [4.3570, 52.0790],   // Den Haag
            [4.6400, 52.2280],   // Leiden
            [4.6320, 52.3080],   // Schiphol area
            [4.9041, 52.3676],   // Amsterdam Centraal
        ]
    }
];

// --- Map ---
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [-20, 40], zoom: 2.5, pitch: 0, bearing: 0, projection: 'globe'
});

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

    // Build all route coordinates
    const allCoords = buildAllCoords();

    // Add full route as one line
    map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: allCoords } }
    });
    map.addLayer({ id: 'route-glow', type: 'line', source: 'route', paint: { 'line-color': '#c9a84c', 'line-width': 6, 'line-opacity': 0.2, 'line-blur': 4 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#c9a84c', 'line-width': 3, 'line-opacity': 0.85 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

    // Add colored segments per leg
    routeLegs.forEach((leg, i) => {
        const coords = leg.waypoints || buildFlightArc();
        map.addSource(`leg-${i}`, {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
        });
        map.addLayer({
            id: `leg-line-${i}`, type: 'line', source: `leg-${i}`,
            paint: {
                'line-color': leg.color,
                'line-width': leg.type === 'flight' ? 2.5 : 4,
                'line-opacity': 0.7,
                'line-dasharray': leg.type === 'flight' ? [4, 4] : [1, 0]
            },
            layout: { 'line-cap': 'round', 'line-join': 'round' }
        });
    });

    // Animate: fly along the route
    setTimeout(() => animateFlyAlong(allCoords), 1500);
});

function lerp(a, b, t) { return a + (b - a) * t; }

function buildFlightArc() {
    const from = destinations[0], to = destinations[1];
    const pts = [];
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        pts.push([
            lerp(from.lng, to.lng, t),
            lerp(from.lat, to.lat, t) + Math.sin(t * Math.PI) * 8
        ]);
    }
    routeLegs[0].waypoints = pts;
    return pts;
}

function buildAllCoords() {
    const arc = buildFlightArc();
    let all = [...arc];
    for (let i = 1; i < routeLegs.length; i++) {
        all = all.concat(routeLegs[i].waypoints.slice(1));
    }
    return all;
}

// --- Simple fly-along animation (camera only, no vehicle marker needed) ---
function angleDeg(a, b) {
    return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360;
}

const progressBar = document.getElementById('progress-bar');
const currentLeg = document.getElementById('current-leg');
function showLeg(t) { currentLeg.textContent = t; currentLeg.classList.add('visible'); }
function hideLeg() { currentLeg.classList.remove('visible'); }

function animateFlyAlong(coords) {
    const total = coords.length;
    const duration = 90000; // 90 seconds total
    let start = null;
    let currentLegIdx = 0;

    // Vehicle icon
    const vehicleEl = document.createElement('div');
    vehicleEl.className = 'gmap-vehicle';
    vehicleEl.innerHTML = '<div class="gmap-icon">✈️</div>';
    const marker = new mapboxgl.Marker({ element: vehicleEl, anchor: 'center' })
        .setLngLat(coords[0]).addTo(map);

    // Pre-compute leg boundaries in the allCoords array
    let legBoundaries = [0];
    let cumLen = routeLegs[0].waypoints.length;
    for (let i = 1; i < routeLegs.length; i++) {
        cumLen += routeLegs[i].waypoints.length - 1;
        legBoundaries.push(cumLen);
    }

    function animate(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const exactIdx = progress * (total - 1);
        const idx = Math.floor(exactIdx);
        const frac = exactIdx - idx;

        // Interpolate position
        const pt = coords[idx];
        const next = coords[Math.min(idx + 1, total - 1)];
        const pos = [lerp(pt[0], next[0], frac), lerp(pt[1], next[1], frac)];

        // Update leg
        for (let i = legBoundaries.length - 1; i >= 0; i--) {
            if (idx >= legBoundaries[i]) { currentLegIdx = i; break; }
        }
        const leg = routeLegs[currentLegIdx];
        showLeg(leg.label);
        vehicleEl.querySelector('.gmap-icon').textContent = leg.type === 'flight' ? '✈️' : '🚂';

        // Move vehicle
        marker.setLngLat(pos);

        // Rotate toward travel direction
        const lookAhead = Math.min(idx + 5, total - 1);
        const angle = angleDeg(pt, coords[lookAhead]);
        vehicleEl.querySelector('.gmap-icon').style.transform = `rotate(${angle}deg)`;

        // Camera follow (throttled)
        if (!this.lastCam || ts - this.lastCam > 800) {
            this.lastCam = ts;
            const camAhead = Math.min(idx + 15, total - 1);
            const bearing = angleDeg(pos, coords[camAhead]);
            const isFlight = leg.type === 'flight';
            map.easeTo({
                center: pos,
                zoom: isFlight ? lerp(3, 5, progress * 3) : 9,
                pitch: isFlight ? 30 : 50,
                bearing: bearing * 0.25,
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

    // Start
    map.flyTo({ center: coords[0], zoom: 4, pitch: 30, bearing: 30, duration: 2000 });
    setTimeout(() => requestAnimationFrame(animate), 2500);

    // Replay
    document.getElementById('replay-btn').onclick = () => {
        marker.setLngLat(coords[0]);
        marker.addTo(map);
        start = null;
        currentLegIdx = 0;
        progressBar.style.width = '0%';
        map.flyTo({ center: coords[0], zoom: 4, pitch: 30, bearing: 30, duration: 1500 });
        setTimeout(() => requestAnimationFrame(animate), 2000);
    };
}

// --- Controls ---
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
