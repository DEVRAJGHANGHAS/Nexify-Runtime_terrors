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

// Store registration data temporarily
let registrationData = {};

// Handle Registration Flow - Send OTP
document.getElementById('getRegOtpBtn')?.addEventListener('click', async () => {
    const mobile = document.getElementById('regMobile').value;
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPassword')?.value;
    const userType = document.querySelector('input[name="userType"]:checked')?.value || 'donor';
    const blood = document.getElementById('regBlood')?.value;
    const age = document.getElementById('regAge')?.value;
    const weight = document.getElementById('regWeight')?.value;
    const city = document.getElementById('regCity')?.value;

    // Basic validation
    if (!name || !mobile || mobile.length < 10) {
        showToast("Please fill all required fields correctly");
        return;
    }

    if (userType === 'donor' && (!blood || !age || !weight)) {
        showToast("Please fill all donor information");
        return;
    }

    // Store registration data
    registrationData = {
        name,
        email: email || `${mobile}@bloodfinder.temp`,
        password: password || Math.random().toString(36).slice(-8),
        phone: mobile,
        userType,
        bloodType: blood,
        age: age ? parseInt(age) : null,
        weight: weight ? parseInt(weight) : null,
        location: { city: city || '' }
    };

    const btn = document.getElementById('getRegOtpBtn');
    btn.innerHTML = `<span class="radar-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-right: 8px; animation-duration: 0.8s;"></span> Sending OTP...`;
    btn.disabled = true;

    try {
        // First register the user (without phone verification)
        const regResponse = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData)
        });

        const regData = await regResponse.json();

        if (!regResponse.ok) {
            throw new Error(regData.message || 'Registration failed');
        }

        // Store user ID for OTP verification
        const userId = regData.user.id;
        localStorage.setItem('tempUserId', userId);
        localStorage.setItem('tempPhone', mobile);

        // Send OTP
        const otpResponse = await fetch('http://localhost:5000/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: mobile,
                userId: userId
            })
        });

        const otpData = await otpResponse.json();

        if (otpData.success) {
            // Redirect to OTP verification page
            const demoOtpParam = otpData.demoOtp ? `&demoOtp=${otpData.demoOtp}` : '';
            window.location.href = `verify-otp.html?phone=${mobile}&userId=${userId}${demoOtpParam}`;
        } else {
            throw new Error(otpData.message || 'Failed to send OTP');
        }

    } catch (error) {
        showToast("❌ " + error.message);
        btn.innerHTML = 'Get OTP on Mobile';
        btn.disabled = false;
    }
});

// Legacy form submission (for fallback)
document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    // This is now handled by the OTP flow above
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
        document.getElementById('step-kyc').classList.add('step-hidden');
        setTimeout(() => {
            document.getElementById('step-success').classList.remove('step-hidden');
        }, 300);
    }, 1500);
});
