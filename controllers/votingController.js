const db = require('../database/database');
const crypto = require('crypto');

class VotingController {
    // Get all candidates
    static async getCandidates(req, res) {
        try {
            const candidates = await db.all(
                'SELECT * FROM candidates ORDER BY name ASC'
            );
            
            res.json({
                success: true,
                candidates: candidates.map(candidate => ({
                    id: candidate.id,
                    name: candidate.name,
                    party: candidate.party,
                    symbol: candidate.symbol,
                    votes: candidate.votes || 0
                }))
            });
            
        } catch (error) {
            console.error('Error fetching candidates:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch candidates'
            });
        }
    }
    
    // Submit vote
    static async submitVote(req, res) {
        try {
            const { aadharNumber, candidateId, fingerprintHash } = req.body;
            
            // Validate inputs
            if (!aadharNumber || !candidateId || !fingerprintHash) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }
            
            // Validate Aadhar format
            if (!/^\d{12}$/.test(aadharNumber)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Aadhar number format'
                });
            }
            
            // Check if user exists and hasn't voted
            const user = await db.get(
                'SELECT * FROM users WHERE aadhar_number = ?',
                [aadharNumber]
            );
            
            if (!user) {
                return res.json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            if (user.has_voted === 1) {
                return res.json({
                    success: false,
                    message: 'You have already voted'
                });
            }
            
            // Check if candidate exists
            const candidate = await db.get(
                'SELECT * FROM candidates WHERE id = ?',
                [candidateId]
            );
            
            if (!candidate) {
                return res.json({
                    success: false,
                    message: 'Candidate not found'
                });
            }
            
            // Check for duplicate fingerprint (fraud detection)
            const existingFingerprint = await db.get(
                'SELECT * FROM votes WHERE fingerprint_hash = ?',
                [fingerprintHash]
            );
            
            if (existingFingerprint) {
                // Log fraud attempt
                console.warn(`[FRAUD ALERT] Duplicate fingerprint detected: ${fingerprintHash}`);
                
                // Store fraud attempt in database (you'd need a fraud_logs table)
                // await db.run(
                //     'INSERT INTO fraud_logs (aadhar_number, attempt_type, timestamp) VALUES (?, ?, ?)',
                //     [aadharNumber, 'duplicate_fingerprint', new Date().toISOString()]
                // );
                
                return res.json({
                    success: false,
                    message: 'Biometric verification failed. Please try again.'
                });
            }
            
            // Start transaction
            await db.run('BEGIN TRANSACTION');
            
            try {
                // Update user's voting status
                await db.run(
                    'UPDATE users SET has_voted = 1, fingerprint_hash = ? WHERE aadhar_number = ?',
                    [fingerprintHash, aadharNumber]
                );
                
                // Record the vote
                await db.run(
                    'INSERT INTO votes (voter_aadhar, candidate_id, fingerprint_hash) VALUES (?, ?, ?)',
                    [aadharNumber, candidateId, fingerprintHash]
                );
                
                // Update candidate's vote count
                await db.run(
                    'UPDATE candidates SET votes = votes + 1 WHERE id = ?',
                    [candidateId]
                );
                
                await db.run('COMMIT');
                
                // Clear session
                req.session.voter = null;
                
                res.json({
                    success: true,
                    message: 'Vote submitted successfully',
                    voteId: crypto.randomBytes(8).toString('hex'),
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                await db.run('ROLLBACK');
                throw error;
            }
            
        } catch (error) {
            console.error('Vote submission error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to submit vote. Please try again.'
            });
        }
    }
    
    // Get voting statistics
    static async getVotingStats(req, res) {
        try {
            // Get total votes count
            const totalVotes = await db.get('SELECT COUNT(*) as count FROM votes');
            
            // Get votes per candidate
            const candidateVotes = await db.all(`
                SELECT c.id, c.name, c.party, COUNT(v.id) as vote_count
                FROM candidates c
                LEFT JOIN votes v ON c.id = v.candidate_id
                GROUP BY c.id, c.name, c.party
                ORDER BY vote_count DESC
            `);
            
            // Get hourly voting trend (last 12 hours)
            const now = new Date();
            const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));
            
            const votingTrend = await db.all(`
                SELECT 
                    strftime('%H:00', timestamp) as hour,
                    COUNT(*) as votes
                FROM votes
                WHERE timestamp >= ?
                GROUP BY strftime('%H', timestamp)
                ORDER BY hour ASC
            `, [twelveHoursAgo.toISOString()]);
            
            res.json({
                success: true,
                totalVotes: totalVotes.count || 0,
                candidates: candidateVotes,
                trend: votingTrend
            });
            
        } catch (error) {
            console.error('Error getting voting stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get voting statistics'
            });
        }
    }
}

module.exports = VotingController;