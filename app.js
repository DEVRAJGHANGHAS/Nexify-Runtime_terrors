// Smooth Scrolling for Nav Links
function scrollToSection(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Toast Notification System
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    // Trigger reflow
    void toast.offsetWidth;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 400); // Wait for transition
    }, 3000);
}

// GPS Location Mock
document.getElementById('gpsBtn').addEventListener('click', () => {
    const locInput = document.getElementById('location');
    locInput.value = "Fetching GPS coordinates...";
    locInput.style.opacity = "0.5";
    
    setTimeout(() => {
        locInput.value = "Safdarjung Hospital, New Delhi (Current Location)";
        locInput.style.opacity = "1";
        showToast("Location detected via GPS");
    }, 1500);
});

// Emergency Search Mock Logic
document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const bloodGroup = document.getElementById('bloodGroup').value;
    const searchResults = document.getElementById('searchResults');
    
    // Show radar
    searchResults.classList.remove('hidden');
    searchResults.innerHTML = `
        <div class="radar-scan">
            <div class="radar-spinner"></div>
            <p>Scanning 10km radius for ${bloodGroup} donors...</p>
        </div>
    `;

    // Simulate API delay
    setTimeout(() => {
        // Generate mock donors
        const mockDonors = [
            { name: "Rahul S.", dist: "1.2 km away", time: "Active 2m ago", lat: 28.5678, lng: 77.2100 },
            { name: "Aman K.", dist: "3.5 km away", time: "Active 15m ago", lat: 28.5800, lng: 77.2200 },
            { name: "Priya Y.", dist: "4.1 km away", time: "Active 1h ago", lat: 28.5500, lng: 77.2300 }
        ];

        let html = `<h4 style="margin-bottom: 15px; text-align: left;">Found 3 Verified Donors:</h4>`;
        
        mockDonors.forEach(donor => {
            html += `
                <div class="donor-card">
                    <div class="donor-info">
                        <p class="name">${donor.name} <span style="font-size: 0.8em; color: var(--text-muted)">(${bloodGroup})</span></p>
                        <p class="dist">📍 ${donor.dist} • ${donor.time}</p>
                    </div>
                    <button class="connect-btn" onclick="showToast('Secure Alert sent to ${donor.name}!')">Alert</button>
                </div>
            `;
        });

        searchResults.innerHTML = html;
        showToast(`Matched with 3 potential donors!`);
        
        // Initialize Map
        const mapDiv = document.getElementById('map');
        mapDiv.classList.remove('hidden');
        
        if (!window.donorMap) {
            window.donorMap = L.map('map').setView([28.5678, 77.2100], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(window.donorMap);
        }
        
        // Add Markers
        mockDonors.forEach(donor => {
            const marker = L.marker([donor.lat, donor.lng]).addTo(window.donorMap);
            marker.bindPopup(`<b>${donor.name}</b><br>${donor.dist}`);
        });

        // Trigger resize so map renders fully inside newly un-hidden div
        setTimeout(() => {
            window.donorMap.invalidateSize();
        }, 100);
    }, 2500);
});

// Donor Registration OTP Mock
document.getElementById('sendOtpBtn').addEventListener('click', () => {
    const phone = document.getElementById('regPhone').value;
    const name = document.getElementById('regName').value;
    
    if(!phone || phone.length < 10 || !name) {
        showToast("Please fill in Name and Phone Number");
        return;
    }

    const btn = document.getElementById('sendOtpBtn');
    btn.textContent = "Sending...";
    btn.style.opacity = "0.7";

    setTimeout(() => {
        btn.textContent = "OTP Sent!";
        btn.style.background = "var(--text-muted)";
        btn.disabled = true;
        
        document.getElementById('otpSection').classList.remove('hidden');
        showToast(`Dev OTP: 1234 sent to ${phone}`);
    }, 1500);
});

document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const otp = document.getElementById('otpCode').value;
    
    if(otp === "1234") {
        showToast("✅ Successfully Registered as a Verified Donor!");
        setTimeout(() => {
            e.target.reset();
            document.getElementById('otpSection').classList.add('hidden');
            const btn = document.getElementById('sendOtpBtn');
            btn.textContent = "Send OTP";
            btn.style.background = "linear-gradient(135deg, var(--primary-red), var(--blood-red))";
            btn.disabled = false;
        }, 2000);
    } else {
        showToast("❌ Invalid OTP. Try 1234");
    }
});
