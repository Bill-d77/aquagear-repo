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

// Generate Prisma Client. Schema migrations and seed scripts must be run
// explicitly after backing up or branching the production Neon database.
runCommand('npx prisma generate');

// Build Next.js App
runCommand('next build');

console.log('Vercel build completed successfully.');
