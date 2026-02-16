import { Router } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const ruleRouter = Router();

ruleRouter.use(authMiddleware);

// GET /api/rules/:wardId — 병동 규칙 조회
ruleRouter.get('/:wardId', async (req, res) => {
  try {
    const rule = await prisma.rule.findUnique({
      where: { wardId: Number(req.params.wardId) },
    });
    if (!rule) return res.status(404).json({ error: '규칙을 찾을 수 없습니다' });

    // constraintWeights JSON 파싱
    res.json({
      ...rule,
      constraintWeights: JSON.parse(rule.constraintWeights),
    });
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// PUT /api/rules/:wardId — 병동 규칙 수정
ruleRouter.put('/:wardId', adminOnly, async (req, res) => {
  try {
    const { constraintWeights, ...rest } = req.body;
    const data: any = { ...rest };
    if (constraintWeights) {
      data.constraintWeights = JSON.stringify(constraintWeights);
    }

    const rule = await prisma.rule.update({
      where: { wardId: Number(req.params.wardId) },
      data,
    });
    res.json({
      ...rule,
      constraintWeights: JSON.parse(rule.constraintWeights),
    });
  } catch { res.status(500).json({ error: '서버 오류' }); }
});
