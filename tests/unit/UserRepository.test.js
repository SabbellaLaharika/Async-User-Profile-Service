const UserRepository = require('../../src/repositories/UserRepository');

describe('UserRepository Unit Tests', () => {
  let mockDb;
  let userRepository;

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    };
    userRepository = new UserRepository(mockDb);
  });

  describe('findAll', () => {
    it('should query total count and paginated list with correct limits', async () => {
      mockDb.query
        .mockResolvedValueOnce([[{ total: 3 }]]) // count query
        .mockResolvedValueOnce([[{ id: '1', name: 'Alice', email: 'alice@example.com', preferences: '{"theme":"dark"}' }]]); // rows query

      const result = await userRepository.findAll(1, 10);
      
      expect(mockDb.query).toHaveBeenNthCalledWith(1, 'SELECT COUNT(*) as total FROM users');
      expect(mockDb.query).toHaveBeenNthCalledWith(2, 'SELECT id, name, email, preferences, created_at, updated_at FROM users LIMIT ? OFFSET ?', [10, 0]);
      expect(result).toEqual({
        total: 3,
        users: [{ id: '1', name: 'Alice', email: 'alice@example.com', preferences: { theme: 'dark' } }]
      });
    });

    it('should default to page 1 and limit 10', async () => {
      mockDb.query
        .mockResolvedValueOnce([[{ total: 0 }]])
        .mockResolvedValueOnce([[]]);

      await userRepository.findAll();
      expect(mockDb.query).toHaveBeenNthCalledWith(2, 'SELECT id, name, email, preferences, created_at, updated_at FROM users LIMIT ? OFFSET ?', [10, 0]);
    });
  });

  describe('findById', () => {
    it('should query by id and return user', async () => {
      mockDb.query.mockResolvedValueOnce([[{ id: '1', name: 'Alice', email: 'alice@example.com', preferences: '{"theme":"dark"}' }]]);

      const result = await userRepository.findById('1');

      expect(mockDb.query).toHaveBeenCalledWith('SELECT id, name, email, preferences, created_at, updated_at FROM users WHERE id = ?', ['1']);
      expect(result).toEqual({ id: '1', name: 'Alice', email: 'alice@example.com', preferences: { theme: 'dark' } });
    });

    it('should return null when user is not found', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);
      const result = await userRepository.findById('99');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should execute INSERT query and return user object without password_hash', async () => {
      mockDb.query.mockResolvedValueOnce([]); // insert execution

      const userData = {
        id: '1',
        name: 'Alice',
        email: 'alice@example.com',
        password_hash: 'hashed',
        preferences: { theme: 'dark' }
      };

      const result = await userRepository.create(userData);

      expect(mockDb.query).toHaveBeenCalledWith(
        'INSERT INTO users (id, name, email, password_hash, preferences) VALUES (?, ?, ?, ?, ?)',
        ['1', 'Alice', 'alice@example.com', 'hashed', JSON.stringify({ theme: 'dark' })]
      );
      expect(result).toEqual({
        id: '1',
        name: 'Alice',
        email: 'alice@example.com',
        preferences: { theme: 'dark' }
      });
    });
  });

  describe('update', () => {
    it('should execute dynamic UPDATE query and return updated user', async () => {
      // Mock update execution
      mockDb.query.mockResolvedValueOnce([]);
      // Mock findById after update
      mockDb.query.mockResolvedValueOnce([[{ id: '1', name: 'Alice', email: 'new@example.com', preferences: '{"theme":"light"}' }]]);

      const result = await userRepository.update('1', {
        email: 'new@example.com',
        preferences: { theme: 'light' }
      });

      expect(mockDb.query).toHaveBeenNthCalledWith(
        1,
        'UPDATE users SET email = ?, preferences = ? WHERE id = ?',
        ['new@example.com', JSON.stringify({ theme: 'light' }), '1']
      );
      expect(result).toEqual({
        id: '1',
        name: 'Alice',
        email: 'new@example.com',
        preferences: { theme: 'light' }
      });
    });

    it('should skip update and return user if updatedData is empty', async () => {
      // Mock findById query
      mockDb.query.mockResolvedValueOnce([[{ id: '1', name: 'Alice', email: 'alice@example.com', preferences: '{"theme":"dark"}' }]]);

      const result = await userRepository.update('1', {});

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT id, name, email, preferences, created_at, updated_at FROM users WHERE id = ?', ['1']);
      expect(result).toEqual({ id: '1', name: 'Alice', email: 'alice@example.com', preferences: { theme: 'dark' } });
    });
  });
});
