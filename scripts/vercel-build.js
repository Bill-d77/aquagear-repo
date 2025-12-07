const { execSync } = require('child_process');

function runCommand(command) {
    console.log(`Running: ${command}`);
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        console.error(error.message);
        process.exit(1);
    }
}

console.log('Starting Vercel build process...');

if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
}

// 1. Switch to Production Database Schema (PostgreSQL)
runCommand('node scripts/switch-db.js prod');

// 2. Deploy Migrations (using db push to avoid provider mismatch)
runCommand('npx prisma db push');

// 3. Seed Database
runCommand('npm run seed');

// 4. Generate Prisma Client
runCommand('npx prisma generate');

// 5. Build Next.js App
runCommand('next build');

console.log('Vercel build completed successfully.');
