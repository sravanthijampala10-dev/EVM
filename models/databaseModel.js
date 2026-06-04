// This file contains database models and utilities
// Currently using direct SQL queries in routes for simplicity
// In a larger application, you would define models here

class User {
    constructor(aadharNumber, name, age) {
        this.aadharNumber = aadharNumber;
        this.name = name;
        this.age = age;
        this.hasVoted = false;
        this.fingerprintHash = null;
    }
}

class Candidate {
    constructor(name, party, symbol) {
        this.name = name;
        this.party = party;
        this.symbol = symbol;
        this.votes = 0;
    }
}

class Vote {
    constructor(voterAadhar, candidateId, fingerprintHash) {
        this.voterAadhar = voterAadhar;
        this.candidateId = candidateId;
        this.fingerprintHash = fingerprintHash;
        this.timestamp = new Date();
    }
}

module.exports = {
    User,
    Candidate,
    Vote
};