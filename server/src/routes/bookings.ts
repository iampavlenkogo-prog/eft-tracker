import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'
import { uploadProtocol, uploadBuffer } from '../lib/cloudinary'
import {
  sendBookingRequest,
  sendBookingApproved,
  sendBookingRejected,
} from '../lib/email'
import { sendPushToUser } from '../lib/push'

const router = Router()
router.use(authMiddleware)

// POST / — book a slot (simple, no details required yet)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slotId } = req.body
    if (!slotId) { res.status(400).json({ error: 'slotId є обовʼязковим' }); return }

    const slot = await prisma.supervisionSlot.findUnique({
      where: { id: slotId },
      include: { supervisor: { select: { id: true, firstName: true, lastName: true, email: true } } },
    })
    if (!slot) { res.status(404).json({ error: 'Слот не знайдено' }); return }
    if (slot.status !== 'AVAILABLE') { res.status(409).json({ error: 'Слот вже недоступний' }); return }
    if (slot.supervisorId === req.userId!) { res.status(400).json({ error: 'Не можна бронювати власний слот' }); return }

    const [booking] = await prisma.$transaction([
      prisma.supervisionBooking.create({
        data: { slotId, therapistId: req.userId! },
      }),
      prisma.supervisionSlot.update({ where: { id: slotId }, data: { status: 'PENDING' } }),
    ])

    await prisma.notification.create({
      data: { userId: slot.supervisorId, type: 'SLOT_BOOKING_REQUEST', relatedId: booking.id },
    })

    const therapist = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { firstName: true, lastName: true },
    })
    const therapistName = `${therapist!.firstName} ${therapist!.lastName}`
    sendBookingRequest(
      slot.supervisor.email,
      slot.supervisor.firstName,
      therapistName,
      slot.date,
      slot.time,
      '—',
    ).catch(console.error)

    sendPushToUser(slot.supervisorId, '📋 Нова заявка на бронювання', `${therapistName} · ${slot.date} ${slot.time}`, '/supervisor').catch(() => {})

    res.status(201).json(booking)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// PATCH /:id/details — therapist fills in case details + optional protocol file
router.patch(
  '/:id/details',
  uploadProtocol.single('protocolFile'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const booking = await prisma.supervisionBooking.findUnique({
        where: { id: req.params.id as string },
      })
      if (!booking) { res.status(404).json({ error: 'Бронювання не знайдено' }); return }
      if (booking.therapistId !== req.userId!) { res.status(403).json({ error: 'Forbidden' }); return }

      const { caseTitle, description, videoUrl, comment } = req.body

      let protocolFileUrl = booking.protocolFileUrl
      if (req.file) {
        protocolFileUrl = await uploadBuffer(req.file.buffer, 'protocols', req.file.mimetype)
      }

      const updated = await prisma.supervisionBooking.update({
        where: { id: booking.id },
        data: {
          ...(caseTitle !== undefined && { caseTitle: caseTitle || null }),
          ...(description !== undefined && { description: description || null }),
          ...(videoUrl !== undefined && { videoUrl: videoUrl || null }),
          ...(comment !== undefined && { comment: comment || null }),
          protocolFileUrl,
        },
      })

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Помилка сервера' })
    }
  },
)

// PATCH /:id/meeting-link — supervisor sets Zoom link for this booking
router.patch('/:id/meeting-link', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { meetingLink } = req.body
    const booking = await prisma.supervisionBooking.findUnique({
      where: { id: req.params.id as string },
      include: { slot: { select: { supervisorId: true } } },
    })
    if (!booking) { res.status(404).json({ error: 'Бронювання не знайдено' }); return }
    if (booking.slot.supervisorId !== req.userId!) { res.status(403).json({ error: 'Forbidden' }); return }

    const updated = await prisma.supervisionBooking.update({
      where: { id: booking.id },
      data: { meetingLink: meetingLink || null },
    })

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /my — therapist's own bookings
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookings = await prisma.supervisionBooking.findMany({
      where: { therapistId: req.userId! },
      include: {
        slot: {
          include: { supervisor: { select: { firstName: true, lastName: true, telegram: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(bookings)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /incoming — supervisor's incoming bookings
router.get('/incoming', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookings = await prisma.supervisionBooking.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        slot: { supervisorId: req.userId! },
      },
      include: {
        therapist: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, telegram: true } },
        slot: { select: { date: true, time: true, duration: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(bookings)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/approve — supervisor approves
router.post('/:id/approve', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await prisma.supervisionBooking.findUnique({
      where: { id: req.params.id as string },
      include: {
        slot: { include: { supervisor: { select: { firstName: true, lastName: true, meetingLink: true } } } },
        therapist: { select: { id: true, firstName: true, email: true } },
      },
    })
    if (!booking) { res.status(404).json({ error: 'Бронювання не знайдено' }); return }
    if (booking.slot.supervisorId !== req.userId!) { res.status(403).json({ error: 'Forbidden' }); return }
    if (booking.status !== 'PENDING') { res.status(400).json({ error: 'Бронювання не в статусі PENDING' }); return }

    await prisma.$transaction([
      prisma.supervisionBooking.update({ where: { id: booking.id }, data: { status: 'APPROVED' } }),
      prisma.supervisionSlot.update({ where: { id: booking.slotId }, data: { status: 'BOOKED' } }),
    ])

    await prisma.notification.create({
      data: { userId: booking.therapistId, type: 'SLOT_BOOKING_APPROVED', relatedId: booking.id },
    })

    const supervisorName = `${booking.slot.supervisor.firstName} ${booking.slot.supervisor.lastName}`
    const meetingLink = booking.meetingLink || booking.slot.supervisor.meetingLink
    sendBookingApproved(
      booking.therapist.email,
      booking.therapist.firstName,
      supervisorName,
      booking.slot.date,
      booking.slot.time,
      meetingLink,
    ).catch(console.error)

    sendPushToUser(booking.therapistId, '✅ Бронювання підтверджено', `${supervisorName} · ${booking.slot.date} ${booking.slot.time}`, '/my-bookings').catch(() => {})

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/reject — supervisor rejects
router.post('/:id/reject', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await prisma.supervisionBooking.findUnique({
      where: { id: req.params.id as string },
      include: {
        slot: { include: { supervisor: { select: { firstName: true, lastName: true } } } },
        therapist: { select: { id: true, firstName: true, email: true } },
      },
    })
    if (!booking) { res.status(404).json({ error: 'Бронювання не знайдено' }); return }
    if (booking.slot.supervisorId !== req.userId!) { res.status(403).json({ error: 'Forbidden' }); return }
    if (booking.status !== 'PENDING') { res.status(400).json({ error: 'Бронювання не в статусі PENDING' }); return }

    await prisma.$transaction([
      prisma.supervisionBooking.update({ where: { id: booking.id }, data: { status: 'REJECTED' } }),
      prisma.supervisionSlot.update({ where: { id: booking.slotId }, data: { status: 'AVAILABLE' } }),
    ])

    await prisma.notification.create({
      data: { userId: booking.therapistId, type: 'SLOT_BOOKING_REJECTED', relatedId: booking.id },
    })

    const supervisorName = `${booking.slot.supervisor.firstName} ${booking.slot.supervisor.lastName}`
    sendBookingRejected(
      booking.therapist.email,
      booking.therapist.firstName,
      supervisorName,
      booking.slot.date,
      booking.slot.time,
    ).catch(console.error)

    sendPushToUser(booking.therapistId, 'Бронювання відхилено', `${supervisorName} · ${booking.slot.date}`, '/slots').catch(() => {})

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/complete — supervisor marks as completed
router.post('/:id/complete', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await prisma.supervisionBooking.findUnique({
      where: { id: req.params.id as string },
      include: { slot: true },
    })
    if (!booking) { res.status(404).json({ error: 'Бронювання не знайдено' }); return }
    if (booking.slot.supervisorId !== req.userId!) { res.status(403).json({ error: 'Forbidden' }); return }
    if (booking.status !== 'APPROVED') { res.status(400).json({ error: 'Бронювання не в статусі APPROVED' }); return }

    const sessionDate = new Date(`${booking.slot.date}T${booking.slot.time}`)

    await prisma.$transaction([
      prisma.supervisionBooking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } }),
      prisma.supervisionSlot.update({ where: { id: booking.slotId }, data: { status: 'COMPLETED' } }),
      prisma.supervision.create({
        data: {
          userId: booking.therapistId,
          supervisorId: booking.slot.supervisorId,
          date: sessionDate,
          type: booking.slot.type === 'INDIVIDUAL' ? 'INDIVIDUAL_PRESENTER' : 'GROUP_PRESENTER',
          status: 'APPROVED',
          hours: booking.slot.duration / 60,
        },
      }),
    ])

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
