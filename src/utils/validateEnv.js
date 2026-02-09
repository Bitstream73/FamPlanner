const REQUIRED_VARS = [
  'GEMINI_API_KEY',
  'PINECONE_API_KEY',
  'PINECONE_INDEX_HOST',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SESSION_SECRET',
];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  return {
    valid: missing.length === 0,
    missing,
  };
}
