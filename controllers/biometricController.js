const SimpleWebAuthnServer = require('@simplewebauthn/server');
const db = require('../database/database');

// RP ID should be the domain processing the request
// For localhost development:
const rpName = 'SecureVote E-Voting';
// In production, this must be your actual domain
const rpID = 'localhost';
const origin = `http://${rpID}:3000`;

class BiometricController {

    // Get options for registration
    static async generateRegistrationOptions(req, res) {
        try {
            // User should be logged in via Aadhar first to register biometrics
            // Or we could allow registration during initial setup
            // For this flow, we assume they are logged in or we pass aadharNumber

            const { aadharNumber } = req.body;

            if (!aadharNumber) {
                return res.status(400).json({ error: 'Aadhar number required' });
            }

            const user = await db.get('SELECT * FROM users WHERE aadhar_number = ?', [aadharNumber]);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get existing authenticators to exclude them
            const authenticators = await db.all('SELECT * FROM authenticators WHERE user_id = ?', [user.id]);

            const options = await SimpleWebAuthnServer.generateRegistrationOptions({
                rpName,
                rpID,
                userID: `${user.id}`, // Must be a string
                userName: user.name,
                // Don't prompt if already registered
                excludeCredentials: authenticators.map(auth => ({
                    id: auth.credentialID,
                    transports: auth.transports ? JSON.parse(auth.transports) : undefined,
                })),
                authenticatorSelection: {
                    userVerification: 'preferred',
                    residentKey: 'preferred',
                },
            });

            // Save challenge to session to verify later
            req.session.currentChallenge = options.challenge;
            req.session.registeringUserId = user.id;

            res.json(options);
        } catch (error) {
            console.error('Error generating registration options:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Verify registration response
    static async verifyRegistration(req, res) {
        try {
            const { body } = req;
            const expectedChallenge = req.session.currentChallenge;
            const userId = req.session.registeringUserId;

            if (!expectedChallenge) {
                return res.status(400).json({ error: 'No registration in progress' });
            }

            const verification = await SimpleWebAuthnServer.verifyRegistrationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
            });

            if (verification.verified && verification.registrationInfo) {
                const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

                // Save to DB
                await db.run(`
                    INSERT INTO authenticators 
                    (credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp, user_id, transports)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    credentialID,
                    Buffer.from(credentialPublicKey), // Store as Buffer/Blob if possible, or base64 string
                    counter,
                    credentialDeviceType,
                    credentialBackedUp ? 1 : 0,
                    userId,
                    JSON.stringify(body.response.transports || []) // Store transports if available
                ]);

                // Clear session challenge
                delete req.session.currentChallenge;
                delete req.session.registeringUserId;

                res.json({ verified: true });
            } else {
                res.status(400).json({ verified: false, error: 'Verification failed' });
            }
        } catch (error) {
            console.error('Error verifying registration:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Generate options for authentication (login)
    static async generateAuthenticationOptions(req, res) {
        try {
            const { aadharNumber } = req.body;
            let allowCredentials = [];

            if (aadharNumber) {
                const user = await db.get('SELECT * FROM users WHERE aadhar_number = ?', [aadharNumber]);
                if (user) {
                    const authenticators = await db.all('SELECT * FROM authenticators WHERE user_id = ?', [user.id]);
                    allowCredentials = authenticators.map(auth => ({
                        id: auth.credentialID,
                        type: 'public-key',
                        transports: auth.transports ? JSON.parse(auth.transports) : undefined,
                    }));
                }
            }

            const options = await SimpleWebAuthnServer.generateAuthenticationOptions({
                rpID,
                allowCredentials,
                userVerification: 'preferred',
            });

            req.session.currentChallenge = options.challenge;

            res.json(options);
        } catch (error) {
            console.error('Error generating auth options:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Verify authentication response
    static async verifyAuthentication(req, res) {
        try {
            const { body } = req;
            const expectedChallenge = req.session.currentChallenge;

            if (!expectedChallenge) {
                return res.status(400).json({ error: 'No authentication in progress' });
            }

            // Find authenticator in DB by credential ID
            const authenticator = await db.get(
                'SELECT * FROM authenticators WHERE credentialID = ?',
                [body.id]
            );

            if (!authenticator) {
                return res.status(400).json({ error: 'Authenticator not found' });
            }

            // user also required for verification
            const user = await db.get('SELECT * FROM users WHERE id = ?', [authenticator.user_id]);

            // Database stores public key as Buffer/Blob usually. 
            // If stored as TEXT in previous step (which we did), we might need to handle valid conversion if it was base64 encoded by us or raw.
            // Wait, sql.run with Buffer usually stores as BLOB. 

            const verification = await SimpleWebAuthnServer.verifyAuthenticationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                authenticator: {
                    credentialID: authenticator.credentialID,
                    credentialPublicKey: authenticator.credentialPublicKey, // This needs to be correctly formatted (Uint8Array or Buffer)
                    counter: authenticator.counter,
                    transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
                },
            });

            if (verification.verified) {
                const { authenticationInfo } = verification;
                const { newCounter } = authenticationInfo;

                // Update counter
                await db.run('UPDATE authenticators SET counter = ? WHERE credentialID = ?', [newCounter, body.id]);

                // Create session
                req.session.voter = {
                    aadhar: user.aadhar_number,
                    name: user.name,
                    userId: user.id
                };

                delete req.session.currentChallenge;

                res.json({ verified: true, user: { name: user.name, aadhar: user.aadhar_number } });
            } else {
                res.status(400).json({ verified: false, error: 'Verification failed' });
            }
        } catch (error) {
            console.error('Error verifying authentication:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = BiometricController;
