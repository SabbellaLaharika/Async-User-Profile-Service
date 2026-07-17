# Asynchronous User Profile Service

A robust backend User Profile Service built with Node.js, Express.js, MySQL, and RabbitMQ. This application leverages the Repository Pattern for data access separation and RabbitMQ for asynchronous, non-blocking profile update processing.

---

## Architectural Overview

To ensure optimal responsiveness, heavy write operations (profile email or preference updates) are processed asynchronously through a background consumer worker process.

1. **Client** makes a `PUT /api/users/:id/request-update` request.
2. **API Container (Express)** validates the payload and publishes an update request message to the RabbitMQ `profile_update_queue`.
3. **API Container** immediately responds with `202 Accepted` to the client.
4. **RabbitMQ Broker** routes and buffers the message.
5. **Consumer Container (Worker)** continuously listens to `profile_update_queue`.
6. Upon receipt, the **Consumer** fetches the user profile, executes validation logic (e.g. checking email uniqueness), updates the database via the **UserRepository**, and acknowledges the message (`ack`).

---

## Project Structure

```text
Async-User-Profile-Service/
├── .env.example                     // Template for environment variables
├── .gitignore                       // Git ignore configuration
├── Dockerfile                       // Multi-stage builder for API and Consumer
├── docker-compose.yml               // Orchestrates API, Consumer, MySQL, RabbitMQ
├── init.sql                         // Seed script for the MySQL database
├── package.json                     // Node dependencies and run scripts
├── README.md                        // Project documentation
├── src/
│   ├── api/                         // Express API service
│   │   ├── app.js                   // Express app configuration
│   │   ├── controllers/             // Request handlers
│   │   │   └── userController.js
│   │   ├── routes/                  // Route handlers
│   │   │   └── userRoutes.js
│   │   └── server.js                // API Entrypoint
│   ├── consumer/                    // Background consumer service
│   │   └── index.js                 // Worker Entrypoint
│   ├── database/                    // Database connection pool module
│   │   └── index.js
│   ├── repositories/                // Data Access Layer
│   │   └── UserRepository.js
│   └── services/                    // Business logic & MQ integration
│       ├── MessageQueueService.js
│       └── ProfileUpdateService.js
└── tests/                           // Automated testing suite
    ├── integration/
    │   └── api.test.js              // End-to-end and API routes tests
    └── unit/
        └── UserRepository.test.js   // UserRepository unit tests
```

---

## Prerequisites

- [Docker](https://www.docker.com/) and **Docker Compose** installed.
- [Node.js (v18+)](https://nodejs.org/) (optional, only needed for local test runs outside of containers).

---

## Getting Started

### 1. Configure Environment Variables
Copy the template `.env.example` into a new `.env` file at the root directory:
```bash
cp .env.example .env
```
*(The default values in `.env.example` are preconfigured to connect seamlessly inside the Docker Compose bridge network).*

### 2. Run the Application
Start the entire service stack (Database, RabbitMQ, API, and Consumer Worker) with a single command:
```bash
docker-compose up --build
```
This command builds the images, initializes the MySQL schema with seed records (defined in `init.sql`), establishes RabbitMQ queues, and launches the services.

- **API Service**: Exposed at `http://localhost:3000`
- **MySQL DB**: Running on port `3306`
- **RabbitMQ Management Console**: Exposed at `http://localhost:15672` (Username: `guest`, Password: `guest`)

### 3. Shutting Down
To stop and clean up containers, networks, and volumes, run:
```bash
docker-compose down -v
```

---

## API Documentation

All request and response bodies use JSON.

### 1. Create User Profile
* **Endpoint**: `POST /api/users`
* **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "supersecretpassword",
    "preferences": {
      "theme": "dark",
      "notifications": true
    }
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "id": "e4c3a5e8-1111-4444-9999-666666666661",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "preferences": {
      "theme": "dark",
      "notifications": true
    }
  }
  ```
  *(Note: The `password_hash` is securely encrypted using bcrypt and omitted from all API responses).*

---

### 2. Get User Profiles (Paginated)
* **Endpoint**: `GET /api/users`
* **Query Parameters**:
  * `page` (number, default: `1`)
  * `limit` (number, default: `10`)
* **Response (200 OK)**:
  ```json
  {
    "users": [
      {
        "id": "a2c3a5e8-1111-4444-9999-666666666661",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "preferences": {
          "theme": "dark",
          "notifications": true
        },
        "created_at": "2026-07-16T14:43:29.000Z",
        "updated_at": "2026-07-16T14:43:29.000Z"
      }
    ],
    "total": 4
  }
  ```

---

### 3. Get User Profile by ID
* **Endpoint**: `GET /api/users/:id`
* **Response (200 OK)**:
  ```json
  {
    "id": "a2c3a5e8-1111-4444-9999-666666666661",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "preferences": {
      "theme": "dark",
      "notifications": true
    },
    "created_at": "2026-07-16T14:43:29.000Z",
    "updated_at": "2026-07-16T14:43:29.000Z"
  }
  ```
* **Response (404 Not Found)**:
  ```json
  {
    "error": "User not found"
  }
  ```

---

### 4. Request Asynchronous Profile Update
Submit profile modifications without blocking the server response cycle.
* **Endpoint**: `PUT /api/users/:id/request-update`
* **Request Body** (Contains optional `newEmail` and/or `newPreferences`):
  ```json
  {
    "newEmail": "john.new@example.com",
    "newPreferences": {
      "theme": "light",
      "notifications": false
    }
  }
  ```
* **Response (202 Accepted)**:
  ```json
  {
    "message": "Update request accepted"
  }
  ```

---

## Running Tests

Automated tests are located in the `tests/` directory and run using **Jest**.

To execute the test suite (both unit tests and integration tests) locally:
```bash
npm install
npm test
```
*(The integration test suite automatically detects if live MySQL/RabbitMQ dependencies are running. If they are absent, it falls back to spied mocks to verify routes and queue flows seamlessly).*
