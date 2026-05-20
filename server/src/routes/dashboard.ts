import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

const router = Router()
router.use(authMiddleware)

router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [supervisions, seminars, pointsAgg] = await Promise.all([
      prisma.supervision.count({
        where: { userId: req.userId, status: 'APPROVED' },
      }),
      prisma.seminar.count({
        where: { userId: req.userId, status: 'APPROVED' },
      }),
      prisma.seminar.aggregate({
        where: { userId: req.userId, status: 'APPROVED' },
        _sum: { points: true },
      }),
    ])

    res.json({
      supervisions,
      seminars,
      points: pointsAgg._sum.points ?? 0,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/recent', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!
    const [supervisions, seminars] = await Promise.all([
      prisma.supervision.findMany({
        where: { userId },
        include: { supervisor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.seminar.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const items = [
      ...supervisions.map(s => ({
        id: s.id,
        type: 'supervision' as const,
        title: `${s.supervisor.firstName} ${s.supervisor.lastName}`,
        meta: s.type,
        status: s.status,
        date: s.date.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      ...seminars.map(s => ({
        id: s.id,
        type: 'seminar' as const,
        title: s.title,
        meta: `${s.hours} год.`,
        status: s.status,
        date: s.date.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    res.json(items)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
