const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const pool = require('../../database');
const UserRepository = require('../../repositories/UserRepository');

const userRepository = new UserRepository(pool);

// Joi Schemas for Validation
const createUserSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  preferences: Joi.object().optional()
});

const requestUpdateSchema = Joi.object({
  newEmail: Joi.string().email().optional(),
  newPreferences: Joi.object().optional()
}).or('newEmail', 'newPreferences');

class UserController {
  // POST /api/users
  async createUser(req, res, next) {
    try {
      const { error, value } = createUserSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const { name, email, password, preferences } = value;

      // Hash password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Generate UUID
      const id = randomUUID();

      // Save user profile
      const newUser = await userRepository.create({
        id,
        name,
        email,
        password_hash,
        preferences
      });

      return res.status(201).json(newUser);
    } catch (err) {
      // Check for duplicate key entry error from MySQL (ER_DUP_ENTRY)
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Email already exists' });
      }
      next(err);
    }
  }

  // GET /api/users
  async getUsers(req, res, next) {
    try {
      let { page = 1, limit = 10 } = req.query;

      page = parseInt(page, 10);
      limit = parseInt(limit, 10);

      if (isNaN(page) || page <= 0) page = 1;
      if (isNaN(limit) || limit <= 0) limit = 10;

      const result = await userRepository.findAll(page, limit);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/users/:id
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userRepository.findById(id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/users/:id/request-update (placeholder for Phase 4)
  async requestUpdate(req, res, next) {
    try {
      const { error } = requestUpdateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      // To be implemented in Phase 4
      return res.status(501).json({ message: 'Not Implemented Yet' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
