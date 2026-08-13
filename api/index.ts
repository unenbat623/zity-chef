import 'dotenv/config';
import { createApp } from '../server/app.js';

// Vercel serverless entry — reuses the exact same Express app (and therefore the
// same inventory/orders/ai routes and auth) as the long-running server, so the
// two deployment targets can never drift.
const app = createApp();

export default app;
