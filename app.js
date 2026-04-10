const destinations = [
    { name: "Venice", lat: 45.4408, lng: 12.3155, emoji: "🚣", color: "#2196F3" },
    { name: "Lugano", lat: 46.0037, lng: 8.9511, emoji: "🇨🇭", color: "#FF9800" },
    { name: "Wengen", lat: 46.6083, lng: 7.9222, emoji: "⛷️", color: "#00BCD4" },
    { name: "Paris", lat: 48.8566, lng: 2.3522, emoji: "🗼", color: "#E91E63" },
    { name: "Bruges", lat: 51.2093, lng: 3.2247, emoji: "🏰", color: "#9C27B0" },
    { name: "Amsterdam", lat: 52.3676, lng: 4.9041, emoji: "🚲", color: "#FF5722" }
];

const map = L.map('map', { zoomControl: false, scrollWheelZoom: true, attributionControl: false })
    .setView([46, 5], 4);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);

// Fit all destinations
const bounds = L.latLngBounds(destinations.map(d => [d.lat, d.lng]));
map.fitBounds(bounds, { padding: [40, 40] });

// Markers
destinations.forEach((d, i) => {
    L.marker([d.lat, d.lng], {
        icon: L.divIcon({
            className: 'city-marker',
            html: `<div class="marker-dot" style="background:${d.color}">${d.emoji}</div><div class="marker-label">${d.name}</div>`,
            iconSize: [80, 55], iconAnchor: [40, 50]
        })
    }).addTo(map).on('click', () => {
        map.flyTo([d.lat, d.lng], 10, { duration: 1 });
        document.querySelector(`.destination[data-index="${i}"]`)?.scrollIntoView({ behavior: 'smooth' });
    });
});

// Route lines connecting destinations
for (let i = 0; i < destinations.length - 1; i++) {
    const from = destinations[i], to = destinations[i + 1];

    L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: to.color,
        weight: 3.5,
        opacity: 0.7
    }).addTo(map);

    // Arrow at midpoint
    const mid = [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2];
    const angle = Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180 / Math.PI;

    L.marker(mid, {
        icon: L.divIcon({
            className: 'arrow-marker',
            html: `<div class="route-arrow" style="transform:rotate(${90 - angle}deg); color:${to.color}">➤</div>`,
            iconSize: [20, 20], iconAnchor: [10, 10]
        })
    }).addTo(map);
}

// Scroll: highlight city
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            const idx = parseInt(entry.target.dataset.index);
            if (!isNaN(idx)) {
                const d = destinations[idx];
                map.flyTo([d.lat, d.lng], 10, { duration: 1.2 });
            }
        }
    });
}, { threshold: 0.3 });
document.querySelectorAll('.destination').forEach(el => observer.observe(el));

// Roadmap scroll animation
const roadmapObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.2 });
document.querySelectorAll('.info-card').forEach(el => roadmapObs.observe(el));
