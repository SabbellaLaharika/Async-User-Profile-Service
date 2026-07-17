// src/repositories/UserRepository.js
// Abstracts database queries for User entities
class UserRepository {
  constructor(dbPool) {
    this.db = dbPool;
  }

  // Retrieves a paginated list of users
  // Params: page (number), limit (number)
  // Returns: { users: Array, total: number }
  async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await this.db.query('SELECT COUNT(*) as total FROM users');
    const total = countResult[0].total;

    // Get paginated users
    const [rows] = await this.db.query(
      'SELECT id, name, email, preferences, created_at, updated_at FROM users LIMIT ? OFFSET ?',
      [parseInt(limit, 10), parseInt(offset, 10)]
    );

    // Ensure preferences is parsed if returned as string (though mysql2 typically parses JSON automatically)
    const formattedUsers = rows.map(user => ({
      ...user,
      preferences: typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences
    }));

    return { users: formattedUsers, total };
  }

  // Retrieves a single user by ID
  async findById(id) {
    const [rows] = await this.db.query(
      'SELECT id, name, email, preferences, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (rows.length === 0) return null;

    const user = rows[0];
    return {
      ...user,
      preferences: typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences
    };
  }

  // Inserts a new user record
  async create(userData) {
    const { id, name, email, password_hash, preferences } = userData;
    const prefs = preferences ? JSON.stringify(preferences) : JSON.stringify({});

    await this.db.query(
      'INSERT INTO users (id, name, email, password_hash, preferences) VALUES (?, ?, ?, ?, ?)',
      [id, name, email, password_hash, prefs]
    );

    return {
      id,
      name,
      email,
      preferences: preferences || {}
    };
  }

  // Updates specific fields of an existing user
  async update(id, updatedData) {
    const fields = [];
    const values = [];

    if (updatedData.email !== undefined) {
      fields.push('email = ?');
      values.push(updatedData.email);
    }
    if (updatedData.preferences !== undefined) {
      fields.push('preferences = ?');
      values.push(JSON.stringify(updatedData.preferences));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.query(query, values);

    return this.findById(id);
  }
}

module.exports = UserRepository;
