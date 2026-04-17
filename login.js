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

// Tab Switching (Mobile / Email)
let currentLoginType = 'mobile';
function switchLoginType(type) {
    currentLoginType = type;
    
    // Update tabs
    document.getElementById('tab-mobile').classList.toggle('active', type === 'mobile');
    document.getElementById('tab-email').classList.toggle('active', type === 'email');
    
    // Update inputs
    if(type === 'mobile') {
        document.getElementById('mobileInputGroup').classList.remove('step-hidden');
        document.getElementById('emailInputGroup').classList.add('step-hidden');
    } else {
        document.getElementById('mobileInputGroup').classList.add('step-hidden');
        document.getElementById('emailInputGroup').classList.remove('step-hidden');
    }
}

// Login Flow
document.getElementById('getOtpBtn').addEventListener('click', () => {
    const mobile = document.getElementById('loginMobile').value;
    const email = document.getElementById('loginEmail').value;
    
    if (currentLoginType === 'mobile' && (!mobile || mobile.length < 10)) {
        showToast("Please enter a valid 10-digit mobile number");
        return;
    }
    if (currentLoginType === 'email' && (!email || !email.includes('@'))) {
        showToast("Please enter a valid email address");
        return;
    }

    const btn = document.getElementById('getOtpBtn');
    btn.textContent = "Sending...";
    btn.style.opacity = "0.7";

    setTimeout(() => {
        document.getElementById('getOtpBtn').classList.add('step-hidden');
        document.getElementById('otpGroup').classList.remove('step-hidden');
        document.getElementById('loginBtn').classList.remove('step-hidden');
        
        let target = currentLoginType === 'mobile' ? mobile : email;
        showToast(`OTP 1234 sent to ${target}`);
    }, 1200);
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const otp = document.getElementById('loginOtp').value;
    
    if(otp === "1234") {
        showToast("✅ Login Successful!");
        
        setTimeout(() => {
            // Transition to DigiLocker Step
            document.getElementById('step-login').classList.add('step-hidden');
            setTimeout(() => {
                document.getElementById('step-kyc').classList.remove('step-hidden');
            }, 300);
        }, 1500);
    } else {
        showToast("❌ Invalid OTP. Try 1234");
    }
});

// DigiLocker Mock Flow
document.getElementById('digilockerBtn').addEventListener('click', () => {
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
document.getElementById('aadharInput').addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    let formatted = val.match(/.{1,4}/g)?.join(' ') || '';
    e.target.value = formatted;
    
    if(val.length === 12) {
        document.getElementById('verifyAadhaarBtn').style.display = "block";
    }
});

// Final Verification Step
document.getElementById('verifyAadhaarBtn').addEventListener('click', () => {
    const btn = document.getElementById('verifyAadhaarBtn');
    btn.textContent = "Verifying Identity...";
    
    setTimeout(() => {
        document.getElementById('step-kyc').classList.add('step-hidden');
        setTimeout(() => {
            document.getElementById('step-success').classList.remove('step-hidden');
        }, 300);
    }, 1500);
});
