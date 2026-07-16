-- Create Database if not exists
CREATE DATABASE IF NOT EXISTS profile_db;
USE profile_db;

-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  preferences JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed Data (using bcrypt hash for 'password123' -> $2a$10$tM3Vep9m2vN.bBvIqfI3ue.6UaZJz8cKk/oKj44N7KspK2R9xXmxe)
INSERT INTO users (id, name, email, password_hash, preferences) VALUES
('a2c3a5e8-1111-4444-9999-666666666661', 'Alice Johnson', 'alice@example.com', '$2a$10$tM3Vep9m2vN.bBvIqfI3ue.6UaZJz8cKk/oKj44N7KspK2R9xXmxe', '{"theme": "dark", "notifications": true}'),
('b2c3a5e8-2222-4444-9999-666666666662', 'Bob Smith', 'bob@example.com', '$2a$10$tM3Vep9m2vN.bBvIqfI3ue.6UaZJz8cKk/oKj44N7KspK2R9xXmxe', '{"theme": "light", "notifications": false}'),
('c2c3a5e8-3333-4444-9999-666666666663', 'Charlie Brown', 'charlie@example.com', '$2a$10$tM3Vep9m2vN.bBvIqfI3ue.6UaZJz8cKk/oKj44N7KspK2R9xXmxe', '{"theme": "dark", "notifications": false}');
