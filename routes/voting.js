const express = require('express');
const router = express.Router();
const VotingController = require('../controllers/votingController');

// Get all candidates
router.get('/candidates', VotingController.getCandidates);

// Submit vote
router.post('/submit', VotingController.submitVote);

// Get voting statistics
router.get('/stats', VotingController.getVotingStats);

module.exports = router;