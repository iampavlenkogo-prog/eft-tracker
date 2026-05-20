import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'

export interface AuthRequest extends Request {
  userId?: string
  userRoles?: string[]
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; roles: string[] }
    req.userId = decoded.userId

    // Always fetch roles from DB so role changes take effect without re-login
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { roles: true },
    })
    req.userRoles = user?.roles ?? decoded.roles

    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
