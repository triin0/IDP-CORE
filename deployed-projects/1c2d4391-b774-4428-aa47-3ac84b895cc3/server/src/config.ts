import dotenv from 'dotenv';
dotenv.config();

// Helper function to get and validate environment variables
function getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
}

// Application configuration object
export const config = {
    PORT: getEnv('PORT'),
    NODE_ENV: getEnv('NODE_ENV'),
    DATABASE_URL: getEnv('DATABASE_URL'),
    CLIENT_URL: getEnv('CLIENT_URL'),
};
