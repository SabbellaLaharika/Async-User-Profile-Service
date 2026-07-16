# Stage 1: Install dependencies
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# Stage 2: Production environment
FROM node:18-alpine AS runner
WORKDIR /usr/src/app
COPY package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .

EXPOSE 3000
