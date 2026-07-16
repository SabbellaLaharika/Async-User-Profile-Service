const pool = require('../database');
const UserRepository = require('../repositories/UserRepository');
const userRepository = new UserRepository(pool);

class ProfileUpdateService {
  /**
   * Processes the profile update.
   * @param {string} userId - The user ID.
   * @param {object} updateData - Data containing fields to update (email, preferences).
   */
  async processUpdate(userId, updateData) {
    // 1. Check if the user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    const payload = {};

    // 2. Handle email update and uniqueness verification
    if (updateData.newEmail) {
      const email = updateData.newEmail.trim().toLowerCase();
      // Check if email is already in use by another user
      const [rows] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (rows.length > 0) {
        throw new Error(`Email ${email} is already in use by another user.`);
      }
      payload.email = email;
    }

    // 3. Handle preferences update (overwriting or merging; standard is overwrite according to request payload)
    if (updateData.newPreferences) {
      payload.preferences = updateData.newPreferences;
    }

    // 4. If nothing to update, return the current user
    if (Object.keys(payload).length === 0) {
      return user;
    }

    // 5. Update user via UserRepository
    const updatedUser = await userRepository.update(userId, payload);
    return updatedUser;
  }
}

module.exports = new ProfileUpdateService();
