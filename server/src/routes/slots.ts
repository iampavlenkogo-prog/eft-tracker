import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'
import { sendSlotBooked, sendSlotCancelled } from '../lib/email'

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

// GET /available — future OPEN slots for therapists
router.get('/available', async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10)
  const slots = await prisma.supervisionSlot.findMany({
    where: {
      status: 'OPEN',
      date: { gte: today },
    },
    include: {
      supervisor: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  })
  res.json(slots)
})

// GET /my — supervisor's own slots
router.get('/my', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const slots = await prisma.supervisionSlot.findMany({
    where: { supervisorId: req.userId! },
    include: {
      bookedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  })
  res.json(slots)
})

// POST /:id/book — book a slot
router.post('/:id/book', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string
  const slot = await prisma.supervisionSlot.findUnique({
    where: { id },
    include: { supervisor: { select: { email: true, firstName: true, lastName: true } } },
  })
  if (!slot) { res.status(404).json({ error: 'Слот не знайдено' }); return }
  if (slot.status !== 'OPEN') { res.status(409).json({ error: 'Слот вже заброньований або скасований' }); return }
  if (slot.supervisorId === req.userId!) { res.status(400).json({ error: 'Не можна бронювати власний слот' }); return }

  const therapist = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { firstName: true, lastName: true },
  })

  const updated = await prisma.supervisionSlot.update({
    where: { id },
    data: { status: 'BOOKED', bookedByUserId: req.userId! },
  })

  res.json(updated)

  const therapistName = `${therapist!.firstName} ${therapist!.lastName}`
  sendSlotBooked(slot.supervisor.email, therapistName, slot.date, slot.time)
})

// DELETE /:id — cancel slot (supervisor only, emails therapist if was booked)
router.delete('/:id', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string
  const slot = await prisma.supervisionSlot.findUnique({
    where: { id },
    include: {
      bookedBy: { select: { email: true } },
      supervisor: { select: { firstName: true, lastName: true } },
    },
  })
  if (!slot) { res.status(404).json({ error: 'Слот не знайдено' }); return }
  if (slot.supervisorId !== req.userId!) { res.status(403).json({ error: 'Forbidden' }); return }
  if (slot.status === 'CANCELLED') { res.status(400).json({ error: 'Слот вже скасований' }); return }

  const wasBooked = slot.status === 'BOOKED'
  const bookedByEmail = slot.bookedBy?.email
  const supervisorName = `${slot.supervisor.firstName} ${slot.supervisor.lastName}`

  await prisma.supervisionSlot.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  res.json({ success: true })

  if (wasBooked && bookedByEmail) {
    sendSlotCancelled(bookedByEmail, supervisorName, slot.date, slot.time)
  }
})

export default router
