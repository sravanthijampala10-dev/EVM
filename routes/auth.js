const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// Aadhar verification endpoint
router.post('/verify', AuthController.verifyAadhar);

// Check vote status for verification bar
router.post('/check-vote', AuthController.checkVoteStatus);

// Register New Voter
router.post('/register-voter', AuthController.registerVoter);

// Logout
router.post('/logout', AuthController.logout);

module.exports = router;