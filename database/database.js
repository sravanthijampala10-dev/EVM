const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class Database {
    constructor() {
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const dbPath = path.resolve(process.env.DATABASE_PATH || './database/evoting.db');
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error connecting to database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error running SQL:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, result) => {
                if (err) {
                    console.error('Error running SQL:', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Error running SQL:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async initializeDatabase() {
        await this.connect();

        // Create tables
        await this.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                aadhar_number TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                has_voted BOOLEAN DEFAULT 0,
                fingerprint_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.run(`
            CREATE TABLE IF NOT EXISTS candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                party TEXT NOT NULL,
                symbol TEXT,
                votes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.run(`
            CREATE TABLE IF NOT EXISTS votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                voter_aadhar TEXT NOT NULL,
                candidate_id INTEGER NOT NULL,
                fingerprint_hash TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (candidate_id) REFERENCES candidates (id)
            )
        `);

        await this.run(`
            CREATE TABLE IF NOT EXISTS authenticators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                credentialID TEXT NOT NULL,
                credentialPublicKey TEXT NOT NULL,
                counter INTEGER NOT NULL,
                credentialDeviceType TEXT NOT NULL,
                credentialBackedUp BOOLEAN NOT NULL,
                transports TEXT,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Insert sample candidates if empty
        const candidates = await this.all('SELECT COUNT(*) as count FROM candidates');
        if (candidates[0].count === 0) {
            const sampleCandidates = [
                { name: 'John Doe', party: 'National Party', symbol: 'Lotus' },
                { name: 'Jane Smith', party: 'People\'s Alliance', symbol: 'Hand' },
                { name: 'Robert Johnson', party: 'Progressive Front', symbol: 'Star' },
                { name: 'Sarah Williams', party: 'Unity Coalition', symbol: 'Elephant' }
            ];

            for (const candidate of sampleCandidates) {
                await this.run(
                    'INSERT INTO candidates (name, party, symbol) VALUES (?, ?, ?)',
                    [candidate.name, candidate.party, candidate.symbol]
                );
            }
            console.log('Sample candidates inserted');
        }

        // Insert sample users if empty
        const users = await this.all('SELECT COUNT(*) as count FROM users');
        if (users[0].count === 0) {
            const sampleUsers = [
                { aadhar: '123456789012', name: 'Alice Johnson', age: 25 },
                { aadhar: '234567890123', name: 'Bob Smith', age: 30 },
                { aadhar: '345678901234', name: 'Charlie Brown', age: 35 },
                { aadhar: '456789012345', name: 'Diana Prince', age: 28 }
            ];

            for (const user of sampleUsers) {
                await this.run(
                    'INSERT INTO users (aadhar_number, name, age) VALUES (?, ?, ?)',
                    [user.aadhar, user.name, user.age]
                );
            }
            console.log('Sample users inserted');
        }
    }
}

module.exports = new Database();