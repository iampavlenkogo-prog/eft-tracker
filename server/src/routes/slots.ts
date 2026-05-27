import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'
import { sendSlotCancelled } from '../lib/email'

const router = Router()
router.use(authMiddleware)

// POST / — create slot (SUPERVISOR only)
router.post('/', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { date, time, duration, type, notes } = req.body
  if (!date || !time || !duration || !type) {
    res.status(400).json({ error: 'date, time, duration, type are required' })
    return
  }
  const slot = await prisma.supervisionSlot.create({
    data: {
      supervisorId: req.userId!,
      date,
      time,
      duration: Number(duration),
      type,
      notes: notes || null,
    },
  })
  res.status(201).json(slot)
})

// GET /available — future AVAILABLE slots for therapists
router.get('/available', async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10)
  const limit = req.query.limit ? Number(req.query.limit) : undefined
  const slots = await prisma.supervisionSlot.findMany({
    where: {
      status: 'AVAILABLE',
      date: { gte: today },
    },
    include: {
      supervisor: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    ...(limit ? { take: limit } : {}),
  })
  res.json(slots)
})

// GET /my — supervisor's own slots with booking details
router.get('/my', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const slots = await prisma.supervisionSlot.findMany({
    where: { supervisorId: req.userId! },
    include: {
      bookings: {
        include: {
          therapist: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, telegram: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  })
  res.json(slots)
})

// DELETE /:id — cancel slot (supervisor only)
router.delete('/:id', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string
  const slot = await prisma.supervisionSlot.findUnique({
    where: { id },
    include: {
      bookings: {
        where: { status: 'PENDING' },
        include: { therapist: { select: { email: true, firstName: true } } },
      },
      supervisor: { select: { firstName: true, lastName: true } },
    },
  })
  if (!slot) { res.status(404).json({ error: 'Слот не знайдено' }); return }
  if (slot.supervisorId !== req.userId!) { res.status(403).json({ error: 'Forbidden' }); return }
  if (slot.status === 'CANCELLED') { res.status(400).json({ error: 'Слот вже скасований' }); return }

  const supervisorName = `${slot.supervisor.firstName} ${slot.supervisor.lastName}`
  const pendingBooking = slot.bookings[0]

  await prisma.$transaction([
    ...(pendingBooking ? [
      prisma.supervisionBooking.update({ where: { id: pendingBooking.id }, data: { status: 'CANCELLED' } }),
    ] : []),
    prisma.supervisionSlot.update({ where: { id }, data: { status: 'CANCELLED' } }),
  ])

  res.json({ success: true })

  if (pendingBooking) {
    sendSlotCancelled(pendingBooking.therapist.email, supervisorName, slot.date, slot.time)
  }
})

export default router
