import dotenv from 'dotenv';

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  databasePath: process.env.DATABASE_PATH || './data/database.sqlite',
  geminiApiKey: process.env.GEMINI_API_KEY,
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeIndexHost: process.env.PINECONE_INDEX_HOST,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  sessionSecret: process.env.SESSION_SECRET,
};

export default config;
