import { Response, NextFunction } from 'express'
import { AuthRequest } from './authMiddleware'

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRoles || !roles.some(r => req.userRoles!.includes(r))) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}
