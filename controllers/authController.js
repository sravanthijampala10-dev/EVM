const db = require('../database/database');

class AuthController {
    // Verify Aadhar number
    static async verifyAadhar(req, res) {
        try {
            const { aadharNumber } = req.body;

            // Validation
            if (!aadharNumber || !/^\d{12}$/.test(aadharNumber)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Aadhar number. Must be 12 digits.'
                });
            }

            // Check if user exists in database
            const user = await db.get(
                'SELECT * FROM users WHERE aadhar_number = ?',
                [aadharNumber]
            );

            if (!user) {
                return res.json({
                    success: false,
                    message: 'Aadhar number not registered in the system.'
                });
            }

            // Check if already voted
            if (user.has_voted === 1) {
                return res.json({
                    success: false,
                    message: 'This Aadhar has already voted.'
                });
            }

            // Store in session
            req.session.voter = {
                aadhar: aadharNumber,
                name: user.name,
                userId: user.id
            };

            res.json({
                success: true,
                message: 'Aadhar verification successful',
                user: {
                    name: user.name,
                    age: user.age
                }
            });

        } catch (error) {
            console.error('Aadhar verification error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during verification'
            });
        }
    }

    // Check vote status for verification bar
    static async checkVoteStatus(req, res) {
        try {
            const { aadharNumber } = req.body;

            if (!aadharNumber || !/^\d{12}$/.test(aadharNumber)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Aadhar number'
                });
            }

            // Get user and vote details
            const voteDetails = await db.get(`
                SELECT 
                    u.aadhar_number,
                    u.name as voter_name,
                    u.has_voted,
                    c.name as candidate_name,
                    c.party,
                    v.timestamp
                FROM users u
                LEFT JOIN votes v ON u.aadhar_number = v.voter_aadhar
                LEFT JOIN candidates c ON v.candidate_id = c.id
                WHERE u.aadhar_number = ?
            `, [aadharNumber]);

            if (!voteDetails) {
                return res.json({
                    success: false,
                    message: 'Aadhar number not found'
                });
            }

            res.json({
                success: true,
                hasVoted: voteDetails.has_voted === 1,
                voterName: voteDetails.voter_name,
                candidateName: voteDetails.candidate_name,
                party: voteDetails.party,
                timestamp: voteDetails.timestamp
            });

        } catch (error) {
            console.error('Check vote status error:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking vote status'
            });
        }
    }

    // Register new voter (Admin function)
    static async registerVoter(req, res) {
        try {
            const { name, age, aadhar } = req.body;

            if (!name || !age || !aadhar) {
                return res.status(400).json({ success: false, message: 'All fields required' });
            }

            // Check duplicate
            const existing = await db.get('SELECT * FROM users WHERE aadhar_number = ?', [aadhar]);
            if (existing) {
                return res.status(400).json({ success: false, message: 'Aadhar already registered' });
            }

            await db.run(
                'INSERT INTO users (name, age, aadhar_number) VALUES (?, ?, ?)',
                [name, age, aadhar]
            );

            res.json({ success: true, message: 'Voter registered successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // Logout/clear session
    static logout(req, res) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Logout failed'
                });
            }
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    }
}

module.exports = AuthController;