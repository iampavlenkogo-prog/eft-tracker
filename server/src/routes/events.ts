import { Router, Response } from 'express'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'
import { upload, uploadLarge, uploadBuffer } from '../lib/cloudinary'
import {
  sendEventAnnouncement,
  sendPaymentDetails,
  sendReceiptUploaded,
  sendEventConfirmation,
} from '../lib/email'

const router = Router()
router.use(authMiddleware)

const ORGANIZER_ROLES = ['SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN']

function isOrganizer(roles?: string[]) {
  return !!roles?.some(r => ORGANIZER_ROLES.includes(r))
}

function parseReminders(raw: string | undefined): { sendAt: Date }[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr)
      ? arr.filter((r: any) => r.sendAt).map((r: any) => ({ sendAt: new Date(r.sendAt) }))
      : []
  } catch { return [] }
}

// GET /api/events — all published events (with registration status for current user)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { date: 'asc' },
      include: {
        organizer: { select: { id: true, firstName: true, lastName: true } },
        registrations: { where: { userId: req.userId }, select: { id: true, status: true } },
        _count: { select: { registrations: true } },
      },
    })
    res.json(events)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/events/my — organizer's own events + registrations + reminders
router.get('/my', requireRole(...ORGANIZER_ROLES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      where: { organizerId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        registrations: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, telegram: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        reminders: { orderBy: { sendAt: 'asc' } },
      },
    })
    res.json(events)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/events — create event (DRAFT)
router.post('/', requireRole(...ORGANIZER_ROLES), upload.single('coverImage'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, date, startTime, endTime, price, currency, paymentInstructions } = req.body
    if (!title || !description || !date || price == null || !paymentInstructions) {
      res.status(400).json({ error: 'Заповніть усі обов\'язкові поля' })
      return
    }

    let coverImageUrl: string | null = null
    if (req.file) {
      coverImageUrl = await uploadBuffer(req.file.buffer, 'eft-events', req.file.mimetype)
    }

    let priceVariations = null
    if (req.body.priceVariations) {
      try { priceVariations = JSON.parse(req.body.priceVariations) } catch { /* ignore */ }
    }

    const event = await prisma.event.create({
      data: {
        organizerId: req.userId!,
        title, description,
        date: new Date(date),
        startTime: startTime || null,
        endTime: endTime || null,
        price: parseFloat(price),
        currency: currency || 'UAH',
        priceVariations,
        paymentInstructions,
        coverImageUrl,
      },
    })

    const reminders = parseReminders(req.body.reminders)
    if (reminders.length > 0) {
      await prisma.eventReminder.createMany({
        data: reminders.map(r => ({ eventId: event.id, sendAt: r.sendAt })),
      })
    }

    res.status(201).json(event)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// PATCH /api/events/:id — update event details (not zoom/presentation — use /materials)
router.patch('/:id', requireRole(...ORGANIZER_ROLES), upload.single('coverImage'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } })
    if (!event) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (event.organizerId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }

    const { title, description, date, startTime, endTime, price, currency, paymentInstructions } = req.body
    let coverImageUrl = event.coverImageUrl

    if (req.file) {
      coverImageUrl = await uploadBuffer(req.file.buffer, 'eft-events', req.file.mimetype)
    }

    let priceVariations = event.priceVariations
    if (req.body.priceVariations !== undefined) {
      try { priceVariations = JSON.parse(req.body.priceVariations) } catch { priceVariations = null }
    }

    const updated = await prisma.event.update({
      where: { id: req.params.id as string },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(date && { date: new Date(date) }),
        ...(startTime !== undefined && { startTime: startTime || null }),
        ...(endTime !== undefined && { endTime: endTime || null }),
        ...(price != null && { price: parseFloat(price) }),
        ...(currency && { currency }),
        priceVariations,
        ...(paymentInstructions && { paymentInstructions }),
        coverImageUrl,
      },
    })

    // Update reminders if provided
    if (req.body.reminders !== undefined) {
      await prisma.eventReminder.deleteMany({ where: { eventId: req.params.id as string } })
      const reminders = parseReminders(req.body.reminders)
      if (reminders.length > 0) {
        await prisma.eventReminder.createMany({
          data: reminders.map(r => ({ eventId: req.params.id as string, sendAt: r.sendAt })),
        })
      }
    }

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/events/:id/materials — update zoom link + presentation (25 MB)
router.post('/:id/materials', requireRole(...ORGANIZER_ROLES), uploadLarge.single('presentation'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } })
    if (!event) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (event.organizerId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }

    const { zoomLink } = req.body
    let presentationUrl = event.presentationUrl

    if (req.file) {
      presentationUrl = await uploadBuffer(req.file.buffer, 'eft-events', req.file.mimetype)
    }

    const updated = await prisma.event.update({
      where: { id: req.params.id as string },
      data: {
        ...(zoomLink !== undefined && { zoomLink: zoomLink || null }),
        presentationUrl,
      },
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/events/:id/publish — publish + notify all users
router.post('/:id/publish', requireRole(...ORGANIZER_ROLES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } })
    if (!event) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (event.organizerId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }
    if (event.status === 'PUBLISHED') { res.status(400).json({ error: 'Вже опубліковано' }); return }

    const updated = await prisma.event.update({
      where: { id: req.params.id as string },
      data: { status: 'PUBLISHED' },
    })

    ;(async () => {
      try {
        const users = await prisma.user.findMany({ select: { id: true, email: true, firstName: true } })
        const dateStr = format(new Date(event.date), 'd MMMM yyyy', { locale: uk })

        await prisma.notification.createMany({
          data: users.map(u => ({ userId: u.id, type: 'NEW_EVENT', relatedId: event.id, isRead: false })),
        })

        for (const u of users) {
          await sendEventAnnouncement(u.email, u.firstName, event.title, dateStr, event.price)
        }
      } catch (e) { console.error('Notify error:', e) }
    })()

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// DELETE /api/events/:id — cancel event
router.delete('/:id', requireRole(...ORGANIZER_ROLES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } })
    if (!event) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (event.organizerId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }
    const updated = await prisma.event.update({
      where: { id: req.params.id as string },
      data: { status: 'CANCELLED' },
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/events/:id/register — register current user
router.post('/:id/register', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } })
    if (!event || event.status !== 'PUBLISHED') { res.status(404).json({ error: 'Захід не знайдено' }); return }

    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: req.userId! } },
    })
    if (existing) { res.status(409).json({ error: 'Ви вже зареєстровані' }); return }

    const reg = await prisma.eventRegistration.create({
      data: { eventId: event.id, userId: req.userId! },
    })
    res.status(201).json(reg)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/events/my-registrations — user's own registrations
router.get('/my-registrations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const regs = await prisma.eventRegistration.findMany({
      where: { userId: req.userId },
      include: {
        event: {
          include: { organizer: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(regs)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/events/:id/registrations/:regId/receipt — proxy receipt PDF for organizer
router.get('/:id/registrations/:regId/receipt', requireRole(...ORGANIZER_ROLES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reg = await prisma.eventRegistration.findUnique({
      where: { id: req.params.regId as string },
      include: { event: true },
    })
    if (!reg || !reg.paymentReceiptUrl) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (reg.event.organizerId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }
    const fileRes = await fetch(reg.paymentReceiptUrl)
    if (!fileRes.ok) { res.status(502).json({ error: 'Не вдалось отримати файл' }); return }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    const buf = await fileRes.arrayBuffer()
    res.end(Buffer.from(buf))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/events/:id/registrations/:regId/send-payment
router.post('/:id/registrations/:regId/send-payment', requireRole(...ORGANIZER_ROLES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reg = await prisma.eventRegistration.findUnique({
      where: { id: req.params.regId as string },
      include: { event: true, user: { select: { email: true, firstName: true } } },
    })
    if (!reg) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (reg.event.organizerId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { status: 'PAYMENT_SENT' },
    })

    sendPaymentDetails(reg.user.email, reg.user.firstName, reg.event.title, reg.event.paymentInstructions).catch(console.error)

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/events/:id/registrations/:regId/upload-receipt
router.post('/:id/registrations/:regId/upload-receipt', upload.single('receipt'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reg = await prisma.eventRegistration.findUnique({
      where: { id: req.params.regId as string },
      include: {
        event: { include: { organizer: { select: { email: true } } } },
        user: { select: { firstName: true, lastName: true } },
      },
    })
    if (!reg) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (reg.userId !== req.userId) { res.status(403).json({ error: 'Заборонено' }); return }
    if (!req.file) { res.status(400).json({ error: 'Файл не завантажено' }); return }

    const receiptUrl = await uploadBuffer(req.file.buffer, 'eft-receipts', req.file.mimetype)

    const updated = await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { status: 'RECEIPT_UPLOADED', paymentReceiptUrl: receiptUrl },
    })

    const participantName = `${reg.user.firstName} ${reg.user.lastName}`
    sendReceiptUploaded(reg.event.organizer.email, participantName, reg.event.title).catch(console.error)

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/events/:id/registrations/:regId/confirm
router.post('/:id/registrations/:regId/confirm', requireRole(...ORGANIZER_ROLES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reg = await prisma.eventRegistration.findUnique({
      where: { id: req.params.regId as string },
      include: { event: true, user: { select: { email: true, firstName: true } } },
    })
    if (!reg) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (reg.event.organizerId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }
    if (!reg.event.zoomLink) { res.status(400).json({ error: 'Додайте Zoom-посилання через кнопку «Матеріали» перед підтвердженням' }); return }

    const updated = await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { status: 'CONFIRMED' },
    })

    sendEventConfirmation(
      reg.user.email,
      reg.user.firstName,
      reg.event.title,
      reg.event.zoomLink,
      reg.event.presentationUrl,
    ).catch(console.error)

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/events/:id/registrations/:regId/reject
router.post('/:id/registrations/:regId/reject', requireRole(...ORGANIZER_ROLES), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reg = await prisma.eventRegistration.findUnique({
      where: { id: req.params.regId as string },
      include: { event: true },
    })
    if (!reg) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (reg.event.organizerId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { status: 'REJECTED' },
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
