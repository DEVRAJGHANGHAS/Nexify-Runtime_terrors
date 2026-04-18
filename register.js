// register.js

// Toast Notification System
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

// Handle Registration Flow
document.getElementById('getRegOtpBtn')?.addEventListener('click', () => {
    const mobile = document.getElementById('regMobile').value;
    const name = document.getElementById('regName').value;
    const blood = document.getElementById('regBlood').value;

    if (!name || !blood || mobile.length < 10) {
        showToast("Please fill all fields correctly");
        return;
    }

    const registeredUsers = JSON.parse(localStorage.getItem('bf_registered_users') || '[]');
    if (registeredUsers.includes(mobile)) {
        showToast('Account already exists. Please log in using your number.');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
        return;
    }

    const btn = document.getElementById('getRegOtpBtn');
    btn.innerHTML = `<span class="radar-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-right: 8px; animation-duration: 0.8s;"></span> Sending OTP...`;
    
    setTimeout(() => {
        btn.classList.add('step-hidden');
        document.getElementById('regOtpGroup').classList.remove('step-hidden');
        document.getElementById('verifyRegBtn').classList.remove('step-hidden');
        
        showToast(`OTP 1234 sent to +91 ${mobile}`);
    }, 1200);
});

document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('verifyRegBtn');
    const otp = document.getElementById('regOtp').value;
    
    if (otp !== "1234") {
        showToast("❌ Invalid OTP. Try 1234");
        return;
    }
    
    btn.innerHTML = `<span class="radar-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-right: 8px; animation-duration: 0.8s;"></span> Verifying...`;
    
    setTimeout(() => {
        showToast("✅ Account Created Successfully! Please verify identity.");
        
        // Transition to KYC/DigiLocker step directly
        document.getElementById('step-register').classList.add('step-hidden');
        setTimeout(() => {
            document.getElementById('step-kyc').classList.remove('step-hidden');
        }, 300);
        
        btn.innerHTML = "Verify & Create Account";
    }, 1500);
});

// DigiLocker Mock Flow
document.getElementById('digilockerBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('digilockerBtn');
    btn.innerHTML = `<span class="radar-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-right: 10px; animation-duration: 0.8s;"></span> Authenticating...`;

    setTimeout(() => {
        const aadharInput = document.getElementById('aadharInput');
        aadharInput.value = "XXXX XXXX 9821";
        aadharInput.style.background = "#E4F1FE";
        aadharInput.style.borderColor = "#0056B3";
        aadharInput.disabled = true;

        btn.innerHTML = `✅ Linked to DigiLocker`;
        btn.style.background = "#E4F1FE";
        btn.style.pointerEvents = "none";

        document.getElementById('verifyAadhaarBtn').style.display = "block";
        showToast("Data retrieved from DigiLocker securely.");
    }, 2000);
});

// Formatting Aadhaar Input (optional manual flow)
document.getElementById('aadharInput')?.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    let formatted = val.match(/.{1,4}/g)?.join(' ') || '';
    e.target.value = formatted;

    if (val.length === 12) {
        document.getElementById('verifyAadhaarBtn').style.display = "block";
    }
});

// Final Verification Step
document.getElementById('verifyAadhaarBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('verifyAadhaarBtn');
    btn.textContent = "Verifying Identity...";

    setTimeout(() => {
        const mobile = document.getElementById('regMobile')?.value || '';
        const name = document.getElementById('regName')?.value || 'Verified User';
        const blood = document.getElementById('regBlood')?.value || 'B+';

        // Add to database
        const db = JSON.parse(localStorage.getItem('bf_database') || '[]');
        if (!db.find(u => u.target === mobile)) {
            db.push({
                target: mobile,
                name: name,
                blood: blood,
                phone: mobile,
                availability: true
            });
            localStorage.setItem('bf_database', JSON.stringify(db));
        }

        const registeredUsers = JSON.parse(localStorage.getItem('bf_registered_users') || '[]');
        if (!registeredUsers.includes(mobile)) {
            registeredUsers.push(mobile);
            localStorage.setItem('bf_registered_users', JSON.stringify(registeredUsers));
        }

        // Set session
        localStorage.setItem('bf_session', JSON.stringify({
            name:      name,
            phone:     mobile,
            blood:     blood,
            verified:  true,
            loginTime: Date.now()
        }));
        localStorage.setItem('userName', name);
        localStorage.setItem('userBloodGroup', blood);
        localStorage.setItem('userMobile', mobile);

        document.getElementById('step-kyc').classList.add('step-hidden');
        setTimeout(() => {
            document.getElementById('step-success').classList.remove('step-hidden');
        }, 300);
    }, 1500);
});
