import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { authRouter } from './routes/auth.js';
import { wardRouter } from './routes/wards.js';
import { nurseRouter } from './routes/nurses.js';
import { ruleRouter } from './routes/rules.js';
import { scheduleRouter } from './routes/schedules.js';
import { shiftRequestRouter } from './routes/shiftRequests.js';
import { holidayRouter } from './routes/holidays.js';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API 라우트
app.use('/api/auth', authRouter);
app.use('/api/wards', wardRouter);
app.use('/api/nurses', nurseRouter);
app.use('/api/rules', ruleRouter);
app.use('/api/schedules', scheduleRouter);
app.use('/api/shift-requests', shiftRequestRouter);
app.use('/api/holidays', holidayRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`NurseSch backend running on port ${PORT}`);
});

export default app;
