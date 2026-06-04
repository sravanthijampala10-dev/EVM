require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'evoting-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Database setup
const db = require('./database/database');

// Import routes
const authRoutes = require('./routes/auth');
const votingRoutes = require('./routes/voting');
const dashboardRoutes = require('./routes/dashboard');
const biometricRoutes = require('./routes/biometric');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/vote', votingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/biometric', biometricRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Initialize database and start server
async function startServer() {
    try {
        await db.initializeDatabase();
        console.log('Database initialized successfully');

        app.listen(PORT, () => {
            console.log(`
            ╔═══════════════════════════════════════════╗
            ║        SecureVote E-Voting System        ║
            ╚═══════════════════════════════════════════╝
            
            ✅ Server is running on: http://localhost:${PORT}
            📊 Dashboard: http://localhost:${PORT}/dashboard
            🗃️  Database: SQLite (./database/evoting.db)
            
            📝 Sample Aadhar numbers for testing:
            • 123456789012
            • 234567890123
            • 345678901234
            • 456789012345
            
            Press Ctrl+C to stop the server
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Received SIGTERM. Shutting down...');
    process.exit(0);
});

// Start the server
startServer();
