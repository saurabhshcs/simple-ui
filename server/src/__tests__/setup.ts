// Set environment variables BEFORE any module imports so that config/database
// picks up :memory: and crypto services use predictable test secrets.
process.env['DB_PATH'] = ':memory:';
process.env['JWT_SECRET'] = 'a'.repeat(64);
process.env['ENCRYPTION_SECRET'] = 'test-encryption-secret-for-unit-tests';
process.env['NODE_ENV'] = 'test';
process.env['CLIENT_URL'] = 'http://localhost:5173';
process.env['SMTP_HOST'] = '127.0.0.1';
process.env['SMTP_PORT'] = '1025';
