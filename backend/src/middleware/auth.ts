import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nursesch-dev-secret-key';

export interface AuthPayload {
  nurseId: number;
  role: string;
  wardId: number;
}

// JWT 토큰에서 사용자 정보를 추출하여 req에 첨부
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
}

// 관리자 권한 확인
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthPayload;
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다' });
  }
  next();
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
