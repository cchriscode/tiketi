const express = require('express');
const authRouter = require('./auth');

const router = express.Router();

// Routes
router.use('/', authRouter);

module.exports = router;
