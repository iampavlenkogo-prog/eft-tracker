import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'

const router = Router()
router.use(authMiddleware)

router.get('/supervisors', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supervisors = await prisma.user.findMany({
      where: { OR: [{ roles: { has: 'SUPERVISOR' } }, { roles: { has: 'SUPERVISOR_CANDIDATE' } }] },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: 'asc' },
    })
    res.json(supervisors)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/', requireRole('ADMIN'), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, eftLevel: true, roles: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(users)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
