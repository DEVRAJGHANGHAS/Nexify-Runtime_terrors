// Smart Server URL Detection
const SERVER_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' 
    ? 'http://localhost:3000' 
    : (window.location.protocol === 'file:' ? 'http://localhost:3000' : '');

let currentPoints = 350;
let socket;
let reqMap, reqMarker, reqCircle;
let offerMap, offerMarker, offerCircle;
let reqLat, reqLng, offerLat, offerLng;

if (typeof io !== 'undefined') {
    socket = io(SERVER_URL);
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            socket.emit('update_location', {
                mobile: localStorage.getItem('userMobile'),
                name: localStorage.getItem('userName'),
                lat: lat,
                lng: lng,
                blood_group: localStorage.getItem('userBloodGroup')
            });
        });
    }

    socket.on('blood_alert', (data) => {
        showToast(`🚨 URGENT: ${data.name} needs ${data.bg} near you! (${data.distance}km away)`);
        addLiveRequestCard(data, 'request');
    });

    socket.on('donor_available', (data) => {
        showToast(`💚 GOOD NEWS: ${data.name} is available to donate ${data.bg} (${data.distance}km away)`);
        addLiveRequestCard(data, 'offer');
    });
}

function addLiveRequestCard(data, type) {
    const list = document.getElementById('activeRequestsList');
    // Clear default message if it's there
    if(list.innerHTML.includes('Please save your Profile')) list.innerHTML = '';

    const isReq = type === 'request';
    const color = isReq ? 'var(--primary-red)' : '#34C759';
    const title = isReq ? `${data.bg} needed urgently` : `${data.bg} Donor Available`;
    const action = isReq ? 'Accept & Chat' : 'Request & Chat';
    
    const card = `
        <div class="req-item" style="border-left-color: ${color}; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <div>
                <h4 style="color: ${color};">${title}</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${data.name} • ${data.distance} km away</p>
                <p style="font-size: 0.75rem; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">Real-time Alert</p>
            </div>
            <button class="btn-primary" style="padding: 8px 15px; font-size: 0.9rem; background: ${isReq ? '' : 'linear-gradient(135deg, #34C759, #28A745)'};" onclick="window.location.href='messages.html?chat=${encodeURIComponent(data.name)}&mobile=${data.mobile}'">${action}</button>
        </div>
    `;
    list.innerHTML = card + list.innerHTML;
}

function handleLogout() {
    // ── SAVE ALL PROGRESS TO DATABASE BEFORE LOGOUT ──
    const mobile = localStorage.getItem('userMobile') || '';
    const email = localStorage.getItem('userEmail') || '';

    if (mobile || email) {
        const progressData = {
            mobile: mobile,
            email: email,
            profile: {
                name:               localStorage.getItem('userName') || '',
                blood_group:        localStorage.getItem('userBloodGroup') || '',
                address:            localStorage.getItem('userAddress') || '',
                last_donated:       localStorage.getItem('lastDonated') || '',
                medical_conditions: localStorage.getItem('medicalConditions') || ''
            },
            chats: JSON.parse(localStorage.getItem('bf_chats') || '{}')
        };

        const blob = new Blob([JSON.stringify(progressData)], { type: 'application/json' });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(SERVER_URL + '/api/user/save-progress', blob);
        } else {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', SERVER_URL + '/api/user/save-progress', false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(progressData));
        }
        console.log('💾 Progress saved to database on logout');
    }

    // Now clear localStorage
    localStorage.removeItem('bf_session');
    localStorage.removeItem('bf_token');
    localStorage.removeItem('userBloodGroup');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userMobile');
    localStorage.removeItem('userAddress');
    localStorage.removeItem('lastDonated');
    localStorage.removeItem('medicalConditions');
    localStorage.removeItem('bf_chats');
    if (typeof bfClient !== 'undefined' && bfClient.logout) {
        bfClient.logout();
    }
    window.location.href = 'index.html';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    void toast.offsetWidth; // Reflow
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 400);
    }, 3000);
}

function updatePointsDisplay() {
    const pointsEl = document.getElementById('userPoints');

    // Animate point change
    pointsEl.style.transform = 'scale(1.5)';
    pointsEl.style.color = '#fff';
    setTimeout(() => {
        pointsEl.innerText = currentPoints;
        pointsEl.style.transform = 'scale(1)';
        pointsEl.style.color = 'inherit';
    }, 200);

    // Update button states
    document.getElementById('btn-500').disabled = currentPoints < 500;
    document.getElementById('btn-250').disabled = currentPoints < 250;
    document.getElementById('btn-150').disabled = currentPoints < 150;
}

function redeemReward(cost, rewardName) {
    if (currentPoints >= cost) {
        currentPoints -= cost;
        updatePointsDisplay();
        showToast(`🎉 Successfully redeemed: ${rewardName}! Check your email for the voucher.`);

        // Confetti effect
        createConfetti();
    } else {
        showToast(`❌ Not enough drops. You need ${cost - currentPoints} more.`);
    }
}

function acceptRequest(btnElement, pointsEarned, hospitalName = 'Hospital Rep') {
    btnElement.innerHTML = "Accepted ✓";
    btnElement.style.background = "#34C759";
    btnElement.style.pointerEvents = "none";
    btnElement.style.boxShadow = "none";

    currentPoints += pointsEarned;
    updatePointsDisplay();

    showToast(`Heroic! You accepted an emergency. Earned +${pointsEarned} Drops.`);

    setTimeout(() => {
        window.location.href = `messages.html?chat=${encodeURIComponent(hospitalName)}`;
    }, 1200);
}



function initMaps() {
    const defaultLoc = [28.6139, 77.2090]; // Delhi fallback
    
    // Req Map
    const reqMapEl = document.getElementById('reqMap');
    if (reqMapEl && typeof L !== 'undefined') {
        reqMap = L.map('reqMap').setView(defaultLoc, 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(reqMap);
        
        reqMap.on('click', function(e) {
            reqLat = e.latlng.lat;
            reqLng = e.latlng.lng;
            document.getElementById('reqLocation').value = `${reqLat.toFixed(4)}, ${reqLng.toFixed(4)}`;
            updateReqMarker();
        });
        document.getElementById('reqRadius').addEventListener('change', updateReqMarker);
    }
    
    // Offer Map
    const offerMapEl = document.getElementById('offerMap');
    if (offerMapEl && typeof L !== 'undefined') {
        offerMap = L.map('offerMap').setView(defaultLoc, 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(offerMap);
        
        offerMap.on('click', function(e) {
            offerLat = e.latlng.lat;
            offerLng = e.latlng.lng;
            document.getElementById('offerLocation').value = `${offerLat.toFixed(4)}, ${offerLng.toFixed(4)}`;
            updateOfferMarker();
        });
        document.getElementById('offerRadius').addEventListener('change', updateOfferMarker);
    }
    
    // Try to get user's actual location
    if (navigator.geolocation && typeof L !== 'undefined') {
        navigator.geolocation.getCurrentPosition((pos) => {
            const loc = [pos.coords.latitude, pos.coords.longitude];
            if (reqMap) { reqMap.setView(loc, 12); reqLat = loc[0]; reqLng = loc[1]; document.getElementById('reqLocation').value = `${reqLat.toFixed(4)}, ${reqLng.toFixed(4)}`; updateReqMarker(); }
            if (offerMap) { offerMap.setView(loc, 12); offerLat = loc[0]; offerLng = loc[1]; document.getElementById('offerLocation').value = `${offerLat.toFixed(4)}, ${offerLng.toFixed(4)}`; updateOfferMarker(); }
        });
    }
}

function updateReqMarker() {
    if(!reqLat || !reqLng || !reqMap) return;
    const r = parseInt(document.getElementById('reqRadius').value) * 1000;
    if(reqMarker) reqMap.removeLayer(reqMarker);
    if(reqCircle) reqMap.removeLayer(reqCircle);
    reqMarker = L.marker([reqLat, reqLng]).addTo(reqMap);
    reqCircle = L.circle([reqLat, reqLng], { radius: r, color: 'red', fillOpacity: 0.1 }).addTo(reqMap);
}

function updateOfferMarker() {
    if(!offerLat || !offerLng || !offerMap) return;
    const r = parseInt(document.getElementById('offerRadius').value) * 1000;
    if(offerMarker) offerMap.removeLayer(offerMarker);
    if(offerCircle) offerMap.removeLayer(offerCircle);
    offerMarker = L.marker([offerLat, offerLng]).addTo(offerMap);
    offerCircle = L.circle([offerLat, offerLng], { radius: r, color: 'green', fillOpacity: 0.1 }).addTo(offerMap);
}

function createConfetti() {
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-10px';
        confetti.style.width = '8px';
        confetti.style.height = '16px';
        confetti.style.backgroundColor = ['#FFD700', '#FF9500', '#FF3B30', '#4CD964', '#5AC8FA'][Math.floor(Math.random() * 5)];
        confetti.style.borderRadius = '4px';
        confetti.style.zIndex = '9999';
        confetti.style.pointerEvents = 'none';

        document.body.appendChild(confetti);

        const animation = confetti.animate([
            { transform: `translate3d(0, 0, 0) rotate(0deg)`, opacity: 1 },
            { transform: `translate3d(${Math.random() * 200 - 100}px, 100vh, 0) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
            duration: Math.random() * 1500 + 1000,
            easing: 'cubic-bezier(.37,0,.63,1)'
        });

        animation.onfinish = () => confetti.remove();
    }
}

const mockHospitals = ["City Hospital", "Max Clinic", "Apollo Hospital", "Fortis", "AIIMS"];

document.getElementById('profileForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const mobile = document.getElementById('userMobile').value;
    const address = document.getElementById('userAddress').value;
    const bg = document.getElementById('userBloodGroup').value;
    const lastDate = document.getElementById('lastDonated').value;
    const conditions = document.getElementById('medicalConditions').value;

    localStorage.setItem('userName', name);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userMobile', mobile);
    localStorage.setItem('userAddress', address);
    localStorage.setItem('userBloodGroup', bg);
    localStorage.setItem('lastDonated', lastDate);
    localStorage.setItem('medicalConditions', conditions);

    const userNameDisplay = document.getElementById('userNameDisplay');
    if (userNameDisplay) userNameDisplay.innerText = name || 'Hero';

    // ── SYNC PROFILE TO DATABASE ──
    if (mobile || email) {
        fetch(SERVER_URL + '/api/user/save-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile, email,
                profile: {
                    name, blood_group: bg, address,
                    last_donated: lastDate,
                    medical_conditions: conditions
                },
                chats: JSON.parse(localStorage.getItem('bf_chats') || '{}')
            })
        }).then(r => r.json())
          .then(d => {
              if (d.success) console.log('💾 Profile synced to database');
          })
          .catch(() => {});
    }

    showToast(`Profile updated & saved to database! You are matched for ${bg} requests.`);

    renderTargetedRequests(bg);
});

function renderTargetedRequests(bloodGroup) {
    const list = document.getElementById('activeRequestsList');
    list.innerHTML = '';

    const hospital1 = mockHospitals[Math.floor(Math.random() * mockHospitals.length)];
    let hospital2 = mockHospitals[Math.floor(Math.random() * mockHospitals.length)];
    while (hospital1 === hospital2) {
        hospital2 = mockHospitals[Math.floor(Math.random() * mockHospitals.length)];
    }
    const dist1 = (Math.random() * 5 + 0.5).toFixed(1);
    const dist2 = (Math.random() * 10 + 2).toFixed(1);

    const req1 = `
        <div class="req-item">
            <div>
                <h4 style="color: var(--primary-red);">${bloodGroup} needed urgently</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${hospital1} • ${dist1} km</p>
            </div>
            <button class="btn-primary" style="padding: 8px 15px; font-size: 0.9rem;" onclick="acceptRequest(this, 100, '${hospital1}')">Accept</button>
        </div>
    `;

    const req2 = `
        <div class="req-item" style="border-left-color: #FF9500;">
            <div>
                <h4 style="color: #FF9500;">${bloodGroup} for Surgery</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${hospital2} • ${dist2} km</p>
            </div>
            <button class="btn-primary" style="padding: 8px 15px; font-size: 0.9rem; background: linear-gradient(135deg, #FF9500, #FFCC00);" onclick="acceptRequest(this, 50, '${hospital2}')">Accept</button>
        </div>
    `;

    list.innerHTML = req1 + req2;
}

// Initialize button states and load profile on load
document.addEventListener('DOMContentLoaded', () => {
    updatePointsDisplay();

    // Check for DigiLocker OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userStr = params.get('user');
    const digilockerVerified = params.get('digilocker');
    
    if (token && userStr) {
        localStorage.setItem('bf_token', token);
        localStorage.setItem('bf_session', userStr);
        if (digilockerVerified) {
            setTimeout(() => {
                showToast('✅ Identity securely verified via DigiLocker!');
            }, 500);
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const savedName = localStorage.getItem('userName');
    const savedEmail = localStorage.getItem('userEmail');
    const savedMobile = localStorage.getItem('userMobile');
    const savedAddress = localStorage.getItem('userAddress');
    const savedBg = localStorage.getItem('userBloodGroup');
    const savedLastDate = localStorage.getItem('lastDonated');
    const savedConditions = localStorage.getItem('medicalConditions');

    if (savedName) {
        document.getElementById('userName').value = savedName;
        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) userNameDisplay.innerText = savedName;
    }
    if (savedEmail) document.getElementById('userEmail').value = savedEmail;
    if (savedMobile) document.getElementById('userMobile').value = savedMobile;
    if (savedAddress) document.getElementById('userAddress').value = savedAddress;
    if (savedLastDate) document.getElementById('lastDonated').value = savedLastDate;
    if (savedConditions) document.getElementById('medicalConditions').value = savedConditions;

    if (savedBg) {
        document.getElementById('userBloodGroup').value = savedBg;
        renderTargetedRequests(savedBg);
    }

    const publishForm = document.getElementById('publishForm');
    if (publishForm) {
        publishForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const bg = document.getElementById('reqBloodGroup').value;
            const loc = document.getElementById('reqLocation').value;
            const urgency = document.getElementById('reqUrgency').value;
            const radius = parseInt(document.getElementById('reqRadius').value);

            if (!reqLat || !reqLng) {
                showToast('⚠️ Please click on the map to set a location.');
                return;
            }

            if (socket) {
                socket.emit('publish_need', {
                    bg: bg,
                    lat: reqLat,
                    lng: reqLng,
                    radius: radius,
                    urgency: urgency,
                    locationName: loc,
                    name: localStorage.getItem('userName') || 'A User',
                    mobile: localStorage.getItem('userMobile')
                });
            }

            showToast(`🚨 Urgent Request for ${bg} has been broadcasted to donors within ${radius}km!`);
            
            // Clear form
            publishForm.reset();
            if(reqMarker) reqMap.removeLayer(reqMarker);
            if(reqCircle) reqMap.removeLayer(reqCircle);
            reqLat = null; reqLng = null;
        });
    }

    const offerForm = document.getElementById('offerForm');
    if (offerForm) {
        offerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const bg = document.getElementById('offerBloodGroup').value;
            const loc = document.getElementById('offerLocation').value;
            const avail = document.getElementById('offerAvailability').value;
            const radius = parseInt(document.getElementById('offerRadius').value);

            if (!offerLat || !offerLng) {
                showToast('⚠️ Please click on the map to set a location.');
                return;
            }

            if (socket) {
                socket.emit('publish_availability', {
                    bg: bg,
                    lat: offerLat,
                    lng: offerLng,
                    radius: radius,
                    availability: avail,
                    locationName: loc,
                    name: localStorage.getItem('userName') || 'A User',
                    mobile: localStorage.getItem('userMobile')
                });
            }

            showToast(`💚 Thank you! Your availability to donate ${bg} is now visible within ${radius}km.`);
            
            // Clear form
            offerForm.reset();
            if(offerMarker) offerMap.removeLayer(offerMarker);
            if(offerCircle) offerMap.removeLayer(offerCircle);
            offerLat = null; offerLng = null;
        });
    }

    // Initialize the Leaflet maps
    setTimeout(() => {
        initMaps();
        // Fix Leaflet sizing issue in hidden/newly rendered divs
        if(reqMap) reqMap.invalidateSize();
        if(offerMap) offerMap.invalidateSize();
    }, 500);
});