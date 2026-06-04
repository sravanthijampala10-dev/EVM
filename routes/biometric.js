const express = require('express');
const router = express.Router();
const BiometricController = require('../controllers/biometricController');

// Registration routes
router.post('/register/options', BiometricController.generateRegistrationOptions);
router.post('/register/verify', BiometricController.verifyRegistration);

// Authentication routes
router.post('/login/options', BiometricController.generateAuthenticationOptions);
router.post('/login/verify', BiometricController.verifyAuthentication);

module.exports = router;
