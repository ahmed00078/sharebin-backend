# ShareBin Backend

A Node.js/Express backend API for ShareBin - a simple file and text sharing service with expiring links.

## Features

- **Text & File Sharing**: Upload text content or files up to 10MB
- **Expiring Links**: Set automatic expiration (1 hour to 1 week, or never)
- **View Tracking**: Monitor how many times a share has been accessed
- **Auto Cleanup**: Expired shares are automatically deleted
- **PostgreSQL Storage**: Files and text stored in database with metadata

## Tech Stack

- **Node.js** with Express.js
- **PostgreSQL** for data storage
- **Multer** for file upload handling
- **CORS** enabled for frontend communication

## API Endpoints

### POST /upload
Create a new share with text or file content.

**Body Parameters:**
- `text` (string, optional): Text content to share
- `file` (file, optional): File to upload (max 10MB)
- `expiration` (string): Hours until expiration (1, 6, 24, 168, or 0 for never)

**Response:**
```json
{
  "id": "a1b2c3d4",
  "url": "http://frontend-url/v/a1b2c3d4",
  "expiresAt": "2024-01-15T10:30:00.000Z"
}
```

### GET /v/:id
Retrieve a shared item by its ID.

**Response (Text):**
```json
{
  "type": "text",
  "content": "Shared text content",
  "views": 5,
  "expiresAt": "2024-01-15T10:30:00.000Z"
}
```

**Response (File):**
```json
{
  "type": "file",
  "filename": "document.pdf",
  "mimetype": "application/pdf",
  "data": "base64-encoded-file-data",
  "views": 3,
  "expiresAt": "2024-01-15T10:30:00.000Z"
}
```

### GET /stats
Get basic usage statistics.

**Response:**
```json
{
  "total_shares": "150",
  "total_files": "75",
  "total_texts": "75",
  "total_views": "1250"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sharebin

# Server
PORT=3001
NODE_ENV=production

# Frontend URL (for generating share links)
FRONTEND_URL=https://your-frontend-domain.com
```

## Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up PostgreSQL:**
   - Create a PostgreSQL database
   - Update `DATABASE_URL` in your `.env` file

3. **Run the application:**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

4. **Database initialization:**
   The application automatically creates the required `shares` table on startup.

## Database Schema

```sql
CREATE TABLE shares (
  id VARCHAR(8) PRIMARY KEY,
  content TEXT,
  filename VARCHAR(255),
  mimetype VARCHAR(100),
  file_data BYTEA,
  is_file BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  views INTEGER DEFAULT 0,
  max_views INTEGER
);
```

## Deployment

This backend is configured for deployment on Railway.app with the included `railway.toml` configuration.

## Development

- The server runs on `http://localhost:3001` by default
- CORS is enabled for cross-origin requests from the frontend
- Expired shares are cleaned up automatically every minute
- File size limit: 10MB per upload
- JSON body limit: 10MB