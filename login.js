// login.js — Blood Finder Login Logic

// Tab Switching
window.currentLoginType = 'mobile';

window.switchLoginType = function(type) {
    window.currentLoginType = type;
    document.getElementById('tab-mobile').classList.toggle('active', type === 'mobile');
    document.getElementById('tab-email').classList.toggle('active', type === 'email');

    const mobileGroup = document.getElementById('mobileInputGroup');
    const emailGroup = document.getElementById('emailInputGroup');

    if (type === 'mobile') {
        mobileGroup.classList.remove('step-hidden');
        emailGroup.classList.add('step-hidden');
    } else {
        mobileGroup.classList.add('step-hidden');
        emailGroup.classList.remove('step-hidden');
    }
};

// Toast helper (shared)
window.showToast = function(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
};
