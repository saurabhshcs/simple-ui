import app from './app';
import { config } from './config/index';
import { db } from './config/database';
import path from 'path';
import fs from 'fs';

// Ensure upload directories exist
const uploadDirs = [
  path.join(config.uploadDir, 'backgrounds'),
  path.join(config.uploadDir, 'chat'),
  path.join(__dirname, '../data'),
];
for (const dir of uploadDirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Run migrations on startup
async function start() {
  await db.migrate.latest();
  console.log('Database migrations applied');

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
