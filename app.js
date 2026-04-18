// Smart Server URL Detection
const SERVER_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' 
    ? 'http://localhost:3000' 
    : (window.location.protocol === 'file:' ? 'http://localhost:3000' : '');

// Smooth Scrolling for Nav Links
function scrollToSection(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// ── Auth helpers ──
function getSession() {
    try { return JSON.parse(localStorage.getItem('bf_session') || 'null'); }
    catch (e) { return null; }
}
function isLoggedIn() { return !!getSession(); }
function requireLogin() {
    // Show the auth modal if it exists on the page; otherwise redirect directly
    const modal = document.getElementById('authModalOverlay');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        sessionStorage.setItem('bf_redirect', window.location.href);
        window.location.href = 'login.html';
    }
    return false;
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

        // Use navigator.sendBeacon for reliable save even during page unload
        // Fall back to sync XMLHttpRequest if sendBeacon not available
        const blob = new Blob([JSON.stringify(progressData)], { type: 'application/json' });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(SERVER_URL + '/api/user/save-progress', blob);
        } else {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', SERVER_URL + '/api/user/save-progress', false); // sync
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

// ── Guarded donor alert ──
function handleAlert(btn, donorName) {
    if (!isLoggedIn()) { requireLogin(); return; }
    btn.textContent = 'Sending...';
    btn.disabled = true;
    btn.style.opacity = '0.7';
    setTimeout(() => {
        // Change button to Chat button
        btn.innerHTML = '💬 Chat';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.background = '#007AFF'; // iOS blue for chat
        btn.style.color = '#fff';
        btn.style.borderColor = '#007AFF';
        btn.onclick = () => openChat(donorName);
        showToast(`🩸 Secure alert sent to ${donorName}!`);
    }, 1000);
}

// ── Chat System (App / Index) ──
let _currentChatUser = null;

function loadChatHistory(name) {
    const chats = JSON.parse(localStorage.getItem('bf_chats') || '{}');
    return chats[name] || [];
}

function saveChatMessage(name, type, text) {
    const chats = JSON.parse(localStorage.getItem('bf_chats') || '{}');
    if (!chats[name]) {
        chats[name] = [];
    }
    // Don't save duplicate consecutive system messages
    if (type === 'system' && chats[name].length > 0 && chats[name][chats[name].length - 1].type === 'system') {
        return;
    }
    chats[name].push({ type, text, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
    localStorage.setItem('bf_chats', JSON.stringify(chats));

    // Auto-sync chats to database (debounced)
    _debounceSyncChats();
}

// ── Debounced chat sync to DB ──
let _chatSyncTimer = null;
function _debounceSyncChats() {
    clearTimeout(_chatSyncTimer);
    _chatSyncTimer = setTimeout(() => syncChatsToDb(), 2000); // sync 2s after last message
}

function syncChatsToDb() {
    const mobile = localStorage.getItem('userMobile') || '';
    const email = localStorage.getItem('userEmail') || '';
    if (!mobile && !email) return;

    const chats = JSON.parse(localStorage.getItem('bf_chats') || '{}');
    fetch(SERVER_URL + '/api/user/save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mobile, email,
            profile: {
                name:               localStorage.getItem('userName') || '',
                blood_group:        localStorage.getItem('userBloodGroup') || '',
                address:            localStorage.getItem('userAddress') || '',
                last_donated:       localStorage.getItem('lastDonated') || '',
                medical_conditions: localStorage.getItem('medicalConditions') || ''
            },
            chats
        })
    }).then(() => console.log('💾 Chats auto-synced to DB'))
      .catch(() => {}); // silent fail
}

// ── Restore all user progress from DB after login ──
async function restoreUserProgress(mobile, email) {
    try {
        const res = await fetch(SERVER_URL + '/api/user/load-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile, email })
        });
        const data = await res.json();

        if (!data.success) return false;

        // Restore profile to localStorage
        const p = data.profile;
        if (p.name)               localStorage.setItem('userName', p.name);
        if (p.email)              localStorage.setItem('userEmail', p.email);
        if (p.mobile)             localStorage.setItem('userMobile', p.mobile);
        if (p.blood_group)        localStorage.setItem('userBloodGroup', p.blood_group);
        if (p.address)            localStorage.setItem('userAddress', p.address);
        if (p.last_donated)       localStorage.setItem('lastDonated', p.last_donated);
        if (p.medical_conditions) localStorage.setItem('medicalConditions', p.medical_conditions);

        // Restore chats
        if (data.chats && Object.keys(data.chats).length > 0) {
            localStorage.setItem('bf_chats', JSON.stringify(data.chats));
        }

        console.log('✅ All progress restored from database');
        return true;
    } catch (err) {
        console.error('Failed to restore progress:', err);
        return false;
    }
}

let _currentChatMobile = null;
let globalSocket = null;

if (typeof io !== 'undefined') {
    globalSocket = io(SERVER_URL);
    
    // Listen for incoming global chat messages
    globalSocket.on('chat_received', (msgData) => {
        // Save to local storage
        saveChatMessage(msgData.fromName, 'received', msgData.message);
        
        // If we are currently chatting with this person, render it
        if (_currentChatUser === msgData.fromName || _currentChatMobile === msgData.fromMobile) {
            renderChatMessages();
        } else {
            showToast(`💬 New message from ${msgData.fromName}`);
        }
    });

    // Share identity
    setTimeout(() => {
        const mobile = localStorage.getItem('userMobile');
        if (mobile && globalSocket) {
            globalSocket.emit('update_location', {
                mobile: mobile,
                name: localStorage.getItem('userName')
            });
        }
    }, 1000);
}

function openChat(name, mobileNum = '') {
    const modal = document.getElementById('chatModal');
    if (!modal) {
        // Redirect to messages page if modal not on this page
        window.location.href = `messages.html?chat=${encodeURIComponent(name)}`;
        return;
    }

    _currentChatUser = name;
    _currentChatMobile = mobileNum;
    document.getElementById('chatName').innerText = name;
    modal.classList.add('open');

    const messages = document.getElementById('chatMessages');
    messages.innerHTML = '';

    // Load history
    let history = loadChatHistory(name);

    if (history.length === 0) {
        // Initial setup
        const sysMsg = `Chat started with ${name}. They will see your live location.`;
        saveChatMessage(name, 'system', sysMsg);
    }

    renderChatMessages();
}

function renderChatMessages() {
    if (!_currentChatUser) return;
    const messages = document.getElementById('chatMessages');
    if (!messages) return;

    const history = loadChatHistory(_currentChatUser);
    messages.innerHTML = history.map(msg => {
        const prefix = msg.type === 'received' ? `<strong>${_currentChatUser}:</strong> ` : '';
        return `<div class="chat-msg ${msg.type}">${prefix}${msg.text}</div>`;
    }).join('');
    messages.scrollTop = messages.scrollHeight;
}

function closeChat() {
    const modal = document.getElementById('chatModal');
    if (modal) {
        modal.classList.remove('open');
    }
    _currentChatUser = null;
    _currentChatMobile = null;
}

document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chatInput');
            const text = input.value.trim();
            if (!text || !_currentChatUser) return;

            // Display and save locally
            saveChatMessage(_currentChatUser, 'sent', text);
            input.value = '';
            renderChatMessages();

            // Emit to server (if connected)
            if (globalSocket) {
                globalSocket.emit('chat_message', {
                    toMobile: _currentChatMobile || '',
                    toName: _currentChatUser,
                    message: text,
                    fromName: localStorage.getItem('userName') || 'A User',
                    fromMobile: localStorage.getItem('userMobile')
                });
            } else {
                // We are chatting with a mock hospital rep, give mock reply
                setTimeout(() => {
                    saveChatMessage(_currentChatUser, 'received', `Got it! We will prepare the paperwork. Drive safely.`);
                    renderChatMessages();
                }, 2000);
            }
        });
    }
});// Toast Notification System
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

// GPS location handler — real implementation in location.js (BFLocation.handleGpsButton)
// The gpsBtn click listener is wired in index.html inline script after location.js loads.

// Emergency search — real implementation in location.js (BFLocation.search)
// The searchForm submit listener is wired in index.html inline script after location.js loads.

// ── Donor Registration OTP — Real API ────────────────────────
// Active channel/target tracked here so verify knows what to submit
let _otpChannel = 'sms';
let _otpTarget  = '';

document.getElementById('sendOtpBtn')?.addEventListener('click', async () => {
    const phone = document.getElementById('regPhone')?.value?.trim();
    const name  = document.getElementById('regName')?.value?.trim();
    const email = document.getElementById('regEmail')?.value?.trim();

    const target = phone ? phone : email;
    if (!target) { showToast('Please enter your phone number or email'); return; }
    if (!name)   { showToast('Please enter your full name first'); return; }

    // Check if user is already registered
    const registeredUsers = JSON.parse(localStorage.getItem('bf_registered_users') || '[]');
    if (registeredUsers.includes(target)) {
        showToast('Account already exists. Please log in using your number/email.');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
        return;
    }

    const btn = document.getElementById('sendOtpBtn');
    btn.innerHTML = `<span class="radar-spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px;animation-duration:.8s;"></span> Sending...`;
    btn.disabled = true;

    try {
        const res  = await fetch(SERVER_URL + '/api/otp/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: target })
        });
        const data = await res.json();

        if (!data.success) {
            showToast('❌ ' + (data.message || 'Failed to send OTP'));
            btn.innerHTML = 'Send OTP'; btn.disabled = false; return;
        }

        _otpChannel = data.data.channel;
        _otpTarget  = target;

        showToast(`✅ OTP sent via ${_otpChannel === 'email' ? '📧 Email' : '📱 SMS'} to ${data.data.target}`);

        if (data.data.devOtp) {
            const hint = document.getElementById('otpDevHint');
            if (hint) { hint.textContent = `Dev OTP: ${data.data.devOtp}`; hint.style.display = 'block'; }
        }
        if (data.data.previewUrl) {
            const hint = document.getElementById('otpDevHint');
            if (hint) { hint.innerHTML = `📧 <a href="${data.data.previewUrl}" target="_blank" style="color:#D62839;font-weight:600;">Preview Email →</a>`; hint.style.display = 'block'; }
        }

        document.getElementById('otpSection').classList.remove('hidden');
        btn.innerHTML = '✅ Sent — Resend?';
        btn.style.background = 'var(--text-muted)';
        btn.disabled = false;
        btn.onclick = handleResendOtp;
        startResendCountdown(btn);

    } catch {
        showToast('❌ Network error — is the server running?');
        btn.innerHTML = 'Send OTP'; btn.disabled = false;
    }
});

function startResendCountdown(btn) {
    let secs = 60; btn.disabled = true;
    const t = setInterval(() => {
        secs--;
        if (secs <= 0) {
            clearInterval(t);
            btn.innerHTML = '🔄 Resend OTP';
            btn.style.background = 'linear-gradient(135deg, var(--primary-red), var(--blood-red))';
            btn.disabled = false;
            btn.onclick = handleResendOtp;
        } else {
            btn.innerHTML = `Resend in ${secs}s`;
        }
    }, 1000);
}

async function handleResendOtp() {
    const btn = document.getElementById('sendOtpBtn');
    if (!_otpTarget) return;
    btn.innerHTML = 'Resending...'; btn.disabled = true;
    try {
        const res  = await fetch(SERVER_URL + '/api/otp/resend', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: _otpTarget })
        });
        const data = await res.json();
        if (data.success) {
            showToast('✅ OTP resent!');
            if (data.data?.devOtp) {
                const hint = document.getElementById('otpDevHint');
                if (hint) hint.textContent = `Dev OTP: ${data.data.devOtp}`;
            }
            if (data.data?.previewUrl) {
                const hint = document.getElementById('otpDevHint');
                if (hint) hint.innerHTML = `📧 <a href="${data.data.previewUrl}" target="_blank" style="color:#D62839;font-weight:600;">Preview Email →</a>`;
            }
            startResendCountdown(btn);
        } else {
            showToast('⏳ ' + (data.message || 'Please wait before resending'));
            btn.innerHTML = '🔄 Resend OTP'; btn.disabled = false;
        }
    } catch {
        showToast('❌ Resend failed'); btn.innerHTML = '🔄 Resend OTP'; btn.disabled = false;
    }
}

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code  = document.getElementById('otpCode')?.value?.trim();
    const name  = document.getElementById('regName')?.value?.trim();
    const blood = document.getElementById('regBg')?.value;
    const phone = document.getElementById('regPhone')?.value?.trim();
    const avail = document.getElementById('regAvailability')?.checked;
    const submitBtns = e.target.querySelectorAll('[type=submit]');

    if (!code || code.length < 4) { showToast('❌ Enter the OTP code'); return; }

    submitBtns.forEach(b => { b.innerHTML = 'Verifying...'; b.disabled = true; });

    try {
        const verifyRes  = await fetch(SERVER_URL + '/api/otp/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: _otpTarget || phone, code })
        });
        const verifyData = await verifyRes.json();

        if (!verifyData.success) {
            showToast('❌ ' + (verifyData.message || 'Invalid OTP'));
            submitBtns.forEach(b => { b.innerHTML = 'Verify & Register →'; b.disabled = false; });
            return;
        }

        // Store session
        const token = verifyData.data.token;
        localStorage.setItem('bf_token', token);
        localStorage.setItem('bf_session', JSON.stringify(verifyData.data.user));

        // Register as donor
        if (blood) {
            fetch(SERVER_URL + '/api/donors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ bloodType: blood, name, availability: avail !== false })
            }).catch(() => {});
        }

        // Add to registered users list locally to simulate account creation
        const registeredUsers = JSON.parse(localStorage.getItem('bf_registered_users') || '[]');
        if (!registeredUsers.includes(_otpTarget || phone)) {
            registeredUsers.push(_otpTarget || phone);
            localStorage.setItem('bf_registered_users', JSON.stringify(registeredUsers));

            // Save to robust db
            const db = JSON.parse(localStorage.getItem('bf_database') || '[]');
            db.push({
                target: _otpTarget || phone,
                name: name,
                blood: blood,
                phone: phone,
                availability: avail
            });
            localStorage.setItem('bf_database', JSON.stringify(db));
        }

        showToast('✅ Verified & Registered as a Blood Donor! 🩸');
        setTimeout(() => {
            e.target.reset();
            document.getElementById('otpSection').classList.add('hidden');
            const sendBtn = document.getElementById('sendOtpBtn');
            if (sendBtn) { sendBtn.innerHTML = 'Send OTP'; sendBtn.style.background = ''; sendBtn.disabled = false; sendBtn.onclick = null; }
            const hint = document.getElementById('otpDevHint');
            if (hint) hint.style.display = 'none';
        }, 2500);

    } catch {
        showToast('❌ Network error — is the server running?');
        submitBtns.forEach(b => { b.innerHTML = 'Verify & Register →'; b.disabled = false; });
    }
});

