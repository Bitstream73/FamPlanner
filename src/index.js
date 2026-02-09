import express from 'express';

export function createApp() {
  const app = express();
  app.get('/api/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));
  return app;
}

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
