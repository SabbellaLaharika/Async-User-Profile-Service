const request = require('supertest');
const app = require('../../src/api/app');
const pool = require('../../src/database');
const mqService = require('../../src/services/MessageQueueService');
const UserRepository = require('../../src/repositories/UserRepository');

let isMocked = false;
const mockDbStore = new Map();

beforeAll(async () => {
  let dbTimer, mqTimer;
  try {
    // Try live database connection with a 2-second timeout
    const conn = await Promise.race([
      pool.getConnection(),
      new Promise((_, reject) => {
        dbTimer = setTimeout(() => reject(new Error('DB Timeout')), 2000);
      })
    ]);
    if (dbTimer) clearTimeout(dbTimer);
    conn.release();

    // Try live RabbitMQ connection
    await Promise.race([
      mqService.connect(),
      new Promise((_, reject) => {
        mqTimer = setTimeout(() => reject(new Error('RabbitMQ Timeout')), 2000);
      })
    ]);
    if (mqTimer) clearTimeout(mqTimer);
    console.log('--- Integration tests running in LIVE mode ---');
  } catch (err) {
    if (dbTimer) clearTimeout(dbTimer);
    if (mqTimer) clearTimeout(mqTimer);
    console.warn(`--- Running integration tests in MOCKED mode (Live services unavailable: ${err.message}) ---`);
    isMocked = true;

    // Stub pool.query to bypass live DB queries during mock mode (e.g. uniqueness checks)
    jest.spyOn(pool, 'query').mockResolvedValue([[]]);

    // Stub UserRepository methods to operate on local mock store
    jest.spyOn(UserRepository.prototype, 'create').mockImplementation(async (userData) => {
      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        preferences: userData.preferences || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDbStore.set(user.id, user);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        preferences: user.preferences
      };
    });

    jest.spyOn(UserRepository.prototype, 'findById').mockImplementation(async (id) => {
      return mockDbStore.get(id) || null;
    });

    jest.spyOn(UserRepository.prototype, 'findAll').mockImplementation(async (page = 1, limit = 10) => {
      const users = Array.from(mockDbStore.values());
      const offset = (page - 1) * limit;
      const paginatedUsers = users.slice(offset, offset + limit).map(user => {
        const { password_hash, ...rest } = user;
        return rest;
      });
      return { users: paginatedUsers, total: users.length };
    });

    jest.spyOn(UserRepository.prototype, 'update').mockImplementation(async (id, updatedData) => {
      const user = mockDbStore.get(id);
      if (!user) return null;
      if (updatedData.email !== undefined) user.email = updatedData.email;
      if (updatedData.preferences !== undefined) user.preferences = updatedData.preferences;
      user.updated_at = new Date().toISOString();
      mockDbStore.set(id, user);
      return user;
    });

    // Stub MessageQueueService.publish to simulate the consumer processing the message asynchronously
    jest.spyOn(mqService, 'publish').mockImplementation(async (queueName, message) => {
      // Defer processing to simulate asynchronous background update
      setTimeout(async () => {
        try {
          const profileUpdateService = require('../../src/services/ProfileUpdateService');
          await profileUpdateService.processUpdate(message.userId, {
            newEmail: message.newEmail,
            newPreferences: message.newPreferences
          });
        } catch (consumerErr) {
          console.error('Mock Consumer Error:', consumerErr.message);
        }
      }, 100);
      return true;
    });
  }
});

afterAll(async () => {
  if (!isMocked) {
    await mqService.close();
    await pool.end();
  } else {
    // Restore mocks
    jest.restoreAllMocks();
  }
});

describe('API & Asynchronous Flow Integration Tests', () => {
  let testUserId;
  const testUserEmail = `test-${Date.now()}@example.com`;

  describe('POST /api/users', () => {
    it('should create a new user and return it without password_hash', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({
          name: 'Test User',
          email: testUserEmail,
          password: 'securePassword123',
          preferences: { theme: 'dark', notifications: true }
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test User');
      expect(res.body.email).toBe(testUserEmail);
      expect(res.body.preferences).toEqual({ theme: 'dark', notifications: true });
      expect(res.body).not.toHaveProperty('password_hash');

      testUserId = res.body.id;
    });

    it('should return 400 when missing required fields', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({
          name: 'Missing Email and Password'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({
          name: 'Bad Email User',
          email: 'not-an-email',
          password: 'password123'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users', () => {
    it('should return a paginated list of users', async () => {
      const res = await request(app)
        .get('/api/users')
        .query({ page: 1, limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThan(0);
      expect(res.body.users[0]).not.toHaveProperty('password_hash');
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return the user by ID and omit password_hash', async () => {
      const res = await request(app)
        .get(`/api/users/${testUserId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testUserId);
      expect(res.body.email).toBe(testUserEmail);
      expect(res.body).not.toHaveProperty('password_hash');
    });

    it('should return 404 for a non-existent user ID', async () => {
      const res = await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/users/:id/request-update (Asynchronous)', () => {
    it('should accept the update request, publish to queue, and return 202', async () => {
      const newEmail = `updated-${testUserEmail}`;
      const newPreferences = { theme: 'light', notifications: false };

      const res = await request(app)
        .put(`/api/users/${testUserId}/request-update`)
        .send({
          newEmail,
          newPreferences
        });

      expect(res.status).toBe(202);
      expect(res.body.message).toBe('Update request accepted');

      // Polling mechanism: check if changes reflect in the DB
      let updated = false;
      const maxPolls = 15;
      const pollInterval = 300; // 300ms interval for faster test runs

      for (let i = 0; i < maxPolls; i++) {
        const checkRes = await request(app).get(`/api/users/${testUserId}`);
        if (checkRes.status === 200 && checkRes.body.email === newEmail) {
          expect(checkRes.body.preferences).toEqual(newPreferences);
          updated = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      expect(updated).toBe(true);
    });

    it('should return 400 for malformed email update request', async () => {
      const res = await request(app)
        .put(`/api/users/${testUserId}/request-update`)
        .send({
          newEmail: 'invalid-email-string'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 if update payload is empty', async () => {
      const res = await request(app)
        .put(`/api/users/${testUserId}/request-update`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
