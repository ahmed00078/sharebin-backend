require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer for file uploads (store in memory, save to DB)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize database
async function initDB() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS shares (
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
      )
    `);
        console.log('Database initialized');

        // Clean up expired shares periodically
        setInterval(async () => {
            await pool.query('DELETE FROM shares WHERE expires_at < NOW()');
        }, 60000); // Every minute
    } catch (err) {
        console.error('Database initialization error:', err);
    }
}

// Generate unique short ID
function generateId() {
    return crypto.randomBytes(4).toString('hex');
}

// POST /upload - Create new share
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const id = generateId();
        const { text, expiration } = req.body;

        let expiresAt = null;
        if (expiration) {
            const hours = parseInt(expiration);
            if (hours > 0) {
                expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
            }
        }

        if (req.file) {
            // File upload
            await pool.query(
                `INSERT INTO shares (id, filename, mimetype, file_data, is_file, expires_at) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [id, req.file.originalname, req.file.mimetype, req.file.buffer, true, expiresAt]
            );
        } else if (text) {
            // Text paste
            await pool.query(
                `INSERT INTO shares (id, content, is_file, expires_at) 
         VALUES ($1, $2, $3, $4)`,
                [id, text, false, expiresAt]
            );
        } else {
            return res.status(400).json({ error: 'No content provided' });
        }

        res.json({
            id,
            url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/v/${id}`,
            expiresAt
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// GET /v/:id - Retrieve share
app.get('/v/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get and increment view count
        const result = await pool.query(
            `UPDATE shares 
       SET views = views + 1 
       WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Share not found or expired' });
        }

        const share = result.rows[0];

        // Check if max views reached
        if (share.max_views && share.views > share.max_views) {
            await pool.query('DELETE FROM shares WHERE id = $1', [id]);
            return res.status(404).json({ error: 'Share has reached maximum views' });
        }

        if (share.is_file) {
            res.json({
                type: 'file',
                filename: share.filename,
                mimetype: share.mimetype,
                data: share.file_data.toString('base64'),
                views: share.views,
                expiresAt: share.expires_at
            });
        } else {
            res.json({
                type: 'text',
                content: share.content,
                views: share.views,
                expiresAt: share.expires_at
            });
        }
    } catch (err) {
        console.error('Retrieve error:', err);
        res.status(500).json({ error: 'Failed to retrieve share' });
    }
});

// GET /stats - Simple stats endpoint
app.get('/stats', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        COUNT(*) as total_shares,
        COUNT(CASE WHEN is_file = true THEN 1 END) as total_files,
        COUNT(CASE WHEN is_file = false THEN 1 END) as total_texts,
        SUM(views) as total_views
      FROM shares
    `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`ShareBin backend running on port ${PORT}`);
    });
});