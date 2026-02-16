import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';
import { signToken, authMiddleware } from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/login — 로그인
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const nurse = await prisma.nurse.findUnique({ where: { email } });
    if (!nurse) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }

    const valid = await bcrypt.compare(password, nurse.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }

    const token = signToken({
      nurseId: nurse.id,
      role: nurse.role,
      wardId: nurse.wardId,
    });

    const { passwordHash, ...nurseData } = nurse;
    res.json({ token, nurse: nurseData });
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// GET /api/auth/me — 현재 사용자 정보 조회
authRouter.get('/me', authMiddleware, async (req, res) => {
  try {
    const { nurseId } = (req as any).user;
    const nurse = await prisma.nurse.findUnique({
      where: { id: nurseId },
      select: {
        id: true, wardId: true, name: true, email: true,
        role: true, skillLevel: true, createdAt: true, updatedAt: true,
      },
    });
    if (!nurse) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    res.json(nurse);
  } catch {
    res.status(500).json({ error: '서버 오류' });
  }
});
