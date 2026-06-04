const express = require('express');
const router = express.Router();
const db = require('../database/database');

// Get basic stats (for home page)
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 Fetching dashboard stats...');
        
        // Get total votes
        const totalVotes = await db.get('SELECT COUNT(*) as count FROM votes');
        
        // Get registered voters
        const registeredVoters = await db.get('SELECT COUNT(*) as count FROM users');
        
        // Get current leader
        const leader = await db.get(`
            SELECT c.name, c.votes 
            FROM candidates c 
            ORDER BY c.votes DESC 
            LIMIT 1
        `);
        
        // Get vote change (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentVotes = await db.get(`
            SELECT COUNT(*) as count 
            FROM votes 
            WHERE timestamp >= ?
        `, [oneHourAgo.toISOString()]);
        
        res.json({
            success: true,
            totalVotes: totalVotes.count || 0,
            registeredVoters: registeredVoters.count || 0,
            currentLeader: leader?.name || 'No votes yet',
            leaderVotes: leader?.votes || 0,
            voteChange: recentVotes.count || 0
        });
        
    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get stats'
        });
    }
});

// Get comprehensive dashboard data
router.get('/data', async (req, res) => {
    try {
        console.log('📈 Fetching comprehensive dashboard data...');
        
        // Get all data in parallel
        const [
            totalVotes,
            registeredVoters,
            candidates,
            votingTrend,
            fraudMetrics
        ] = await Promise.all([
            getTotalVotes(),
            getRegisteredVoters(),
            getCandidatesWithVotes(),
            getVotingTrend(),
            getFraudMetrics()
        ]);
        
        // Calculate leader
        const leader = candidates.length > 0 
            ? candidates.reduce((prev, current) => 
                (prev.votes > current.votes) ? prev : current)
            : null;
        
        // Calculate vote rigging scale
        const riggingScale = calculateRiggingScale(fraudMetrics);
        
        // Generate alerts
        const alerts = generateAlerts(fraudMetrics, candidates, totalVotes);
        
        // Prepare chart data
        const charts = prepareChartData(candidates, votingTrend);
        
        res.json({
            success: true,
            stats: {
                totalVotes,
                registeredVoters,
                currentLeader: leader ? leader.name : 'No votes yet',
                leaderVotes: leader ? leader.votes : 0,
                riggingScale: riggingScale.toFixed(1),
                voteChange: await getRecentVoteChange()
            },
            charts: charts,
            candidates: candidates,
            fraudMetrics: fraudMetrics,
            alerts: alerts,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard data'
        });
    }
});

// Helper functions
async function getTotalVotes() {
    const result = await db.get('SELECT COUNT(*) as count FROM votes');
    return result.count || 0;
}

async function getRegisteredVoters() {
    const result = await db.get('SELECT COUNT(*) as count FROM users');
    return result.count || 0;
}

async function getCandidatesWithVotes() {
    const candidates = await db.all(`
        SELECT 
            c.id,
            c.name,
            c.party,
            c.symbol,
            COALESCE(COUNT(v.id), 0) as votes
        FROM candidates c
        LEFT JOIN votes v ON c.id = v.candidate_id
        GROUP BY c.id, c.name, c.party, c.symbol
        ORDER BY votes DESC
    `);
    
    // Calculate percentages
    const totalVotes = await getTotalVotes();
    return candidates.map(candidate => ({
        ...candidate,
        percentage: totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(1) : 0
    }));
}

async function getVotingTrend(hours = 24) {
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

async function getFraudMetrics() {
    // Check for duplicate fingerprints
    const duplicateFingerprints = await db.get(`
        SELECT COUNT(DISTINCT v1.fingerprint_hash) as count
        FROM votes v1
        JOIN votes v2 ON v1.fingerprint_hash = v2.fingerprint_hash 
            AND v1.id != v2.id
    `);
    
    // Check for suspicious voting patterns
    const suspiciousPatterns = await db.get(`
        SELECT COUNT(*) as count FROM (
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
            OR fingerprint_hash LIKE 'test_%'
    `);
    
    return {
        duplicateVotes: duplicateFingerprints.count || 0,
        suspiciousPatterns: suspiciousPatterns.count || 0,
        unverifiedVotes: unverifiedVotes.count || 0
    };
}

async function getRecentVoteChange() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db.get(`
        SELECT COUNT(*) as count 
        FROM votes 
        WHERE timestamp >= ?
    `, [oneHourAgo.toISOString()]);
    
    return recent.count || 0;
}

function calculateRiggingScale(fraudMetrics) {
    let score = 0;
    
    if (fraudMetrics.duplicateVotes > 0) {
        score += Math.min(40, fraudMetrics.duplicateVotes * 10);
    }
    
    if (fraudMetrics.suspiciousPatterns > 0) {
        score += Math.min(35, fraudMetrics.suspiciousPatterns * 15);
    }
    
    if (fraudMetrics.unverifiedVotes > 0) {
        score += Math.min(25, fraudMetrics.unverifiedVotes * 5);
    }
    
    return Math.min(100, score);
}

function generateAlerts(fraudMetrics, candidates, totalVotes) {
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
        (totalVotes / 5000 * 100).toFixed(1) : 0;
    
    if (votePercentage > 50) {
        alerts.push({
            type: 'success',
            title: `Voting crossed 50%: ${votePercentage}% votes cast`,
            timestamp: new Date(now.getTime() - Math.random() * 180000).toISOString(),
            priority: 'low'
        });
    }
    
    // Leader change alerts
    if (candidates.length >= 2) {
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

function prepareChartData(candidates, votingTrend) {
    // Vote distribution chart data
    const distribution = {
        labels: candidates.map(c => c.name),
        data: candidates.map(c => c.votes),
        colors: [
            '#4361ee', '#3a0ca3', '#4cc9f0', '#f72585',
            '#f8961e', '#7209b7', '#38b000', '#ff9e00'
        ]
    };
    
    // Voting trend chart data
    const trend = {
        labels: votingTrend.map(v => v.hour),
        datasets: [{
            label: 'Votes per hour',
            data: votingTrend.map(v => v.votes),
            color: '#4361ee'
        }]
    };
    
    return {
        distribution,
        trend
    };
}

module.exports = router;