import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'
import { sendPushToUser } from '../lib/push'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('ADMIN'))

// GET /stats
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalUsers, activeTherapists, monthSupervisions, monthSeminars, pendingSeminars, pendingSupervisions] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { roles: { has: 'THERAPIST' } } }),
      prisma.supervision.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.seminar.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.seminar.count({ where: { status: 'PENDING' } }),
      prisma.supervision.count({ where: { status: 'PENDING' } }),
    ])

  res.json({ totalUsers, activeTherapists, monthSupervisions, monthSeminars, pendingSeminars, pendingSupervisions })
})

// GET /activity — last 10 actions across supervisions and seminars
router.get('/activity', async (_req: AuthRequest, res: Response): Promise<void> => {
  const [supervisions, seminars] = await Promise.all([
    prisma.supervision.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.seminar.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ])

  const items = [
    ...supervisions.map(s => ({
      id: s.id,
      type: 'supervision' as const,
      description: `${s.user.firstName} ${s.user.lastName} — супервізія`,
      status: s.status,
      createdAt: s.createdAt,
    })),
    ...seminars.map(s => ({
      id: s.id,
      type: 'seminar' as const,
      description: `${s.user.firstName} ${s.user.lastName} — "${s.title}"`,
      status: s.status,
      createdAt: s.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  res.json(items)
})

// GET /supervisions/pending — all pending supervisions (across all supervisors)
router.get('/supervisions/pending', async (_req: AuthRequest, res: Response): Promise<void> => {
  const supervisions = await prisma.supervision.findMany({
    where: { status: 'PENDING' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      supervisor: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  res.json(supervisions)
})

// PATCH /supervisions/:id/approve|reject (admin can act on any supervision)
router.patch('/supervisions/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string
  const supervision = await prisma.supervision.findUnique({ where: { id } })
  if (!supervision) { res.status(404).json({ error: 'Не знайдено' }); return }
  const updated = await prisma.supervision.update({ where: { id }, data: { status: 'APPROVED' } })
  res.json(updated)
  prisma.notification.create({ data: { userId: supervision.userId, type: 'SUPERVISION_APPROVED', isRead: false } }).catch(() => {})
  sendPushToUser(supervision.userId, '✅ Супервізію підтверджено', supervision.date.toLocaleDateString('uk-UA'), '/supervisions').catch(() => {})
})

router.patch('/supervisions/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string
  const supervision = await prisma.supervision.findUnique({ where: { id } })
  if (!supervision) { res.status(404).json({ error: 'Не знайдено' }); return }
  const updated = await prisma.supervision.update({ where: { id }, data: { status: 'REJECTED' } })
  res.json(updated)
  prisma.notification.create({ data: { userId: supervision.userId, type: 'SUPERVISION_REJECTED', isRead: false } }).catch(() => {})
  sendPushToUser(supervision.userId, 'Супервізію відхилено', supervision.date.toLocaleDateString('uk-UA'), '/supervisions').catch(() => {})
})

// PATCH /users/:id/roles — update user roles
router.patch('/users/:id/roles', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string
  const { roles } = req.body
  if (!Array.isArray(roles)) { res.status(400).json({ error: 'roles must be an array' }); return }

  const validRoles = ['THERAPIST', 'SUPERVISOR_CANDIDATE', 'SUPERVISOR', 'ADMIN']
  if (!roles.every(r => validRoles.includes(r))) {
    res.status(400).json({ error: 'Invalid role value' })
    return
  }

  const user = await prisma.user.update({
    where: { id },
    data: { roles },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      eftLevel: true, roles: true, createdAt: true,
    },
  })
  res.json(user)
})

export default router
