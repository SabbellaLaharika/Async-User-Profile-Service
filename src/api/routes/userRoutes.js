const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Synchronous endpoints
router.post('/', userController.createUser);
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);

// Asynchronous endpoint
router.put('/:id/request-update', userController.requestUpdate);

module.exports = router;
