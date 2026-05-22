import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'
import {
  sendSupervisionRequest,
  sendSupervisionApproved,
  sendSupervisionRejected,
} from '../lib/email'
import { sendPushToUser } from '../lib/push'

const router = Router()
router.use(authMiddleware)

// ── helpers (fire-and-forget email, never blocks the response) ────────────────

async function notifyRequest(supervisorId: string, therapistId: string, date: Date, type: string) {
  try {
    const [supervisor, therapist] = await Promise.all([
      prisma.user.findUnique({ where: { id: supervisorId }, select: { email: true } }),
      prisma.user.findUnique({ where: { id: therapistId }, select: { firstName: true, lastName: true } }),
    ])
    if (supervisor && therapist) {
      const name = `${therapist.firstName} ${therapist.lastName}`
      await sendSupervisionRequest(supervisor.email, name, date.toLocaleDateString('uk-UA'), type)
      await prisma.notification.create({
        data: { userId: supervisorId, type: 'SUPERVISION_REQUEST', isRead: false },
      })
      sendPushToUser(supervisorId, 'Нова заявка на супервізію', `Від ${name}`, '/supervisor').catch(() => {})
    }
  } catch (err) { console.error('Email error:', err) }
}

async function notifyApproved(userId: string, date: Date, type: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (user) {
      await sendSupervisionApproved(user.email, date.toLocaleDateString('uk-UA'), type)
      await prisma.notification.create({
        data: { userId, type: 'SUPERVISION_APPROVED', isRead: false },
      })
      sendPushToUser(userId, '✅ Супервізію підтверджено', date.toLocaleDateString('uk-UA'), '/supervisions').catch(() => {})
    }
  } catch (err) { console.error('Email error:', err) }
}

async function notifyRejected(userId: string, date: Date, type: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (user) {
      await sendSupervisionRejected(user.email, date.toLocaleDateString('uk-UA'), type)
      await prisma.notification.create({
        data: { userId, type: 'SUPERVISION_REJECTED', isRead: false },
      })
      sendPushToUser(userId, 'Супервізію відхилено', date.toLocaleDateString('uk-UA'), '/supervisions').catch(() => {})
    }
  } catch (err) { console.error('Email error:', err) }
}

// ── routes ────────────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supervisions = await prisma.supervision.findMany({
      where: { userId: req.userId },
      include: { supervisor: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'desc' },
    })
    res.json(supervisions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supervisorId, date, type, hours } = req.body

    if (!supervisorId || !date || !type) {
      res.status(400).json({ error: 'Всі поля обовʼязкові' })
      return
    }

    const isGroup = type === 'GROUP_PRESENTER' || type === 'GROUP_LISTENER'
    const resolvedHours = isGroup ? Math.max(0.5, Number(hours) || 1) : 1

    const supervision = await prisma.supervision.create({
      data: { userId: req.userId!, supervisorId, date: new Date(date), type, hours: resolvedHours },
      include: { supervisor: { select: { id: true, firstName: true, lastName: true } } },
    })

    res.status(201).json(supervision)
    notifyRequest(supervisorId, req.userId!, new Date(date), type)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/pending', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supervisions = await prisma.supervision.findMany({
      where: { supervisorId: req.userId, status: 'PENDING' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(supervisions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /supervisions/conducted — all supervisions where current user is supervisor
// POST /supervisions/approve-all — supervisor approves all pending supervisions
router.post('/approve-all', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.supervision.updateMany({
      where: { supervisorId: req.userId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/conducted', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, status, dateFrom, dateTo } = req.query as Record<string, string>
    const supervisions = await prisma.supervision.findMany({
      where: {
        supervisorId: req.userId,
        ...(type && { type: type as any }),
        ...(status && { status: status as any }),
        ...(dateFrom || dateTo ? {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          }
        } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { date: 'desc' },
    })
    res.json(supervisions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.patch('/:id/approve', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const supervision = await prisma.supervision.findUnique({ where: { id } })

    if (!supervision) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (supervision.supervisorId !== req.userId) { res.status(403).json({ error: 'Заборонено' }); return }

    const updated = await prisma.supervision.update({ where: { id }, data: { status: 'APPROVED' } })
    res.json(updated)
    notifyApproved(supervision.userId, supervision.date, supervision.type)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.patch('/:id/reject', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const supervision = await prisma.supervision.findUnique({ where: { id } })

    if (!supervision) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (supervision.supervisorId !== req.userId) { res.status(403).json({ error: 'Заборонено' }); return }

    const updated = await prisma.supervision.update({ where: { id }, data: { status: 'REJECTED' } })
    res.json(updated)
    notifyRejected(supervision.userId, supervision.date, supervision.type)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
