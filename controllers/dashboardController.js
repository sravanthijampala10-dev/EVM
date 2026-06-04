const db = require('../database/database');

class DashboardController {
    // Get comprehensive dashboard data
    static async getDashboardData(req, res) {
        try {
            // Get all statistics in parallel for efficiency
            const [
                totalVotes,
                registeredVoters,
                candidates,
                fraudMetrics,
                recentVotes,
                votingTrend
            ] = await Promise.all([
                this.getTotalVotes(),
                this.getRegisteredVoters(),
                this.getCandidatesWithVotes(),
                this.getFraudMetrics(),
                this.getRecentVotes(),
                this.getVotingTrend()
            ]);
            
            // Calculate leader
            const leader = candidates.length > 0 
                ? candidates.reduce((prev, current) => 
                    (prev.votes > current.votes) ? prev : current)
                : null;
            
            // Calculate vote rigging scale
            const riggingScale = this.calculateRiggingScale(fraudMetrics);
            
            // Generate alerts
            const alerts = this.generateAlerts(fraudMetrics, candidates, totalVotes);
            
            // Prepare chart data
            const chartData = this.prepareChartData(candidates, votingTrend);
            
            res.json({
                success: true,
                stats: {
                    totalVotes,
                    registeredVoters,
                    currentLeader: leader ? leader.name : 'No votes yet',
                    leaderVotes: leader ? leader.votes : 0,
                    riggingScale: riggingScale.toFixed(1),
                    voteChange: this.calculateVoteChange()
                },
                charts: chartData,
                candidates,
                fraudMetrics,
                alerts,
                lastUpdated: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Dashboard data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load dashboard data'
            });
        }
    }
    
    static async getTotalVotes() {
        const result = await db.get('SELECT COUNT(*) as count FROM votes');
        return result.count || 0;
    }
    
    static async getRegisteredVoters() {
        const result = await db.get('SELECT COUNT(*) as count FROM users');
        return result.count || 0;
    }
    
    static async getCandidatesWithVotes() {
        return await db.all(`
            SELECT 
                c.id,
                c.name,
                c.party,
                c.symbol,
                COALESCE(COUNT(v.id), 0) as votes,
                ROUND(
                    (COALESCE(COUNT(v.id), 0) * 100.0) / 
                    NULLIF((SELECT COUNT(*) FROM votes), 0), 
                    2
                ) as percentage
            FROM candidates c
            LEFT JOIN votes v ON c.id = v.candidate_id
            GROUP BY c.id, c.name, c.party, c.symbol
            ORDER BY votes DESC
        `);
    }
    
    static async getFraudMetrics() {
        // Check for duplicate fingerprints
        const duplicateFingerprints = await db.get(`
            SELECT COUNT(DISTINCT v1.fingerprint_hash) as count
            FROM votes v1
            JOIN votes v2 ON v1.fingerprint_hash = v2.fingerprint_hash 
                AND v1.id != v2.id
        `);
        
        // Check for suspicious voting patterns (multiple votes in short time)
        const suspiciousPatterns = await db.get(`
            SELECT COUNT(*) as count
            FROM (
                SELECT voter_aadhar, COUNT(*) as vote_count
                FROM votes
                GROUP BY voter_aadhar
                HAVING COUNT(*) > 1
            ) as duplicates
        `);
        
        // Check for votes without proper fingerprint
        const unverifiedVotes = await db.get(`
            SELECT COUNT(*) as count
            FROM votes
            WHERE fingerprint_hash IS NULL 
                OR fingerprint_hash = ''
                OR fingerprint_hash = 'simulated'
        `);
        
        return {
            duplicateVotes: duplicateFingerprints.count || 0,
            suspiciousPatterns: suspiciousPatterns.count || 0,
            unverifiedVotes: unverifiedVotes.count || 0
        };
    }
    
    static async getRecentVotes(limit = 10) {
        return await db.all(`
            SELECT 
                v.voter_aadhar,
                c.name as candidate_name,
                c.party,
                v.timestamp,
                strftime('%H:%M', v.timestamp) as time
            FROM votes v
            JOIN candidates c ON v.candidate_id = c.id
            ORDER BY v.timestamp DESC
            LIMIT ?
        `, [limit]);
    }
    
    static async getVotingTrend(hours = 24) {
        const now = new Date();
        const pastTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
        
        return await db.all(`
            SELECT 
                strftime('%H:00', timestamp) as hour,
                COUNT(*) as votes
            FROM votes
            WHERE timestamp >= ?
            GROUP BY strftime('%H', timestamp)
            ORDER BY hour ASC
        `, [pastTime.toISOString()]);
    }
    
    static calculateRiggingScale(fraudMetrics) {
        let score = 0;
        
        // Duplicate votes weight: 40%
        if (fraudMetrics.duplicateVotes > 0) {
            score += Math.min(40, fraudMetrics.duplicateVotes * 10);
        }
        
        // Suspicious patterns weight: 35%
        if (fraudMetrics.suspiciousPatterns > 0) {
            score += Math.min(35, fraudMetrics.suspiciousPatterns * 15);
        }
        
        // Unverified votes weight: 25%
        if (fraudMetrics.unverifiedVotes > 0) {
            score += Math.min(25, fraudMetrics.unverifiedVotes * 5);
        }
        
        return Math.min(100, score);
    }
    
    static calculateVoteChange() {
        // In a real system, this would compare with previous hour/day
        // For demo, return a random change
        const changes = [-5, -2, 0, 2, 5, 8, 12, 15];
        return changes[Math.floor(Math.random() * changes.length)];
    }
    
    static generateAlerts(fraudMetrics, candidates, totalVotes) {
        const alerts = [];
        const now = new Date();
        
        // Fraud detection alerts
        if (fraudMetrics.duplicateVotes > 0) {
            alerts.push({
                type: 'danger',
                title: `Duplicate votes detected: ${fraudMetrics.duplicateVotes}`,
                timestamp: new Date(now.getTime() - Math.random() * 60000).toISOString(),
                priority: 'high'
            });
        }
        
        if (fraudMetrics.suspiciousPatterns > 0) {
            alerts.push({
                type: 'warning',
                title: `Suspicious voting patterns detected`,
                timestamp: new Date(now.getTime() - Math.random() * 120000).toISOString(),
                priority: 'medium'
            });
        }
        
        // Voting progress alerts
        const votePercentage = totalVotes > 0 ? 
            (totalVotes / 5000 * 100).toFixed(1) : 0; // Assuming 5000 registered voters
        
        if (votePercentage > 50) {
            alerts.push({
                type: 'success',
                title: `Voting crossed 50%: ${votePercentage}% votes cast`,
                timestamp: new Date(now.getTime() - Math.random() * 180000).toISOString(),
                priority: 'low'
            });
        }
        
        // Leader change alerts (simulated)
        if (candidates.length >= 2 && Math.random() > 0.7) {
            const leadingCandidate = candidates[0];
            alerts.push({
                type: 'info',
                title: `${leadingCandidate.name} leading with ${leadingCandidate.votes} votes`,
                timestamp: new Date(now.getTime() - Math.random() * 240000).toISOString(),
                priority: 'low'
            });
        }
        
        // System status alert
        alerts.push({
            type: 'info',
            title: 'System running normally',
            timestamp: new Date(now.getTime() - Math.random() * 300000).toISOString(),
            priority: 'low'
        });
        
        return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    static prepareChartData(candidates, votingTrend) {
        // Prepare data for vote distribution chart
        const distribution = {
            labels: candidates.map(c => c.name),
            data: candidates.map(c => c.votes),
            colors: [
                '#4361ee', '#3a0ca3', '#4cc9f0', '#f72585',
                '#f8961e', '#7209b7', '#38b000', '#ff9e00'
            ]
        };
        
        // Prepare data for voting trend chart
        const trend = {
            labels: votingTrend.map(v => v.hour),
            datasets: [
                {
                    label: 'Votes per hour',
                    data: votingTrend.map(v => v.votes),
                    color: '#4361ee'
                }
            ]
        };
        
        // Prepare data for party-wise distribution
        const partyData = {};
        candidates.forEach(candidate => {
            if (!partyData[candidate.party]) {
                partyData[candidate.party] = 0;
            }
            partyData[candidate.party] += candidate.votes;
        });
        
        const partyDistribution = {
            labels: Object.keys(partyData),
            data: Object.values(partyData)
        };
        
        return {
            distribution,
            trend,
            partyDistribution
        };
    }
}

module.exports = DashboardController;