const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

// Register a new device (Biometric/Security Key)
async function registerBiometric() {
    const msg = document.getElementById('biometricMsg');
    const registerBtn = document.getElementById('biometricRegisterBtn');

    // We need the aadhar number of the currently verified user
    // Try global, then input
    let aadhar = window.voterAadhar;
    if (!aadhar) {
        const input = document.getElementById('aadharNumber');
        if (input) aadhar = input.value;
    }

    if (!aadhar) {
        msg.textContent = 'Please verify Aadhar first.';
        msg.style.color = 'red';
        return;
    }

    try {
        msg.textContent = 'Starting registration...';
        msg.style.color = 'blue';
        registerBtn.disabled = true;

        // 1. Get options from server
        const resp = await fetch('/api/biometric/register/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadharNumber: aadhar })
        });

        const optionsJSON = await resp.json();

        if (optionsJSON.error) {
            throw new Error(optionsJSON.error);
        }

        // 2. Start ceremony with browser
        let attResp;
        try {
            attResp = await startRegistration(optionsJSON);
        } catch (error) {
            if (error.name === 'InvalidStateError') {
                throw new Error('Authenticator already registered.');
            }
            throw error;
        }

        // 3. Send response to server for verification
        const verificationResp = await fetch('/api/biometric/register/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attResp)
        });

        const verificationJSON = await verificationResp.json();

        if (verificationJSON.verified) {
            msg.textContent = 'Device registered successfully!';
            msg.style.color = 'green';
            showNotification('Biometric device registered successfully!', 'success');
        } else {
            msg.textContent = `Registration failed: ${JSON.stringify(verificationJSON)}`;
            msg.style.color = 'red';
        }

    } catch (error) {
        console.error(error);
        msg.textContent = `Error: ${error.message}`;
        msg.style.color = 'red';
    } finally {
        registerBtn.disabled = false;
    }
}

// Login with Biometric
async function loginWithBiometric() {
    const msg = document.getElementById('biometricMsg');
    const loginBtn = document.getElementById('biometricLoginBtn');
    // Try to get Aadhar from input if user typed it
    const aadharInput = document.getElementById('aadharNumber');
    const aadharNumber = aadharInput ? aadharInput.value.trim() : '';

    try {
        msg.textContent = 'Starting login... Check your device.';
        msg.style.color = 'blue';
        loginBtn.disabled = true;

        // 1. Get options
        const resp = await fetch('/api/biometric/login/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadharNumber })
        });

        const optionsJSON = await resp.json();

        // 2. Start ceremony
        let asseResp;
        try {
            asseResp = await startAuthentication(optionsJSON);
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                throw new Error('Timeout or operation denied. If this fails, please ensure you have Registered this device first.');
            }
            throw error;
        }

        // 3. Verify
        const verificationResp = await fetch('/api/biometric/login/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(asseResp)
        });

        const verificationJSON = await verificationResp.json();

        if (verificationJSON.verified) {
            msg.textContent = 'Login successful!';
            msg.style.color = 'green';

            // Set global variables from main.js context if possible, or just reload/handle UI
            // Assuming main.js has globals: voterAadhar, voterName
            if (verificationJSON.user) {
                // Update UI using main.js logic
                // We might need to expose a function in main.js or just manipulate DOM

                // Simulate successful verification flow from main.js
                // We'll set the globals and call the success handlers

                // Determine if we can access globals (yes, window scope)
                window.voterAadhar = verificationJSON.user.aadhar;
                window.voterName = verificationJSON.user.name;

                sessionStorage.setItem('voterAadhar', verificationJSON.user.aadhar);
                sessionStorage.setItem('voterName', verificationJSON.user.name);

                showNotification(`Welcome back, ${verificationJSON.user.name}!`, 'success');

                // Hide register button if we just logged in (optional)
                document.getElementById('biometricRegisterBtn').style.display = 'inline-block'; // Or hide, strictly

                // Proceed to next step
                setTimeout(() => {
                    if (typeof nextStep === 'function') nextStep();
                }, 1000);
            }
        } else {
            msg.textContent = 'Login failed.';
            msg.style.color = 'red';
        }

    } finally {
        loginBtn.disabled = false;
    }
}

// Verify Biometric for Voting (Re-authentication)
async function verifyBiometricForVote() {
    // Similar to login, but we explicitly want to verify the user *again* before voting
    // We can reuse the login endpoint or a specific verify endpoint
    // For simplicity, we use the login endpoint which validates the key

    // Check global variable first, then input field
    let aadhar = window.voterAadhar || document.getElementById('aadharNumber')?.value || document.getElementById('regAadhar')?.value;

    try {
        if (!aadhar) throw new Error("Voter Aadhar not found");

        const resp = await fetch('/api/biometric/login/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aadharNumber: aadhar })
        });

        const optionsJSON = await resp.json();

        // Start ceremony
        const asseResp = await startAuthentication(optionsJSON);

        // Verify
        const verificationResp = await fetch('/api/biometric/login/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(asseResp)
        });

        return await verificationResp.json(); // { verified: true/false, ... }

    } catch (error) {
        throw error;
    }
}
