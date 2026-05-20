import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'

const router = Router()
router.use(authMiddleware)

// GET /skills-groups — therapist's own records
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const records = await prisma.skillsGroup.findMany({
      where: { userId: req.userId },
      include: { supervisor: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'desc' },
    })
    res.json(records)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /skills-groups — therapist creates a record
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supervisorId, date, hours } = req.body
    if (!supervisorId || !date) {
      res.status(400).json({ error: 'Всі поля обов\'язкові' }); return
    }
    const record = await prisma.skillsGroup.create({
      data: {
        userId: req.userId!,
        supervisorId,
        date: new Date(date),
        hours: Math.max(0.5, Number(hours) || 1),
      },
      include: { supervisor: { select: { id: true, firstName: true, lastName: true } } },
    })
    res.status(201).json(record)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /skills-groups/pending — supervisor sees pending requests
router.get('/pending', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const records = await prisma.skillsGroup.findMany({
      where: { supervisorId: req.userId, status: 'PENDING' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(records)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// PATCH /skills-groups/:id/approve
router.patch('/:id/approve', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const record = await prisma.skillsGroup.findUnique({ where: { id } })
    if (!record) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (record.supervisorId !== req.userId) { res.status(403).json({ error: 'Заборонено' }); return }
    const updated = await prisma.skillsGroup.update({ where: { id }, data: { status: 'APPROVED' } })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// PATCH /skills-groups/:id/reject
router.patch('/:id/reject', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const record = await prisma.skillsGroup.findUnique({ where: { id } })
    if (!record) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (record.supervisorId !== req.userId) { res.status(403).json({ error: 'Заборонено' }); return }
    const updated = await prisma.skillsGroup.update({ where: { id }, data: { status: 'REJECTED' } })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /skills-groups/approve-all — supervisor approves all pending
router.post('/approve-all', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.skillsGroup.updateMany({
      where: { supervisorId: req.userId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
