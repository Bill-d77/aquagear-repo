const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const mode = process.argv[2];

if (!['local', 'prod'].includes(mode)) {
    console.error('Usage: node scripts/switch-db.js <local|prod>');
    process.exit(1);
}

let content = fs.readFileSync(schemaPath, 'utf8');

if (mode === 'local') {
    content = content.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
    console.log('Switched to SQLite (local)');
} else {
    content = content.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
    console.log('Switched to PostgreSQL (production)');
}

fs.writeFileSync(schemaPath, content);
