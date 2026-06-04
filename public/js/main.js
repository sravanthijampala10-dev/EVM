// Global variables
let currentStep = 1;
let selectedCandidate = null;
let voterAadhar = '';
let fingerprintHash = '';
let voterName = '';
let isSubmitting = false;

// DOM Elements
const stepElements = {
    1: document.getElementById('step1'),
    2: document.getElementById('step2'),
    3: document.getElementById('step3'),
    4: document.getElementById('step4')
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    loadCandidates();
    updateStats();
    setInterval(updateStats, 5000); // Update stats every 5 seconds

    // Initialize analytics if on dashboard
    if (window.location.pathname.includes('/dashboard')) {
        window.analytics = new VotingAnalytics();
    }
});

// Navigation between steps
function showStep(step) {
    // Hide all steps
    Object.values(stepElements).forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });

    // Show current step
    if (stepElements[step]) {
        stepElements[step].style.display = 'block';
        setTimeout(() => {
            stepElements[step].classList.add('active');
        }, 10);
    }

    currentStep = step;
}

function nextStep() {
    if (currentStep < 4) {
        showStep(currentStep + 1);
    }
}

function previousStep(fromStep) {
    if (fromStep > 1) {
        showStep(fromStep - 1);
    }
}

// Step 1: Aadhar Verification
async function verifyAadhar() {
    const aadharInput = document.getElementById('aadharNumber');
    const errorElement = document.getElementById('aadharError');
    const aadharNumber = aadharInput.value.trim();

    // Clear previous errors
    errorElement.textContent = '';

    // Validation
    if (!aadharNumber) {
        errorElement.textContent = 'Please enter Aadhar number';
        showNotification('Please enter Aadhar number', 'error');
        return;
    }

    if (!/^\d{12}$/.test(aadharNumber)) {
        errorElement.textContent = 'Aadhar must be 12 digits';
        showNotification('Aadhar must be 12 digits', 'error');
        return;
    }

    // Show loading
    const verifyBtn = event.target;
    const originalText = verifyBtn.textContent;
    verifyBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Verifying...
    `;
    verifyBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ aadharNumber })
        });

        const data = await response.json();

        if (data.success) {
            voterAadhar = aadharNumber;
            voterName = data.user.name;

            // Store in session for re-verification
            sessionStorage.setItem('voterAadhar', aadharNumber);
            sessionStorage.setItem('voterName', data.user.name);

            // Show success notification
            showNotification(`Welcome ${data.user.name}! Aadhar verified successfully.`, 'success');

            // Show Register Biometric Button
            const bioBtn = document.getElementById('biometricRegisterBtn');
            if (bioBtn) bioBtn.style.display = 'inline-block';

            // Proceed to next step after delay
            setTimeout(() => {
                nextStep();
            }, 1000);

        } else {
            errorElement.textContent = data.message || 'Verification failed';
            showNotification(data.message || 'Aadhar verification failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        errorElement.textContent = 'Server error. Please try again.';
        showNotification('Server error. Please try again.', 'error');
    } finally {
        verifyBtn.textContent = originalText;
        verifyBtn.disabled = false;
    }
}

// Step 2: Load Candidates
async function loadCandidates() {
    try {
        const response = await fetch('/api/vote/candidates');
        const data = await response.json();

        const container = document.getElementById('candidatesContainer');
        container.innerHTML = '';

        data.candidates.forEach(candidate => {
            const candidateCard = document.createElement('div');
            candidateCard.className = 'candidate-card';
            candidateCard.innerHTML = `
                <div class="candidate-symbol">${candidate.symbol?.charAt(0) || '?'}</div>
                <div class="candidate-name">${candidate.name}</div>
                <div class="candidate-party">${candidate.party}</div>
                <div class="candidate-votes">Votes: ${candidate.votes || 0}</div>
            `;

            candidateCard.onclick = () => selectCandidate(candidate);
            container.appendChild(candidateCard);
        });
    } catch (error) {
        console.error('Error loading candidates:', error);
        showNotification('Failed to load candidates. Please refresh.', 'error');
    }
}

function selectCandidate(candidate) {
    selectedCandidate = candidate;

    // Remove selected class from all cards
    document.querySelectorAll('.candidate-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selected class to clicked card
    event.target.closest('.candidate-card').classList.add('selected');

    // Show notification
    showNotification(`Selected: ${candidate.name} (${candidate.party})`, 'success');

    // Auto proceed to next step after 1 second
    setTimeout(() => {
        nextStep();
    }, 1000);
}

// --- New Biometric Functions ---

function switchScanner(type) {
    // Update tabs
    document.querySelectorAll('.btn-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(type));
    });

    // Update views
    document.querySelectorAll('.scanner-view').forEach(view => {
        view.classList.toggle('active', view.id === `${type}View`);
    });

    // Stop camera if switching away from face
    if (type !== 'face' && window.cameraStream) {
        window.cameraStream.getTracks().forEach(track => track.stop());
        window.cameraStream = null;
    }

    // Reset status
    const status = document.getElementById('biometricStatus');
    status.textContent = '';
    status.className = 'biometric-status';
}

// --- USB RD Service Simulation ---

async function discoverUSBDevice() {
    const statusText = document.getElementById('usbStatusText');
    const statusIcon = document.getElementById('usbStatusIcon');
    const btnDiscover = document.getElementById('btnDiscover');
    const deviceInfo = document.getElementById('usbDeviceInfo');
    const btnCapture = document.getElementById('btnCapture');

    btnDiscover.disabled = true;
    btnDiscover.textContent = 'Discovering...';
    statusText.textContent = 'Scanning local RD Service ports (11100-11105)...';
    statusIcon.textContent = '🛰️';

    try {
        // Simulate network delay for RD Service handshake
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Randomly simulate success or "Not Found"
        const success = Math.random() > 0.1;

        if (success) {
            statusIcon.textContent = '✅';
            statusText.textContent = 'Device found and ready!';
            document.getElementById('usbStatusTitle').textContent = 'Mantra MFS100 Connected';
            deviceInfo.style.display = 'block';
            btnCapture.style.display = 'inline-block';
            btnDiscover.style.display = 'none';
            showNotification('USB Biometric Device Connected', 'success');
        } else {
            throw new Error('RD Service not found. Is Mantra/Morpho driver installed?');
        }
    } catch (error) {
        statusIcon.textContent = '❌';
        statusText.textContent = error.message;
        btnDiscover.disabled = false;
        btnDiscover.textContent = 'Retry Discovery';
        showNotification(error.message, 'error');
    }
}

async function captureFingerprintUSB() {
    const statusElement = document.getElementById('biometricStatus');
    const captureBtn = document.getElementById('btnCapture');

    captureBtn.disabled = true;
    captureBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Capturing...`;
    statusElement.textContent = 'Please place your finger on the USB scanner...';
    statusElement.className = 'biometric-status scanning';

    try {
        // Simulate high-quality biometric capture
        await new Promise(resolve => setTimeout(resolve, 3000));

        fingerprintHash = 'USB_RD_' + Date.now() + '_' + btoa(voterAadhar || 'temp').substr(0, 10);

        statusElement.textContent = 'Fingerprint Captured Successfully!';
        statusElement.className = 'biometric-status success';
        captureBtn.innerHTML = 'Captured <span class="check-icon">✓</span>';
        captureBtn.className = 'btn-success';

        // Update confirmation
        document.getElementById('confirmAadhar').textContent = voterAadhar || sessionStorage.getItem('voterAadhar');
        document.getElementById('confirmCandidate').textContent = selectedCandidate.name;
        document.getElementById('confirmTime').textContent = new Date().toLocaleString();

        showNotification('USB Biometric Capture Successful!', 'success');

        setTimeout(() => {
            nextStep();
        }, 1500);

    } catch (error) {
        statusElement.textContent = 'Capture Failed: ' + error.message;
        statusElement.className = 'biometric-status error';
        captureBtn.disabled = false;
        captureBtn.innerHTML = 'Retry Capture';
    }
}

async function activateCamera() {
    const video = document.getElementById('faceVideo');
    if (window.cameraStream) return true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 }
        });
        window.cameraStream = stream;
        video.srcObject = stream;
        return true;
    } catch (error) {
        console.error('Camera error:', error);
        showNotification('Camera access denied. Please allow camera to use Face ID.', 'error');
        return false;
    }
}

async function scanFace() {
    const statusElement = document.getElementById('biometricStatus');
    const scanBtn = event.target;

    const hasCamera = await activateCamera();
    if (!hasCamera) return;

    scanBtn.disabled = true;
    scanBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Scanning Face...
    `;
    statusElement.textContent = 'Scanning... Keep your face still.';
    statusElement.className = 'biometric-status scanning';

    try {
        // Simulate a real face scan (Wait 3 seconds for effect)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // In a real system, we'd take a snapshot and verify it
        // and link it to the WebAuthn flow or a custom API.
        // For this demo, we'll "verify" the user successfully.

        fingerprintHash = 'FACE_ID_' + Date.now() + '_' + btoa(voterAadhar).substr(0, 10);

        statusElement.textContent = 'Face Recognized Successfully!';
        statusElement.className = 'biometric-status success';
        scanBtn.innerHTML = 'Verified <span class="check-icon">✓</span>';
        scanBtn.className = 'btn-success';

        // Update confirmation details (same as fingerprint)
        document.getElementById('confirmAadhar').textContent = voterAadhar;
        document.getElementById('confirmCandidate').textContent = selectedCandidate.name;
        document.getElementById('confirmTime').textContent = new Date().toLocaleString();

        showNotification('Face ID Verification Successful!', 'success');

        setTimeout(() => {
            nextStep();
        }, 1500);

    } catch (error) {
        statusElement.textContent = 'Face Scan Failed: ' + (error.message || 'Unknown error');
        statusElement.className = 'biometric-status error';
        scanBtn.innerHTML = 'Retry Face Scan';
        scanBtn.disabled = false;
        scanBtn.className = 'btn-primary';
    }
}

async function simulateDemoScan() {
    const statusElement = document.getElementById('biometricStatus');
    const scanBtn = event.target;

    scanBtn.disabled = true;
    scanBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Simulating...
    `;
    statusElement.textContent = 'Demo Mode: Simulating secure verification...';
    statusElement.className = 'biometric-status scanning';

    try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        fingerprintHash = 'DEMO_MODE_' + Date.now();

        statusElement.textContent = 'Demo Verification Successful!';
        statusElement.className = 'biometric-status success';
        scanBtn.innerHTML = 'Verified <span class="check-icon">✓</span>';
        scanBtn.className = 'btn-success';

        document.getElementById('confirmAadhar').textContent = voterAadhar;
        document.getElementById('confirmCandidate').textContent = selectedCandidate.name;
        document.getElementById('confirmTime').textContent = new Date().toLocaleString();

        showNotification('Demo Verification Successful!', 'success');

        setTimeout(() => {
            nextStep();
        }, 1500);

    } catch (error) {
        statusElement.textContent = 'Simulation Failed';
        statusElement.className = 'biometric-status error';
        scanBtn.disabled = false;
    }
}

// Step 3: Real Biometric Scan (WebAuthn)
async function simulateFingerprint() {
    const statusElement = document.getElementById('biometricStatus');
    const scanBtn = event.target;

    // 1. Check if user is registered (We can infer this if they can generate options, or we could check explicitly)
    // For now, we just try to verify.

    scanBtn.disabled = true;
    scanBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Active Sensor...
    `;
    statusElement.textContent = 'Please touch your fingerprint scanner...';
    statusElement.className = 'biometric-status scanning';

    try {
        // CALL REAL BIOMETRIC CLIENT
        const result = await verifyBiometricForVote();

        if (result.verified) {
            // Generate a hash based on the credential ID to link the vote
            fingerprintHash = 'REAL_BIO_' + Date.now() + '_' + btoa(voterAadhar).substr(0, 10);

            statusElement.textContent = 'Identity Verified Successfully!';
            statusElement.className = 'biometric-status success';
            scanBtn.innerHTML = 'Verified <span class="check-icon">✓</span>';
            scanBtn.className = 'btn-success';

            // Update confirmation details
            document.getElementById('confirmVoterName').textContent = voterName || 'Authenticated User';
            document.getElementById('confirmAadhar').textContent = voterAadhar;
            document.getElementById('confirmCandidate').textContent = selectedCandidate.name;
            document.getElementById('confirmParty').textContent = selectedCandidate.party;
            document.getElementById('confirmTime').textContent = new Date().toLocaleString();

            // Show success
            showNotification('Biometric Verification Successful!', 'success');

            // Auto proceed
            setTimeout(() => {
                nextStep();
            }, 1500);

        } else {
            throw new Error('Verification failed on server');
        }

    } catch (error) {
        console.error('Biometric error:', error);
        statusElement.textContent = 'Scan Failed: ' + (error.message || 'Unknown error');
        statusElement.className = 'biometric-status error';
        scanBtn.innerHTML = 'Retry Scan';
        scanBtn.disabled = false;
        scanBtn.className = 'btn-primary';

        if (error.message.includes('not allowed') || error.name === 'NotAllowedError') {
            showNotification('Hardware scan timed out or cancelled. Try Demo Scanner or Face ID.', 'warning');
            statusElement.innerHTML = `
                <div style="color: #f72585;">Hardware access denied or timed out.</div>
                <div style="margin-top: 5px; font-size: 0.85em;">
                    Tip: Try <a href="#" onclick="switchScanner('demo'); return false;" style="color: #4361ee; text-decoration: underline;">Demo Scanner</a> for a hardware-free simulation.
                </div>
            `;
        } else if (error.message.includes('Voter Aadhar not found')) {
            showNotification('Please verify Aadhar first.', 'error');
        } else {
            showNotification('Verification failed. Have you registered this device?', 'warning');
            // Show register button tip
            const bioBtn = document.getElementById('biometricRegisterBtn');
            if (bioBtn) {
                bioBtn.style.display = 'inline-block';
                bioBtn.classList.add('pulse-animation'); // Optional visual cue
            }
        }
    }
}

function generateSecureFingerprintHash() {
    // Generate a more realistic fingerprint hash
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 16);
    const voterSegment = voterAadhar ? voterAadhar.substr(-4) : '0000';

    // Create a hash-like string
    return `FP_${timestamp}_${random}_${voterSegment}_${btoa(voterAadhar + timestamp).substr(0, 16)}`;
}

async function submitVote() {
    // ... existing submit vote code ...

    if (data.success) {
        // ... existing success code ...

        // Force analytics update
        if (window.analytics && typeof window.analytics.refreshData === 'function') {
            setTimeout(() => {
                window.analytics.refreshData();
            }, 2000); // Wait 2 seconds for database to update
        }

        // Also update dashboard if open
        if (window.location.pathname.includes('/dashboard')) {
            setTimeout(() => {
                if (typeof updateDashboard === 'function') {
                    updateDashboard();
                }
            }, 2000);
        }
    }
}

// Step 4: Submit Vote - FIXED VERSION
async function submitVote() {
    console.log('Submit Vote function called');

    // Prevent multiple submissions
    if (isSubmitting) {
        console.log('Already submitting, please wait...');
        showNotification('Please wait... Processing previous submission.', 'warning');
        return;
    }

    // Validate all data
    if (!selectedCandidate || !voterAadhar || !fingerprintHash) {
        showNotification('Please complete all steps before submitting', 'error');
        return;
    }

    // Get the submit button
    const submitBtn = document.querySelector('.btn-success') || event.target;
    if (!submitBtn) {
        console.error('Submit button not found');
        showNotification('System error: Could not find submit button', 'error');
        return;
    }

    // Store original button state
    const originalText = submitBtn.textContent;
    const originalHTML = submitBtn.innerHTML;

    // Show loading state
    submitBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Submitting...
    `;
    submitBtn.disabled = true;
    isSubmitting = true;

    // Show processing animation
    showProcessingAnimation();

    try {
        console.log('Sending vote submission request...');
        console.log('Data:', {
            aadharNumber: voterAadhar,
            candidateId: selectedCandidate.id,
            fingerprintHash: fingerprintHash,
            candidateName: selectedCandidate.name,
            party: selectedCandidate.party
        });

        // Send vote submission request
        const response = await fetch('/api/vote/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                aadharNumber: voterAadhar,
                candidateId: selectedCandidate.id,
                fingerprintHash: fingerprintHash,
                candidateName: selectedCandidate.name,
                party: selectedCandidate.party
            })
        });

        console.log('Response status:', response.status);

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response');
        }

        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            // Show success animation
            showSuccessAnimation();

            // Hide voting steps
            document.querySelectorAll('.voting-step').forEach(step => {
                step.style.display = 'none';
            });

            // Show success message
            const successMessage = document.getElementById('successMessage');
            if (successMessage) {
                successMessage.style.display = 'block';
            }

            // Update dashboard stats
            updateStats();

            // Force dashboard update
            await triggerDashboardUpdate();

            // Add vote record to local storage (for demo)
            const voteRecord = {
                aadhar: voterAadhar,
                candidate: selectedCandidate.name,
                party: selectedCandidate.party,
                timestamp: new Date().toISOString(),
                voteId: data.voteId || generateVoteId()
            };

            // Store in localStorage for demo
            const voteHistory = JSON.parse(localStorage.getItem('voteHistory') || '[]');
            voteHistory.push(voteRecord);
            localStorage.setItem('voteHistory', JSON.stringify(voteHistory));

            // Update verification bar
            await verifyAadharAgainManual(voterAadhar);

            // Show success notification
            showNotification('Vote submitted successfully!', 'success');

            // Log to console for debugging
            console.log('Vote submitted successfully:', voteRecord);

        } else {
            // Show error message
            console.error('Vote submission failed:', data.message);

            // Re-enable step 4 to try again
            showStep(4);

            // Show error notification
            showNotification(data.message || 'Failed to submit vote. Please try again.', 'error');
        }

    } catch (error) {
        console.error('Error submitting vote:', error);

        // Show error message
        showNotification(
            `Server error: ${error.message || 'Please check your connection and try again.'}`,
            'error'
        );

        // Re-enable step 4 to try again
        showStep(4);

    } finally {
        // Restore button state
        submitBtn.innerHTML = originalHTML;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        isSubmitting = false;

        // Hide processing animation
        hideProcessingAnimation();
    }
}

// Helper Functions
function generateVoteId() {
    return 'VOTE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showProcessingAnimation() {
    // Create processing overlay
    const overlay = document.createElement('div');
    overlay.id = 'processingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        color: white;
    `;

    overlay.innerHTML = `
        <div class="processing-spinner"></div>
        <h3 style="margin-top: 20px; color: white;">Processing Your Vote</h3>
        <p style="color: #ccc; margin-top: 10px;">Please wait while we secure your vote...</p>
    `;

    document.body.appendChild(overlay);

    // Add CSS for spinner
    const style = document.createElement('style');
    style.textContent = `
        .processing-spinner {
            width: 60px;
            height: 60px;
            border: 5px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #4cc9f0;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

function hideProcessingAnimation() {
    const overlay = document.getElementById('processingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

function showSuccessAnimation() {
    // Create success animation
    const successOverlay = document.createElement('div');
    successOverlay.id = 'successOverlay';
    successOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10001;
        animation: fadeIn 0.3s ease-out;
    `;

    successOverlay.innerHTML = `
        <div class="success-checkmark">
            <div class="check-icon">
                <span class="icon-line line-tip"></span>
                <span class="icon-line line-long"></span>
                <div class="icon-circle"></div>
                <div class="icon-fix"></div>
            </div>
        </div>
        <h3 style="color: white; margin-top: 30px; font-size: 1.8rem;">Vote Submitted Successfully!</h3>
        <p style="color: #4cc9f0; margin-top: 10px;">Your vote has been recorded securely.</p>
        <div class="confetti-container"></div>
    `;

    document.body.appendChild(successOverlay);

    // Add CSS for checkmark
    const style = document.createElement('style');
    style.textContent = `
        .success-checkmark {
            width: 80px;
            height: 115px;
            margin: 0 auto;
        }
        .check-icon {
            width: 80px;
            height: 80px;
            position: relative;
            border-radius: 50%;
            box-sizing: content-box;
            border: 4px solid #4cc9f0;
        }
        .icon-line {
            height: 5px;
            background-color: #4cc9f0;
            display: block;
            border-radius: 2px;
            position: absolute;
            z-index: 10;
        }
        .line-tip {
            top: 46px;
            left: 14px;
            width: 25px;
            transform: rotate(45deg);
            animation: icon-line-tip 0.75s;
        }
        .line-long {
            top: 38px;
            right: 8px;
            width: 47px;
            transform: rotate(-45deg);
            animation: icon-line-long 0.75s;
        }
        .icon-circle {
            top: -4px;
            left: -4px;
            z-index: 10;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            position: absolute;
            box-sizing: content-box;
            border: 4px solid rgba(76, 201, 240, 0.5);
        }
        @keyframes icon-line-tip {
            0% { width: 0; left: 1px; top: 19px; }
            54% { width: 0; left: 1px; top: 19px; }
            70% { width: 50px; left: -8px; top: 37px; }
            84% { width: 17px; left: 21px; top: 48px; }
            100% { width: 25px; left: 14px; top: 45px; }
        }
        @keyframes icon-line-long {
            0% { width: 0; right: 46px; top: 54px; }
            65% { width: 0; right: 46px; top: 54px; }
            84% { width: 55px; right: 0px; top: 35px; }
            100% { width: 47px; right: 8px; top: 38px; }
        }
    `;
    document.head.appendChild(style);

    // Create confetti
    createConfetti();

    // Remove overlay after 3 seconds
    setTimeout(() => {
        if (successOverlay) {
            successOverlay.remove();
        }
    }, 3000);
}

function createConfetti() {
    const colors = ['#4361ee', '#3a0ca3', '#4cc9f0', '#f72585', '#f8961e'];
    const container = document.querySelector('.confetti-container');

    if (!container) return;

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confetti.style.width = Math.random() * 10 + 5 + 'px';
        confetti.style.height = Math.random() * 20 + 10 + 'px';
        confetti.style.position = 'absolute';
        confetti.style.animation = `confettiFall ${Math.random() * 3 + 2}s linear forwards`;

        container.appendChild(confetti);
    }

    // Add confetti animation
    const confettiStyle = document.createElement('style');
    confettiStyle.textContent = `
        @keyframes confettiFall {
            0% {
                transform: translateY(-100px) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(confettiStyle);
}

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.getElementById('voteNotification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'voteNotification';
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#38b000' : type === 'error' ? '#f72585' : type === 'warning' ? '#f8961e' : '#4361ee'};
        color: white;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10002;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    notification.innerHTML = `
        <span style="font-size: 1.2rem;">${icon}</span>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    // Add animation styles if not present
    if (!document.querySelector('#notificationStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationStyles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            .spinner-border {
                display: inline-block;
                width: 1rem;
                height: 1rem;
                vertical-align: text-bottom;
                border: 0.25em solid currentColor;
                border-right-color: transparent;
                border-radius: 50%;
                animation: spinner-border .75s linear infinite;
            }
            @keyframes spinner-border {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Reset voting process
function resetVoting() {
    currentStep = 1;
    selectedCandidate = null;
    voterAadhar = '';
    fingerprintHash = '';
    voterName = '';
    isSubmitting = false;

    // Reset UI
    document.getElementById('successMessage').style.display = 'none';
    document.getElementById('aadharNumber').value = '';
    document.getElementById('verifyAadhar').value = '';
    document.getElementById('verificationResult').innerHTML = '';

    // Clear selections
    document.querySelectorAll('.candidate-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Reset biometric status
    const biometricStatus = document.getElementById('biometricStatus');
    if (biometricStatus) {
        biometricStatus.textContent = '';
        biometricStatus.className = 'biometric-status';
    }

    showStep(1);
    showNotification('Voting process reset. You can vote again.', 'info');
}

// Aadhar Re-verification
async function verifyAadharAgain() {
    const verifyInput = document.getElementById('verifyAadhar');
    const resultElement = document.getElementById('verificationResult');
    const aadharNumber = verifyInput.value.trim();

    if (!aadharNumber || !/^\d{12}$/.test(aadharNumber)) {
        resultElement.textContent = 'Please enter valid 12-digit Aadhar';
        resultElement.className = 'verification-result error';
        return;
    }

    try {
        const response = await fetch('/api/auth/check-vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ aadharNumber })
        });

        const data = await response.json();

        if (data.success) {
            if (data.hasVoted) {
                resultElement.innerHTML = `
                    <div class="success">✅ Vote Verified</div>
                    <small>This Aadhar has already voted for ${data.candidateName}</small>
                `;
                resultElement.className = 'verification-result success';

                // Check for rigging
                await checkForRigging(aadharNumber);
            } else {
                resultElement.innerHTML = `
                    <div class="error">❌ Vote Not Found</div>
                    <small>Potential vote rigging detected!</small>
                `;
                resultElement.className = 'verification-result error';
                showNotification('Potential vote rigging detected!', 'warning');
            }
        } else {
            resultElement.textContent = 'Verification failed';
            resultElement.className = 'verification-result error';
        }
    } catch (error) {
        console.error('Error:', error);
        resultElement.textContent = 'Server error';
        resultElement.className = 'verification-result error';
    }
}

// Manual verification function
async function verifyAadharAgainManual(aadharNumber) {
    const resultElement = document.getElementById('verificationResult');
    if (!resultElement) return;

    try {
        const response = await fetch('/api/auth/check-vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadharNumber })
        });

        const data = await response.json();

        if (data.success) {
            if (data.hasVoted) {
                resultElement.innerHTML = `
                    <div class="success">✅ Vote Verified</div>
                    <small>This Aadhar has already voted for ${data.candidateName}</small>
                `;
                resultElement.className = 'verification-result success';
            } else {
                resultElement.innerHTML = `
                    <div class="error">❌ Vote Not Found</div>
                    <small>Potential vote rigging detected!</small>
                `;
                resultElement.className = 'verification-result error';
            }
        }
    } catch (error) {
        console.error('Verification error:', error);
    }
}

// Check for rigging after verification
async function checkForRigging(aadharNumber) {
    try {
        const response = await fetch('/api/dashboard/data');
        const data = await response.json();

        if (data.success) {
            const riggingScale = data.stats.riggingScale;
            console.log(`⚠️ Current Rigging Scale: ${riggingScale}%`);

            // Show alert if rigging scale is high
            if (riggingScale > 20) {
                showNotification(`⚠️ Vote Rigging Alert: ${riggingScale}% risk detected`, 'warning');
            }
        }
    } catch (error) {
        console.error('Rigging check error:', error);
    }
}

// In the verifyAadhar function in main.js, add this:

async function verifyAadhar() {
    const aadharInput = document.getElementById('aadharNumber');
    const errorElement = document.getElementById('aadharError');
    const aadharNumber = aadharInput.value.trim();

    // Clear previous errors
    errorElement.textContent = '';

    // Validation
    if (!aadharNumber) {
        errorElement.textContent = 'Please enter Aadhar number';
        return;
    }

    if (!/^\d{12}$/.test(aadharNumber)) {
        errorElement.textContent = 'Aadhar must be 12 digits';
        return;
    }

    // Show loading
    const verifyBtn = event.target;
    const originalText = verifyBtn.textContent;
    verifyBtn.textContent = 'Verifying...';
    verifyBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ aadharNumber })
        });

        const data = await response.json();

        if (data.success) {
            voterAadhar = aadharNumber;
            // Store in session for re-verification
            sessionStorage.setItem('voterAadhar', aadharNumber);
            nextStep();
        } else {
            // Log fraud attempt for duplicate Aadhar
            if (data.message && data.message.includes('already voted')) {
                await logFraudAttempt({
                    type: 'duplicate_aadhar_attempt',
                    aadharNumber: aadharNumber,
                    description: `Attempt to vote again with Aadhar: ${aadharNumber}`
                });

                // Trigger dashboard refresh
                triggerFraudDetection();
            }

            errorElement.textContent = data.message || 'Verification failed';
        }
    } catch (error) {
        console.error('Error:', error);
        errorElement.textContent = 'Server error. Please try again.';
    } finally {
        verifyBtn.textContent = originalText;
        verifyBtn.disabled = false;
    }
}

// Add these new functions to main.js:

// Log fraud attempt
async function logFraudAttempt(fraudData) {
    try {
        const response = await fetch('/api/dashboard/log-fraud', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fraudData)
        });

        const data = await response.json();
        if (data.success) {
            console.log('✅ Fraud attempt logged:', fraudData.type);
        }
    } catch (error) {
        console.error('Error logging fraud attempt:', error);
    }
}

// Trigger fraud detection update
function triggerFraudDetection() {
    // Force dashboard to refresh fraud metrics
    if (window.location.pathname.includes('dashboard')) {
        // If we're on dashboard page, refresh it
        updateDashboard();
    } else {
        // If we're on home page, send a signal to dashboard
        broadcastFraudDetection();
    }
}

// Broadcast fraud detection to dashboard
function broadcastFraudDetection() {
    // Use localStorage to communicate between tabs
    const fraudEvent = {
        type: 'fraud_detected',
        timestamp: Date.now(),
        message: 'Duplicate Aadhar attempt detected'
    };

    localStorage.setItem('fraudEvent', JSON.stringify(fraudEvent));

    // Also trigger event for dashboard iframe (if used)
    window.dispatchEvent(new CustomEvent('fraudDetected', {
        detail: fraudEvent
    }));
}

// Update dashboard stats
async function updateStats() {
    try {
        const response = await fetch('/api/dashboard/stats');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.success) {
            // Update home page stats
            const totalVotesElement = document.getElementById('totalVotes');
            const registeredVotersElement = document.getElementById('registeredVoters');

            if (totalVotesElement) {
                totalVotesElement.textContent = data.totalVotes || 0;
                animateCounter('totalVotes', data.totalVotes || 0);
            }

            if (registeredVotersElement) {
                registeredVotersElement.textContent = data.registeredVoters || 0;
                animateCounter('registeredVoters', data.registeredVoters || 0);
            }

            // Update dashboard if we're on dashboard page
            if (window.location.pathname.includes('/dashboard') && window.analytics) {
                window.analytics.updateStats();
            }
        } else {
            console.warn('Failed to update stats:', data.message);
        }
    } catch (error) {
        console.error('Error updating stats:', error);
        // Fallback to random data for demo
        const randomVotes = Math.floor(Math.random() * 1000) + 1000;
        const randomVoters = Math.floor(Math.random() * 5000) + 5000;

        const totalVotesElement = document.getElementById('totalVotes');
        const registeredVotersElement = document.getElementById('registeredVoters');

        if (totalVotesElement) {
            totalVotesElement.textContent = randomVotes;
        }
        if (registeredVotersElement) {
            registeredVotersElement.textContent = randomVoters;
        }
    }
}

// Function to force dashboard update after voting
async function triggerDashboardUpdate() {
    console.log('🔄 Triggering dashboard update...');

    // If on dashboard page, refresh data
    if (window.location.pathname.includes('/dashboard')) {
        try {
            // Force update dashboard
            if (typeof updateDashboard === 'function') {
                await updateDashboard();
            }
        } catch (error) {
            console.error('Dashboard update error:', error);
        }
    } else {
        // If on home page, update stats
        await updateStats();
    }

    // Also update the verification bar result
    if (voterAadhar) {
        await verifyAadharAgainManual(voterAadhar);
    }
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const currentValue = parseInt(element.textContent.replace(/,/g, '')) || 0;

    if (currentValue === targetValue) return;

    const increment = targetValue > currentValue ? 1 : -1;
    let current = currentValue;

    const timer = setInterval(() => {
        current += increment;
        element.textContent = current.toLocaleString();

        if (current === targetValue) {
            clearInterval(timer);
        }
    }, 50);
}

// Add CSS for enhanced styles
document.head.insertAdjacentHTML('beforeend', `
    <style>
        .biometric-status {
            padding: 15px;
            border-radius: 10px;
            font-weight: 500;
            text-align: center;
            margin-top: 20px;
            transition: all 0.3s ease;
        }
        
        .biometric-status.scanning {
            background: rgba(248, 150, 30, 0.2);
            color: var(--warning-color);
            border: 2px solid rgba(248, 150, 30, 0.3);
        }
        
        .biometric-status.success {
            background: rgba(76, 201, 240, 0.2);
            color: var(--success-color);
            border: 2px solid rgba(76, 201, 240, 0.3);
        }
        
        .check-icon {
            margin-left: 5px;
            font-weight: bold;
        }
        
        .candidate-card.selected {
            border-color: var(--primary-color);
            background: rgba(67, 97, 238, 0.1);
            transform: scale(1.02);
        }
        
        .verification-result {
            margin-top: 15px;
            padding: 15px;
            border-radius: 10px;
            font-weight: 500;
        }
        
        .verification-result.success {
            background: rgba(76, 201, 240, 0.2);
            color: var(--success-color);
            border: 2px solid rgba(76, 201, 240, 0.3);
        }
        
        .verification-result.error {
            background: rgba(247, 37, 133, 0.2);
            color: var(--danger-color);
            border: 2px solid rgba(247, 37, 133, 0.3);
        }
        
        .voting-step {
            animation: fadeIn 0.5s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
`);

// Add confirmation step HTML if not exists
if (!document.getElementById('confirmVoterName')) {
    const confirmationStep = document.getElementById('step4');
    if (confirmationStep) {
        confirmationStep.querySelector('.confirmation-card').innerHTML = `
            <h4>Vote Summary</h4>
            <div class="summary-details">
                <p><strong>Voter Name:</strong> <span id="confirmVoterName">-</span></p>
                <p><strong>Aadhar Number:</strong> <span id="confirmAadhar">-</span></p>
                <p><strong>Selected Candidate:</strong> <span id="confirmCandidate">-</span></p>
                <p><strong>Political Party:</strong> <span id="confirmParty">-</span></p>
                <p><strong>Timestamp:</strong> <span id="confirmTime">-</span></p>
                <p><strong>Vote ID:</strong> <span id="confirmVoteId">Will be generated after submission</span></p>
            </div>
            <div class="vote-buttons">
                <button class="btn-secondary" onclick="previousStep(4)">Back</button>
                <button class="btn-success" onclick="submitVote()">Submit Vote</button>
            </div>
        `;
    }
}