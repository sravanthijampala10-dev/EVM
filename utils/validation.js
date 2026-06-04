const crypto = require('crypto');

class ValidationUtils {
    // Validate Aadhar number (12 digits with checksum)
    static validateAadhar(aadharNumber) {
        if (!aadharNumber || typeof aadharNumber !== 'string') {
            return {
                valid: false,
                message: 'Aadhar number is required'
            };
        }

        // Remove spaces and special characters
        const cleaned = aadharNumber.replace(/\s/g, '');
        
        // Check if it's exactly 12 digits
        if (!/^\d{12}$/.test(cleaned)) {
            return {
                valid: false,
                message: 'Aadhar number must be exactly 12 digits'
            };
        }

        // Simple checksum validation (demo - real Aadhar has more complex validation)
        const digits = cleaned.split('').map(Number);
        const sum = digits.reduce((acc, digit) => acc + digit, 0);
        
        // In real implementation, this would use official UIDAI validation
        // For demo, accept if sum is divisible by 3
        if (sum % 3 !== 0) {
            return {
                valid: false,
                message: 'Invalid Aadhar number'
            };
        }

        return {
            valid: true,
            message: 'Aadhar number is valid',
            cleaned: cleaned
        };
    }

    // Validate fingerprint data (simulated)
    static validateFingerprint(fingerprintData) {
        if (!fingerprintData || typeof fingerprintData !== 'string') {
            return {
                valid: false,
                message: 'Fingerprint data is required'
            };
        }

        if (fingerprintData.length < 10) {
            return {
                valid: false,
                message: 'Invalid fingerprint data'
            };
        }

        // Check if fingerprint follows expected pattern (simulated)
        const fingerprintPattern = /^fp_[a-z0-9]+_[a-z0-9]+$/i;
        if (!fingerprintPattern.test(fingerprintData)) {
            return {
                valid: false,
                message: 'Invalid fingerprint format'
            };
        }

        return {
            valid: true,
            message: 'Fingerprint data is valid'
        };
    }

    // Sanitize user input to prevent XSS
    static sanitizeInput(input) {
        if (input === null || input === undefined) {
            return '';
        }

        if (typeof input !== 'string') {
            return String(input);
        }

        // Remove potentially dangerous characters
        return input
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/[&]/g, '&amp;') // Escape &
            .replace(/["]/g, '&quot;') // Escape "
            .replace(/[']/g, '&#x27;') // Escape '
            .replace(/[`]/g, '&#x60;') // Escape `
            .replace(/[\/]/g, '&#x2F;') // Escape /
            .trim()
            .substring(0, 255); // Limit length
    }

    // Validate email format
    static validateEmail(email) {
        if (!email) {
            return {
                valid: false,
                message: 'Email is required'
            };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                valid: false,
                message: 'Invalid email format'
            };
        }

        return {
            valid: true,
            message: 'Email is valid'
        };
    }

    // Validate phone number (Indian format)
    static validatePhoneNumber(phone) {
        if (!phone) {
            return {
                valid: false,
                message: 'Phone number is required'
            };
        }

        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return {
                valid: false,
                message: 'Invalid phone number. Must be 10 digits starting with 6-9.'
            };
        }

        return {
            valid: true,
            message: 'Phone number is valid'
        };
    }

    // Generate a secure fingerprint hash
    static generateFingerprintHash(userData) {
        // In a real system, this would come from biometric device
        // For demo, generate a consistent hash based on user data
        const data = JSON.stringify({
            aadhar: userData.aadhar,
            timestamp: Date.now(),
            random: crypto.randomBytes(8).toString('hex')
        });

        return crypto.createHash('sha256')
            .update(data)
            .digest('hex')
            .substring(0, 32);
    }

    // Check if input contains SQL injection patterns
    static detectSQLInjection(input) {
        if (typeof input !== 'string') {
            return false;
        }

        const sqlInjectionPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER)\b)/gi,
            /(\b(OR|AND)\s+\d+\s*=\s*\d+\b)/gi,
            /(\b(OR|AND)\s+\'\w\'?\s*=\s*\'\w\'?\b)/gi,
            /(\b(SLEEP|WAITFOR|DELAY)\b)/gi,
            /(--|\/\*|\*\/|#)/g
        ];

        return sqlInjectionPatterns.some(pattern => pattern.test(input));
    }

    // Validate age (must be 18+ for voting)
    static validateAge(age) {
        const ageNum = parseInt(age, 10);
        
        if (isNaN(ageNum)) {
            return {
                valid: false,
                message: 'Age must be a number'
            };
        }

        if (ageNum < 18) {
            return {
                valid: false,
                message: 'Must be 18 years or older to vote'
            };
        }

        if (ageNum > 120) {
            return {
                valid: false,
                message: 'Please enter a valid age'
            };
        }

        return {
            valid: true,
            message: 'Age is valid'
        };
    }

    // Validate candidate selection
    static validateCandidateId(candidateId) {
        const idNum = parseInt(candidateId, 10);
        
        if (isNaN(idNum) || idNum <= 0) {
            return {
                valid: false,
                message: 'Invalid candidate selection'
            };
        }

        return {
            valid: true,
            message: 'Candidate ID is valid',
            numericId: idNum
        };
    }

    // Generate a unique vote ID
    static generateVoteId() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(4).toString('hex');
        return `VOTE_${timestamp}_${random}`.toUpperCase();
    }

    // Calculate fraud score based on voting patterns
    static calculateFraudScore(votingData) {
        let score = 0;
        
        // Check for rapid voting (multiple votes in short time)
        if (votingData.votesPerMinute > 10) {
            score += 30;
        }
        
        // Check for same fingerprint multiple times
        if (votingData.duplicateFingerprints > 0) {
            score += 50;
        }
        
        // Check for unusual voting times (e.g., 2 AM - 5 AM)
        const hour = new Date(votingData.timestamp).getHours();
        if (hour >= 2 && hour <= 5) {
            score += 10;
        }
        
        return Math.min(100, score);
    }
}

module.exports = ValidationUtils;