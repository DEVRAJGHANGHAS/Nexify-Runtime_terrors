/**
 * ============================================================
 *  Blood Finder — Real-Time Location Module  (location.js)
 *  Handles GPS → Backend API → Socket.IO → Live Leaflet Map
 * ============================================================
 *
 *  Features:
 *  • navigator.geolocation.watchPosition  (continuous GPS)
 *  • POST /api/location/update            (persist to backend)
 *  • GET  /api/location/nearby            (Haversine search)
 *  • POST /api/donors/nearby              (blood-group filtered search)
 *  • Socket.IO live donor streaming       (real-time markers)
 *  • Leaflet interactive map              (donor pins + route)
 *  • Live status badge + donor count
 * ============================================================
 */

'use strict';

// ── Config ───────────────────────────────────────────────────
const BF_API   = `${window.location.origin}/api`;
const BF_WS    = window.location.origin;
const DELHI    = { lat: 28.6139, lng: 77.2090 };   // fallback centre
let RADIUS_M   = 10000;                              // 10 km default

// ── State ────────────────────────────────────────────────────
const BFLocation = {
  map:            null,
  userMarker:     null,
  donorMarkers:   {},          // donorId → L.Marker
  userLat:        null,
  userLng:        null,
  watchId:        null,
  socket:         null,
  isLive:         false,
  bloodGroup:     null,        // set from search form
};

// ============================================================
//  1. GPS — Get & Watch position
// ============================================================

/**
 * Get user's GPS position once.
 * Falls back to Delhi centre if denied.
 */
BFLocation.getPosition = function () {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[location] Geolocation not supported — using Delhi fallback');
      return resolve(DELHI);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        console.warn('[location] GPS denied —', err.message, '— using Delhi fallback');
        resolve(DELHI);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
};

/**
 * Start continuous position watch — updates map marker and backend.
 */
BFLocation.startWatch = function () {
  if (!navigator.geolocation || BFLocation.watchId !== null) return;

  BFLocation.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      BFLocation.userLat = lat;
      BFLocation.userLng = lng;

      // Move user marker
      if (BFLocation.userMarker) {
        BFLocation.userMarker.setLatLng([lat, lng]);
      }

      // Send to backend (fire-and-forget)
      const token = localStorage.getItem('bf_token');
      if (token) {
        fetch(`${BF_API}/location/update`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body:    JSON.stringify({ latitude: lat, longitude: lng, accuracy })
        }).catch(() => {});  // silent — offline-tolerant

        // Also send via Socket.IO if connected
        if (BFLocation.socket?.connected) {
          BFLocation.socket.emit('location_update', { latitude: lat, longitude: lng, accuracy, timestamp: new Date() });
        }
      }
    },
    (err) => console.warn('[location] watch error:', err.message),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
};

BFLocation.stopWatch = function () {
  if (BFLocation.watchId !== null) {
    navigator.geolocation.clearWatch(BFLocation.watchId);
    BFLocation.watchId = null;
  }
};

// ============================================================
//  2. Map — Leaflet initialisation
// ============================================================

BFLocation.initMap = function (containerId, lat, lng) {
  if (BFLocation.map) {
    BFLocation.map.setView([lat, lng], 13);
    if (BFLocation.radiusCircle) {
      BFLocation.radiusCircle.setLatLng([lat, lng]);
      BFLocation.radiusCircle.setRadius(RADIUS_M >= 40000000 ? 0 : RADIUS_M);
      BFLocation.radiusCircle.setStyle({ opacity: RADIUS_M >= 40000000 ? 0 : 1, fillOpacity: RADIUS_M >= 40000000 ? 0 : 0.05 });
    }
    return;
  }

  BFLocation.map = L.map(containerId, { zoomControl: true }).setView([lat, lng], 13);

  // Dark-themed OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>'
  }).addTo(BFLocation.map);

  // User position marker (pulsing blue dot)
  const userIcon = L.divIcon({
    className: '',
    html: `<div style="
      width:18px;height:18px;
      background:linear-gradient(135deg,#007AFF,#5856D6);
      border:3px solid #fff;
      border-radius:50%;
      box-shadow:0 0 0 6px rgba(0,122,255,0.25);
      animation: bfPulse 1.8s ease-in-out infinite;
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  BFLocation.userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
    .addTo(BFLocation.map)
    .bindPopup('<b>📍 You are here</b>');

  BFLocation.radiusCircle = L.circle([lat, lng], {
    radius: RADIUS_M >= 40000000 ? 0 : RADIUS_M,
    color: '#D62839',
    fillColor: '#D62839',
    fillOpacity: RADIUS_M >= 40000000 ? 0 : 0.05,
    opacity: RADIUS_M >= 40000000 ? 0 : 1,
    weight: 1.5,
    dashArray: '6 4',
  }).addTo(BFLocation.map);

  setTimeout(() => BFLocation.map.invalidateSize(), 200);
};

// ── Donor icons ───────────────────────────────────────────────
function makeDonorIcon(bloodType, isLive = false) {
  const colors = {
    'A+':'#ff4d6d','A-':'#c9184a','B+':'#f77f00','B-':'#d62839',
    'O+':'#2d6a4f','O-':'#1b4332','AB+':'#5856D6','AB-':'#3a3a8c',
  };
  const bg = colors[bloodType] || '#D62839';
  const liveBadge = isLive ? `<span style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:#34C759;border:2px solid #fff;border-radius:50%;"></span>` : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:38px;height:38px;">
      <div style="
        width:38px;height:38px;
        background:${bg};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid #fff;
        box-shadow:0 4px 12px rgba(0,0,0,0.25);
      "></div>
      <span style="
        position:absolute;top:6px;left:0;width:100%;
        text-align:center;
        font-size:9px;font-weight:800;color:#fff;
        transform:none;
        font-family:Outfit,sans-serif;
        text-shadow:0 1px 2px rgba(0,0,0,0.4);
      ">${bloodType}</span>
      ${liveBadge}
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [10, 38],
    popupAnchor: [9, -36],
  });
}

// ── Add/update a donor marker ─────────────────────────────────
BFLocation.putDonorMarker = function (donor) {
  const id   = donor.id || donor.userId || (donor.name + donor.distanceMetres);
  const lat  = donor.location?.lat || donor.lat || null;
  const lng  = donor.location?.lng || donor.lng || null;
  if (!lat || !lng || !BFLocation.map) return;

  const isLive = !!donor.isLive;
  const dist   = donor.distanceKm ? `${donor.distanceKm} km away` : '';
  const avail  = donor.availability !== false ? '✅ Available' : '🔴 Unavailable';
  const liveTxt = isLive ? '<span style="color:#34C759;font-weight:700;">🟢 LIVE</span>' : '';

  const popup = `
    <div style="font-family:Outfit,sans-serif;min-width:160px;">
      <div style="font-size:1.2rem;font-weight:800;color:#D62839;">${donor.bloodType || donor.bloodGroup || '?'}</div>
      <div style="font-weight:600;margin:4px 0;">${donor.name || 'Anonymous Donor'}</div>
      <div style="font-size:0.8rem;color:#666;">${dist} · ${avail}</div>
      ${liveTxt ? `<div style="font-size:0.8rem;margin-top:4px;">${liveTxt}</div>` : ''}
      <button onclick="window.__bfAlert && window.__bfAlert('${donor.name || 'Donor'}')"
        style="margin-top:8px;width:100%;padding:7px;border:none;border-radius:8px;
               background:linear-gradient(135deg,#D62839,#ff4d6d);color:#fff;
               font-weight:700;font-size:0.8rem;cursor:pointer;font-family:Outfit,sans-serif;">
        🩸 Send Alert
      </button>
    </div>`;

  if (BFLocation.donorMarkers[id]) {
    BFLocation.donorMarkers[id].setLatLng([lat, lng]);
    BFLocation.donorMarkers[id].setPopupContent(popup);
  } else {
    BFLocation.donorMarkers[id] = L.marker([lat, lng], {
      icon: makeDonorIcon(donor.bloodType || donor.bloodGroup || '?', isLive)
    }).addTo(BFLocation.map).bindPopup(popup);
  }
};

BFLocation.clearDonorMarkers = function () {
  Object.values(BFLocation.donorMarkers).forEach(m => m.remove());
  BFLocation.donorMarkers = {};
};

// ============================================================
//  3. API — Nearby search
// ============================================================

/**
 * Search nearby donors via REST API.
 * @param {number} lat
 * @param {number} lng
 * @param {string|null} bloodGroup
 * @returns {Promise<{donors, liveDonors, count}>}
 */
BFLocation.searchNearby = async function (lat, lng, bloodGroup = null) {
  try {
    const res = await fetch(`${BF_API}/location/nearby?lat=${lat}&lng=${lng}&radius=${RADIUS_M / 1000}km${bloodGroup ? '&bloodGroup=' + bloodGroup : ''}`);
    const data = await res.json();
    if (data.success) return data.data;
  } catch (err) {
    console.warn('[location] REST search failed:', err.message);
  }
  return { donors: [], liveDonors: [], count: 0 };
};

// ============================================================
//  4. Socket.IO — Live donor streaming
// ============================================================

BFLocation.connectSocket = function () {
  if (typeof io === 'undefined') return;
  if (BFLocation.socket?.connected) return;

  BFLocation.socket = io(BF_WS, { transports: ['websocket', 'polling'] });

  BFLocation.socket.on('connect', () => {
    console.log('[socket] connected:', BFLocation.socket.id);

    const token = localStorage.getItem('bf_token');
    const session = JSON.parse(localStorage.getItem('bf_session') || 'null');

    if (token && session) {
      BFLocation.socket.emit('authenticate', { userId: session.id, token });
    }

    // Request live donors near current position
    if (BFLocation.userLat) {
      BFLocation.socket.emit('get_live_donors', {
        latitude:  BFLocation.userLat,
        longitude: BFLocation.userLng,
        radius:    RADIUS_M,
        bloodGroup: BFLocation.bloodGroup
      });
    }
  });

  BFLocation.socket.on('live_donors', ({ donors = [] }) => {
    donors.forEach(d => BFLocation.putDonorMarker({ ...d, isLive: true }));
    BFLocation.updateLiveBadge(donors.length);
  });

  BFLocation.socket.on('location_updated', ({ userId, lat, lng }) => {
    // Update an existing live donor marker position
    const marker = BFLocation.donorMarkers[userId];
    if (marker) marker.setLatLng([lat, lng]);
  });

  BFLocation.socket.on('live_count', ({ count }) => BFLocation.updateLiveBadge(count));

  BFLocation.socket.on('disconnect', () => console.log('[socket] disconnected'));
  BFLocation.socket.on('connect_error', (err) => console.warn('[socket] error:', err.message));
};

// ============================================================
//  5. UI — Live badge & result list
// ============================================================

BFLocation.updateLiveBadge = function (count) {
  const badge = document.getElementById('bfLiveBadge');
  if (!badge) return;
  badge.textContent = `🟢 ${count} live`;
  badge.style.opacity = count > 0 ? '1' : '0.4';
};

BFLocation.renderDonorList = function (donors, liveDonors, container) {
  const all = [
    ...liveDonors.map(d => ({ ...d, isLive: true })),
    ...donors
  ];

  if (all.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:30px 20px;color:var(--text-muted);">
        <div style="font-size:2.5rem;margin-bottom:12px;">🔍</div>
        <p style="font-weight:600;">No donors found ${RADIUS_M >= 40000000 ? 'globally' : 'in ' + (RADIUS_M / 1000) + ' km'}</p>
        <p style="font-size:0.85rem;margin-top:4px;">Try expanding radius or a different blood group.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <h4 style="margin-bottom:15px;text-align:left;display:flex;align-items:center;gap:10px;">
      Found <span style="color:var(--primary-red);font-weight:800;">${all.length}</span> donor${all.length > 1 ? 's' : ''}
      <span style="font-size:0.75rem;background:rgba(214,40,57,0.1);color:#D62839;padding:3px 10px;border-radius:20px;font-weight:600;">
        ${RADIUS_M >= 40000000 ? 'globally' : 'within ' + (RADIUS_M / 1000) + ' km'}
      </span>
    </h4>`;

  all.forEach(donor => {
    const liveTag = donor.isLive
      ? `<span style="font-size:0.7rem;background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:20px;font-weight:700;">🟢 LIVE</span>`
      : '';
    const dist = donor.distanceKm ? `📍 ${donor.distanceKm} km away` : '📍 nearby';
    const id = donor.id || donor.userId || donor.name;

    container.innerHTML += `
      <div class="donor-card" id="dc-${id}">
        <div class="donor-info">
          <p class="name">
            ${donor.name || 'Anonymous'}
            <span style="font-size:0.78em;color:var(--text-muted);margin-left:4px;">(${donor.bloodType || donor.bloodGroup || '?'})</span>
            ${liveTag}
          </p>
          <p class="dist">${dist}${donor.distanceKm ? '' : ''}</p>
        </div>
        <button class="connect-btn"
          id="alert-btn-${(donor.name||'').replace(/\s/g,'')}"
          onclick="window.__bfAlert && window.__bfAlert('${donor.name || 'Donor'}', this)">
          Alert
        </button>
      </div>`;
  });
};

// ============================================================
//  6. Main entry — called by search form submit
// ============================================================

/**
 * Full location search flow:
 * 1. Show loading
 * 2. Get GPS position
 * 3. Init map
 * 4. Call REST API for nearby donors
 * 5. Connect Socket.IO for live updates
 * 6. Render list + markers
 */
BFLocation.search = async function (bloodGroup, locationInput, radiusStr) {
  if (radiusStr) RADIUS_M = parseInt(radiusStr, 10) || 10000;
  
  const resultsEl = document.getElementById('searchResults');
  const mapEl     = document.getElementById('map');

  // ── Loading state ──────────────────────────────────────────
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = `
    <div class="radar-scan" style="text-align:center;padding:20px;">
      <div class="radar-spinner"></div>
      <p style="margin-top:12px;font-weight:600;">
        📡 Getting your location & scanning ${RADIUS_M >= 40000000 ? 'globally' : (RADIUS_M / 1000) + ' km radius'} for
        <span style="color:var(--primary-red);">${bloodGroup}</span> donors...
      </p>
    </div>`;

  // ── GPS ────────────────────────────────────────────────────
  const pos = await BFLocation.getPosition();
  BFLocation.userLat  = pos.lat;
  BFLocation.userLng  = pos.lng;
  BFLocation.bloodGroup = bloodGroup;

  // Update location text input to reflect real coordinates
  if (locationInput && pos !== DELHI) {
    locationInput.value = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
  }

  // ── Map ────────────────────────────────────────────────────
  mapEl.classList.remove('hidden');
  BFLocation.initMap('map', pos.lat, pos.lng);
  BFLocation.clearDonorMarkers();

  // ── REST API search ────────────────────────────────────────
  const result = await BFLocation.searchNearby(pos.lat, pos.lng, bloodGroup);

  // ── Render list ────────────────────────────────────────────
  BFLocation.renderDonorList(result.donors || [], result.liveDonors || [], resultsEl);

  // ── Map markers ────────────────────────────────────────────
  (result.donors || []).forEach(d => BFLocation.putDonorMarker(d));
  (result.liveDonors || []).forEach(d => BFLocation.putDonorMarker({ ...d, isLive: true }));

  // ── Socket.IO live updates ─────────────────────────────────
  BFLocation.connectSocket();

  // Periodic refresh every 30s
  clearInterval(BFLocation._refreshInterval);
  BFLocation._refreshInterval = setInterval(async () => {
    const fresh = await BFLocation.searchNearby(BFLocation.userLat, BFLocation.userLng, BFLocation.bloodGroup);
    (fresh.donors || []).forEach(d => BFLocation.putDonorMarker(d));
    (fresh.liveDonors || []).forEach(d => BFLocation.putDonorMarker({ ...d, isLive: true }));
    BFLocation.updateLiveBadge((fresh.liveDonors || []).length);
  }, 30000);

  // ── Start watching user position ───────────────────────────
  BFLocation.startWatch();

  // Show toast
  const total = (result.count || 0) + (result.liveCount || 0);
  if (typeof showToast === 'function') {
    showToast(total > 0
      ? `🩸 Found ${total} donor${total > 1 ? 's' : ''} ${RADIUS_M >= 40000000 ? 'globally' : 'within ' + (RADIUS_M / 1000) + ' km'}!`
      : '⚠️ No donors found nearby. Try a wider search.');
  }

  setTimeout(() => BFLocation.map?.invalidateSize(), 300);
};

// ============================================================
//  7. GPS button — single-tap locate
// ============================================================

BFLocation.handleGpsButton = async function (inputEl) {
  if (inputEl) {
    inputEl.value = 'Getting GPS location...';
    inputEl.style.opacity = '0.6';
  }

  const pos = await BFLocation.getPosition();
  BFLocation.userLat = pos.lat;
  BFLocation.userLng = pos.lng;

  if (inputEl) {
    inputEl.value = pos === DELHI
      ? 'Delhi (GPS unavailable — using default)'
      : `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    inputEl.style.opacity = '1';
  }

  // Move map if already open
  if (BFLocation.map) {
    BFLocation.map.setView([pos.lat, pos.lng], 14, { animate: true });
    BFLocation.userMarker?.setLatLng([pos.lat, pos.lng]);
    BFLocation.radiusCircle?.setLatLng([pos.lat, pos.lng]);
  }

  if (typeof showToast === 'function') {
    showToast(pos === DELHI
      ? '📍 GPS unavailable — using Delhi centre'
      : '📍 Location detected!');
  }

  // Also update backend
  const token = localStorage.getItem('bf_token');
  if (token && pos !== DELHI) {
    fetch(`${BF_API}/location/update`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ latitude: pos.lat, longitude: pos.lng })
    }).catch(() => {});
  }
};

// ── Expose globally ───────────────────────────────────────────
window.BFLocation = BFLocation;
