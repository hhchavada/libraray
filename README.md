# Express TypeScript MongoDB Boilerplate

A production-ready, scalable Node.js + Express + TypeScript + MongoDB boilerplate project following MVC architecture with best practices.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Joi
- **Environment**: dotenv
- **HTTP Status**: http-status-codes package
- **Linting**: ESLint + Prettier

## Project Structure

```
src/
├── config/
│   ├── db.ts                  # MongoDB connection
│   └── env.ts                 # Typed env variables
├── constants/
│   ├── messages.ts            # All string messages
│   └── enums.ts               # All enums (roles, status, etc.)
├── controllers/
│   └── user.controller.ts     # Example controller
├── middlewares/
│   ├── errorHandler.ts        # Global error handler middleware
│   ├── validate.ts            # Joi validation middleware (generic)
│   └── notFound.ts            # 404 handler
├── models/
│   └── user.model.ts          # Example Mongoose model
├── routes/
│   ├── index.ts               # Root router (mounts all routes)
│   └── user.routes.ts         # Example route file
├── services/
│   └── user.service.ts        # Business logic layer
├── utils/
│   ├── ApiResponse.ts         # Standard success response class
│   ├── ApiError.ts            # Custom error class
│   └── asyncHandler.ts        # Async try/catch wrapper
├── validations/
│   └── user.validation.ts     # Joi schemas for user
├── app.ts                     # Express app setup
└── server.ts                  # Entry point
```

## Features

- **No hardcoded strings** - All messages in `constants/messages.ts`
- **No magic strings** - All enums in `constants/enums.ts`
- **Standardized responses** - All responses use `ApiResponse` class
- **Custom error handling** - All errors use `ApiError` class
- **Async error handling** - All controllers wrapped with `asyncHandler`
- **Joi validation** - Generic validation middleware
- **Business logic separation** - Services contain all business logic
- **Mongoose error handling** - Global error handler handles validation, cast, and duplicate key errors
- **TypeScript strict mode** - Full type safety

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`:
   ```
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/your-database-name
   NODE_ENV=development
   ```

### Running the Application

**Development mode** (with hot reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm run build
npm start
```

**Linting**:
```bash
npm run lint
```

## API Endpoints

### User Routes

Base URL: `/api/v1/users`

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| POST | `/` | Create a new user | `{ name, email, password, role? }` |
| GET | `/` | Get all users | - |
| GET | `/:id` | Get user by ID | - |
| PUT | `/:id` | Update user | `{ name?, status? }` |
| DELETE | `/:id` | Delete user | - |

### Example Request

**Create User:**
```bash
POST /api/v1/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "user"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User created successfully",
  "data": {
    "_id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "status": "active",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

## Architecture Rules

1. **No hardcoded strings** - All messages go in `constants/messages.ts`
2. **No magic strings** - Use enums from `constants/enums.ts` for roles/status/types
3. **All responses** must use `ApiResponse` class
4. **All errors** must use `ApiError` class
5. **All async controllers** must use `asyncHandler` wrapper
6. **Validation** is done via Joi + generic `validate` middleware
7. **Business logic** only in services - controllers only call service methods
8. **Mongoose models** use TypeScript interfaces

## Adding New Features

### 1. Create a Model

```typescript
// src/models/your.model.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IYourModel {
  // fields
}

export interface IYourDocument extends IYourModel, Document {}

const schema = new Schema<IYourDocument>({...}, { timestamps: true });

export const YourModel = mongoose.model<IYourDocument>('YourModel', schema);
```

### 2. Create Validation Schema

```typescript
// src/validations/your.validation.ts
import Joi from 'joi';

export const yourValidation = {
  create: Joi.object({...}),
  update: Joi.object({...}),
};
```

### 3. Create Service

```typescript
// src/services/your.service.ts
export const yourService = {
  async create(data) { ... },
  async getAll() { ... },
  async getById(id) { ... },
  async update(id, data) { ... },
  async delete(id) { ... },
};
```

### 4. Create Controller

```typescript
// src/controllers/your.controller.ts
export const yourController = {
  create: asyncHandler(async (req, res) => {
    const result = await yourService.create(req.body);
    res.status(201).json(new ApiResponse(201, MESSAGES.CREATED, result));
  }),
  // ... other methods
};
```

### 5. Create Routes

```typescript
// src/routes/your.routes.ts
import { Router } from 'express';
import { yourController } from '../controllers/your.controller';
import { validate } from '../middlewares/validate';
import { yourValidation } from '../validations/your.validation';

const router = Router();
router.post('/', validate(yourValidation.create), yourController.create);
// ... other routes
export default router;
```

### 6. Mount Routes

```typescript
// src/routes/index.ts
import yourRouter from './your.routes';
router.use('/your-resource', yourRouter);
```

### 7. Add Messages and Enums

```typescript
// src/constants/messages.ts
export const MESSAGES = {
  // ... existing messages
  YOUR_RESOURCE_CREATED: 'Your resource created successfully',
  // ... more messages
};

// src/constants/enums.ts
export enum YourEnum {
  VALUE1 = 'value1',
  VALUE2 = 'value2',
}
```

## License

ISC
