let currentPoints = 350;

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

function acceptRequest(btnElement, pointsEarned) {
    btnElement.innerHTML = "Accepted ✓";
    btnElement.style.background = "#34C759";
    btnElement.style.pointerEvents = "none";
    btnElement.style.boxShadow = "none";

    currentPoints += pointsEarned;
    updatePointsDisplay();

    showToast(`Heroic! You accepted an emergency. Earned +${pointsEarned} Drops.`);

    setTimeout(() => {
        openChat("Hospital Rep");
    }, 1000);
}

function openChat(name) {
    document.getElementById('chatName').innerText = name;
    document.getElementById('chatModal').classList.add('open');

    const messages = document.getElementById('chatMessages');
    messages.innerHTML = `
        <div class="chat-msg system">Chat started with ${name}. They will see your live location.</div>
        <div class="chat-msg received">Thank you for accepting! How soon can you reach the hospital?</div>
    `;
}

function closeChat() {
    document.getElementById('chatModal').classList.remove('open');
}

const chatForm = document.getElementById('chatForm');
if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        const messages = document.getElementById('chatMessages');
        messages.innerHTML += `<div class="chat-msg sent">${text}</div>`;
        input.value = '';

        messages.scrollTop = messages.scrollHeight;

        setTimeout(() => {
            messages.innerHTML += `<div class="chat-msg received">Got it! We will prepare the paperwork. Drive safely.</div>`;
            messages.scrollTop = messages.scrollHeight;
        }, 2000);
    });
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
    const bg = document.getElementById('userBloodGroup').value;
    const lastDate = document.getElementById('lastDonated').value;
    const conditions = document.getElementById('medicalConditions').value;

    localStorage.setItem('userBloodGroup', bg);

    showToast(`Profile updated! You are matched for ${bg} requests.`);

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
            <button class="btn-primary" style="padding: 8px 15px; font-size: 0.9rem;" onclick="acceptRequest(this, 100)">Accept</button>
        </div>
    `;

    const req2 = `
        <div class="req-item" style="border-left-color: #FF9500;">
            <div>
                <h4 style="color: #FF9500;">${bloodGroup} for Surgery</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${hospital2} • ${dist2} km</p>
            </div>
            <button class="btn-primary" style="padding: 8px 15px; font-size: 0.9rem; background: linear-gradient(135deg, #FF9500, #FFCC00);" onclick="acceptRequest(this, 50)">Accept</button>
        </div>
    `;

    list.innerHTML = req1 + req2;
}

// Initialize button states and load profile on load
document.addEventListener('DOMContentLoaded', () => {
    updatePointsDisplay();

    const savedBg = localStorage.getItem('userBloodGroup');
    if (savedBg) {
        document.getElementById('userBloodGroup').value = savedBg;
        renderTargetedRequests(savedBg);
    }
});