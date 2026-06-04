// Dashboard Charts and Data Management
let voteDistributionChart = null;
let votingTrendChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Initializing dashboard...');
    initializeDashboard();
    setInterval(updateDashboard, 3000); // Update every 3 seconds
});

// Initialize dashboard with charts
async function initializeDashboard() {
    try {
        await updateDashboard();
        initializeCharts();
        console.log('✅ Dashboard initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize dashboard:', error);
        loadSampleData(); // Fallback to sample data
    }
}

// Update dashboard data
async function updateDashboard() {
    try {
        console.log('🔄 Updating dashboard data...');
        const response = await fetch('/api/dashboard/data');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            updateStats(data.stats);
            updateCharts(data.charts);
            updateRanking(data.candidates);
            updateFraudDetection(data.fraudMetrics);
            updateAlerts(data.alerts);
            document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
            console.log('✅ Dashboard updated successfully');
        } else {
            console.warn('Failed to update dashboard:', data.message);
            loadSampleData();
        }
    } catch (error) {
        console.error('❌ Error updating dashboard:', error);
        loadSampleData(); // Fallback to sample data
    }
}

// Update statistics
function updateStats(stats) {
    console.log('📈 Updating stats:', stats);
    
    // Update dashboard stats
    document.getElementById('dashboardTotalVotes').textContent = stats.totalVotes || 0;
    document.getElementById('dashboardVoters').textContent = stats.registeredVoters || 0;
    document.getElementById('currentLeader').textContent = stats.currentLeader || '-';
    document.getElementById('leaderVotes').textContent = `${stats.leaderVotes || 0} votes`;
    
    // Vote rigging scale
    const riggingScale = stats.riggingScale || 0;
    document.getElementById('riggingScale').textContent = `${riggingScale}%`;
    
    let riggingStatus = 'Low Risk';
    let riggingColor = 'var(--success-cyan)';
    
    if (riggingScale >= 30) {
        riggingStatus = 'High Risk';
        riggingColor = 'var(--danger-pink)';
    } else if (riggingScale >= 10) {
        riggingStatus = 'Medium Risk';
        riggingColor = 'var(--warning-orange)';
    }
    
    document.getElementById('riggingStatus').textContent = riggingStatus;
    document.getElementById('riggingStatus').style.color = riggingColor;
    
    // Update vote change
    const voteChange = stats.voteChange || 0;
    document.getElementById('voteChange').textContent = 
        voteChange >= 0 ? `+${voteChange} this hour` : `${voteChange} this hour`;
    document.getElementById('voteChange').style.color = 
        voteChange >= 0 ? 'var(--success-cyan)' : 'var(--danger-pink)';
    
    // Update home page stats if on home page
    if (document.getElementById('totalVotes')) {
        document.getElementById('totalVotes').textContent = stats.totalVotes || 0;
        document.getElementById('registeredVoters').textContent = stats.registeredVoters || 0;
    }
}

// Initialize charts
function initializeCharts() {
    console.log('📊 Initializing charts...');
    
    const distributionCtx = document.getElementById('voteDistributionChart');
    const trendCtx = document.getElementById('votingTrendChart');
    
    if (!distributionCtx || !trendCtx) {
        console.error('❌ Chart canvases not found');
        return;
    }
    
    // Vote Distribution Chart (Doughnut)
    voteDistributionChart = new Chart(distributionCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#4361ee',
                    '#3a0ca3',
                    '#4cc9f0',
                    '#f72585',
                    '#f8961e',
                    '#7209b7'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            family: 'Poppins',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} votes (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 1000
            }
        }
    });
    
    // Voting Trend Chart (Line)
    votingTrendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Votes per hour',
                data: [],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#4361ee',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value;
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            family: 'Poppins',
                            size: 12
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
    
    console.log('✅ Charts initialized');
}

// Update charts with new data
function updateCharts(chartData) {
    if (!chartData) {
        console.warn('No chart data received');
        return;
    }
    
    // Update distribution chart
    if (voteDistributionChart && chartData.distribution) {
        voteDistributionChart.data.labels = chartData.distribution.labels || [];
        voteDistributionChart.data.datasets[0].data = chartData.distribution.data || [];
        voteDistributionChart.update();
        console.log('✅ Distribution chart updated');
    }
    
    // Update trend chart
    if (votingTrendChart && chartData.trend) {
        votingTrendChart.data.labels = chartData.trend.labels || [];
        votingTrendChart.data.datasets[0].data = chartData.trend.datasets?.[0]?.data || [];
        votingTrendChart.update();
        console.log('✅ Trend chart updated');
    }
}

// Update candidates ranking table
function updateRanking(candidates) {
    if (!candidates || !Array.isArray(candidates)) {
        console.warn('No candidates data received');
        return;
    }
    
    const tbody = document.getElementById('candidatesRanking');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Sort by votes descending
    candidates.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    
    candidates.forEach((candidate, index) => {
        const totalVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
        const percentage = totalVotes > 0 ? ((candidate.votes || 0) / totalVotes * 100).toFixed(1) : 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <div class="candidate-info">
                    <div>
                        <div class="candidate-name">${candidate.name}</div>
                        <div class="candidate-id">ID: ${candidate.id}</div>
                    </div>
                </div>
            </td>
            <td>${candidate.party || '-'}</td>
            <td><strong>${candidate.votes || 0}</strong></td>
            <td>
                <div class="percentage-bar">
                    <div class="percentage-fill" style="width: ${percentage}%"></div>
                    <span>${percentage}%</span>
                </div>
            </td>
            <td>
                <span class="status-badge ${index === 0 ? 'status-leading' : 'status-trailing'}">
                    ${index === 0 ? '🏆 Leading' : '📈 Trailing'}
                </span>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log(`✅ Updated ranking for ${candidates.length} candidates`);
}

// Update fraud detection metrics
function updateFraudDetection(metrics) {
    if (!metrics) {
        console.warn('No fraud metrics received');
        return;
    }
    
    console.log('🛡️ Updating fraud metrics:', metrics);
    
    // Duplicate votes
    const duplicateVotes = metrics.duplicateVotes || 0;
    document.getElementById('duplicateVotes').textContent = duplicateVotes;
    const duplicateBar = document.getElementById('duplicateBar');
    if (duplicateBar) {
        duplicateBar.style.width = `${Math.min(duplicateVotes * 10, 100)}%`;
        duplicateBar.style.backgroundColor = duplicateVotes > 5 ? 'var(--danger-pink)' : 
                                           duplicateVotes > 2 ? 'var(--warning-orange)' : 'var(--success-cyan)';
    }
    
    // Unverified votes
    const unverifiedVotes = metrics.unverifiedVotes || 0;
    document.getElementById('unverifiedVotes').textContent = unverifiedVotes;
    const unverifiedBar = document.getElementById('unverifiedBar');
    if (unverifiedBar) {
        unverifiedBar.style.width = `${Math.min(unverifiedVotes * 20, 100)}%`;
        unverifiedBar.style.backgroundColor = unverifiedVotes > 3 ? 'var(--danger-pink)' : 
                                             unverifiedVotes > 1 ? 'var(--warning-orange)' : 'var(--success-cyan)';
    }
    
    // Suspicious patterns
    const suspiciousPatterns = metrics.suspiciousPatterns || 0;
    document.getElementById('suspiciousPatterns').textContent = suspiciousPatterns;
    const suspiciousBar = document.getElementById('suspiciousBar');
    if (suspiciousBar) {
        suspiciousBar.style.width = `${Math.min(suspiciousPatterns * 30, 100)}%`;
        suspiciousBar.style.backgroundColor = suspiciousPatterns > 2 ? 'var(--danger-pink)' : 
                                             suspiciousPatterns > 0 ? 'var(--warning-orange)' : 'var(--success-cyan)';
    }
}

// Update alerts list
function updateAlerts(alerts) {
    if (!alerts || !Array.isArray(alerts)) {
        console.warn('No alerts received');
        return;
    }
    
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) return;
    
    // Clear old alerts
    alertsList.innerHTML = '';
    
    // Add new alerts
    alerts.slice(0, 5).forEach(alert => {
        const alertElement = document.createElement('div');
        alertElement.className = `alert-item alert-${alert.type || 'info'}`;
        
        let icon = 'ℹ️';
        if (alert.type === 'warning') icon = '⚠️';
        if (alert.type === 'danger') icon = '🚨';
        if (alert.type === 'success') icon = '✅';
        
        alertElement.innerHTML = `
            <div class="alert-icon">${icon}</div>
            <div class="alert-content">
                <div class="alert-title">${alert.title}</div>
                <div class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</div>
            </div>
        `;
        
        alertsList.appendChild(alertElement);
    });
    
    console.log(`✅ Updated ${alerts.length} alerts`);
}

// Load sample data (fallback)
function loadSampleData() {
    console.log('📋 Loading sample data for demo...');
    
    // Sample stats
    const sampleStats = {
        totalVotes: Math.floor(Math.random() * 1000) + 500,
        registeredVoters: Math.floor(Math.random() * 5000) + 5000,
        currentLeader: 'John Doe',
        leaderVotes: Math.floor(Math.random() * 300) + 200,
        riggingScale: (Math.random() * 15).toFixed(1),
        voteChange: Math.floor(Math.random() * 15)
    };
    
    // Sample candidates
    const sampleCandidates = [
        { id: 1, name: 'John Doe', party: 'National Party', symbol: '🌺', votes: 423 },
        { id: 2, name: 'Jane Smith', party: 'People\'s Alliance', symbol: '✋', votes: 387 },
        { id: 3, name: 'Robert Johnson', party: 'Progressive Front', symbol: '⭐', votes: 312 },
        { id: 4, name: 'Sarah Williams', party: 'Unity Coalition', symbol: '🐘', votes: 125 }
    ];
    
    // Sample fraud metrics
    const sampleFraudMetrics = {
        duplicateVotes: Math.floor(Math.random() * 3),
        suspiciousPatterns: Math.floor(Math.random() * 2),
        unverifiedVotes: Math.floor(Math.random() * 2)
    };
    
    // Sample charts data
    const hours = [];
    const votesPerHour = [];
    for (let i = 0; i < 24; i++) {
        hours.push(`${i.toString().padStart(2, '0')}:00`);
        votesPerHour.push(Math.floor(Math.random() * 50) + 10);
    }
    
    const sampleCharts = {
        distribution: {
            labels: sampleCandidates.map(c => c.name),
            data: sampleCandidates.map(c => c.votes)
        },
        trend: {
            labels: hours,
            datasets: [{
                data: votesPerHour
            }]
        }
    };

    // Add refresh button functionality
function addRefreshButton() {
    // Create refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.className = 'btn btn-primary';
    refreshBtn.innerHTML = '🔄 Refresh Dashboard';
    refreshBtn.style.position = 'fixed';
    refreshBtn.style.top = '20px';
    refreshBtn.style.right = '20px';
    refreshBtn.style.zIndex = '1000';
    refreshBtn.style.padding = '10px 20px';
    refreshBtn.style.fontSize = '14px';
    
    refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '🔄 Refreshing...';
        
        await updateDashboard();
        
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '🔄 Refresh Dashboard';
        
        showToast('Dashboard refreshed successfully!', 'success');
    };
    
    document.body.appendChild(refreshBtn);
}

// Initialize refresh button
document.addEventListener('DOMContentLoaded', function() {
    addRefreshButton();
    initializeDashboard();
    setInterval(updateDashboard, 3000);
});
    
    // Sample alerts
    const sampleAlerts = [
        {
            type: 'info',
            title: 'System running normally',
            timestamp: new Date(Date.now() - 300000).toISOString()
        },
        {
            type: 'success',
            title: 'Voting activity is normal',
            timestamp: new Date(Date.now() - 600000).toISOString()
        }
    ];
    
    // Update UI with sample data
    updateStats(sampleStats);
    updateCharts(sampleCharts);
    updateRanking(sampleCandidates);
    updateFraudDetection(sampleFraudMetrics);
    updateAlerts(sampleAlerts);
    
    console.log('✅ Sample data loaded');
}

// Helper function for number animation
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

// Add these styles to your dashboard.html or style.css
const dashboardStyles = 


// Add styles to document head
document.head.insertAdjacentHTML('beforeend', dashboardStyles);