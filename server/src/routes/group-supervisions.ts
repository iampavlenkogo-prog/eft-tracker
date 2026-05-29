import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'
import { uploadProtocol, upload, uploadBuffer } from '../lib/cloudinary'
import { sendPushToUser } from '../lib/push'
import { sendGroupSupervisionConfirmed } from '../lib/email'

const router = Router()
router.use(authMiddleware)

// GET / — list group supervisions
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { roles: true },
    })
    const isMySupervisor = user?.roles.some(r => r === 'SUPERVISOR' || r === 'SUPERVISOR_CANDIDATE' || r === 'ADMIN')

    const where: any = isMySupervisor
      ? { OR: [
          { supervisorId: req.userId! },
          { status: { notIn: ['COMPLETED'] }, supervisorId: { not: req.userId! } },
        ] }
      : { status: { notIn: ['COMPLETED'] } }

    const groups = await prisma.groupSupervision.findMany({
      where,
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true } },
        presenterUser: { select: { id: true, firstName: true, lastName: true } },
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, telegram: true } } },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    })

    res.json(groups)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /mine — current user's active group participations
router.get('/mine', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const participations = await prisma.groupParticipant.findMany({
      where: {
        userId: req.userId!,
        groupSupervision: { status: { notIn: ['COMPLETED'] } },
      },
      include: {
        groupSupervision: {
          include: {
            supervisor: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { groupSupervision: { scheduledDate: 'asc' } },
    })

    const result = participations.map(p => {
      const g = p.groupSupervision
      const paid = p.paymentStatus === 'CONFIRMED' || p.paymentStatus === 'FREE'
      return {
        id: g.id,
        title: g.title,
        description: g.description,
        scheduledDate: g.scheduledDate,
        scheduledTime: g.scheduledTime,
        duration: g.duration,
        price: g.price,
        currency: g.currency,
        status: g.status,
        paymentInstructions: paid ? g.paymentInstructions : null,
        zoomLink: paid ? g.zoomLink : null,
        zoomPassword: paid ? g.zoomPassword : null,
        recordingUrl: paid ? g.recordingUrl : null,
        recordingExpiresAt: g.recordingExpiresAt,
        supervisor: g.supervisor,
        myParticipation: p,
      }
    })

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /:id — detail
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({
      where: { id: req.params.id as string },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true, telegram: true } },
        presenterUser: { select: { id: true, firstName: true, lastName: true } },
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, telegram: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { roles: true },
    })
    const isSupervisor = group.supervisorId === req.userId || user?.roles.includes('ADMIN')
    const myParticipation = group.participants.find(p => p.userId === req.userId)

    const canSeeZoom = isSupervisor
      || myParticipation?.isPresenter
      || myParticipation?.paymentStatus === 'CONFIRMED'
      || myParticipation?.paymentStatus === 'FREE'

    res.json({
      ...group,
      zoomLink: canSeeZoom ? group.zoomLink : null,
      zoomPassword: canSeeZoom ? group.zoomPassword : null,
      // Case materials visible to supervisor + confirmed/free participants
      caseTitle: (isSupervisor || myParticipation?.paymentStatus === 'CONFIRMED' || myParticipation?.paymentStatus === 'FREE') ? group.caseTitle : null,
      caseDescription: (isSupervisor || myParticipation?.paymentStatus === 'CONFIRMED' || myParticipation?.paymentStatus === 'FREE') ? group.caseDescription : null,
      protocolFileUrl: (isSupervisor || myParticipation?.paymentStatus === 'CONFIRMED' || myParticipation?.paymentStatus === 'FREE') ? group.protocolFileUrl : null,
      caseVideoUrl: (isSupervisor || myParticipation?.paymentStatus === 'CONFIRMED' || myParticipation?.paymentStatus === 'FREE') ? group.caseVideoUrl : null,
      myParticipation: myParticipation ?? null,
      isSupervisor,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST / — supervisor creates announcement (no participant limit)
router.post('/', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, scheduledDate, scheduledTime, duration, price, currency } = req.body
    if (!title || !scheduledDate || !scheduledTime || !duration) {
      res.status(400).json({ error: 'Назва, дата, час та тривалість обовʼязкові' }); return
    }

    const group = await prisma.groupSupervision.create({
      data: {
        supervisorId: req.userId!,
        title,
        description: description || null,
        scheduledDate,
        scheduledTime,
        duration: Number(duration),
        price: Number(price) || 0,
        currency: currency || 'UAH',
      },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true } },
        participants: true,
      },
    })

    // Notify all users
    const allUsers = await prisma.user.findMany({ select: { id: true } })
    if (allUsers.length > 0) {
      await prisma.notification.createMany({
        data: allUsers.filter(u => u.id !== req.userId).map(u => ({
          userId: u.id,
          type: 'GROUP_SUPERVISION_NEW',
          relatedId: group.id,
        })),
        skipDuplicates: true,
      })
      for (const u of allUsers) {
        if (u.id === req.userId) continue
        sendPushToUser(u.id, '🌿 Нова групова супервізія', `${title} · ${scheduledDate}`, `/group-supervisions/${group.id}`).catch(() => {})
      }
    }

    res.status(201).json(group)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// PATCH /:id — supervisor updates basic info
router.patch('/:id', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.supervisorId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return }

    const { title, description, scheduledDate, scheduledTime, duration, price, currency, zoomLink, zoomPassword } = req.body

    const updated = await prisma.groupSupervision.update({
      where: { id: group.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(scheduledDate !== undefined && { scheduledDate }),
        ...(scheduledTime !== undefined && { scheduledTime }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(price !== undefined && { price: Number(price) }),
        ...(currency !== undefined && { currency }),
        ...(zoomLink !== undefined && { zoomLink: zoomLink || null }),
        ...(zoomPassword !== undefined && { zoomPassword: zoomPassword || null }),
      },
    })

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/open-registration — supervisor opens registration + sets payment details + zoom
router.post('/:id/open-registration', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.supervisorId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return }
    if (group.status !== 'CASE_CONFIRMED') { res.status(400).json({ error: 'Спочатку потрібен супервізант' }); return }

    const { paymentInstructions, zoomLink, zoomPassword } = req.body
    // For paid groups require payment details
    if (group.price > 0 && !paymentInstructions) {
      res.status(400).json({ error: 'Реквізити для оплати обовʼязкові для платних супервізій' }); return
    }

    const updated = await prisma.groupSupervision.update({
      where: { id: group.id },
      data: {
        status: 'REGISTRATION_OPEN',
        ...(paymentInstructions !== undefined && { paymentInstructions: paymentInstructions || null }),
        ...(zoomLink !== undefined && { zoomLink: zoomLink || null }),
        ...(zoomPassword !== undefined && { zoomPassword: zoomPassword || null }),
      },
    })

    // Notify ALL users (not just therapists — supervisors can participate too)
    const allUsers = await prisma.user.findMany({ select: { id: true } })
    await prisma.notification.createMany({
      data: allUsers.filter(u => u.id !== req.userId).map(u => ({
        userId: u.id,
        type: 'GROUP_SUPERVISION_REGISTRATION_OPEN',
        relatedId: group.id,
      })),
      skipDuplicates: true,
    })
    for (const u of allUsers) {
      if (u.id === req.userId) continue
      sendPushToUser(u.id, '✅ Реєстрація відкрита', `${group.title} · ${group.scheduledDate}`, `/group-supervisions/${group.id}`).catch(() => {})
    }

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/set-recording — supervisor adds recording link
router.post('/:id/set-recording', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recordingUrl, recordingExpiresAt } = req.body
    if (!recordingUrl) { res.status(400).json({ error: 'Посилання на запис обовʼязкове' }); return }

    const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.supervisorId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return }

    const updated = await prisma.groupSupervision.update({
      where: { id: group.id },
      data: {
        recordingUrl,
        recordingExpiresAt: recordingExpiresAt ? new Date(recordingExpiresAt) : null,
        status: 'RECORDING_AVAILABLE',
      },
    })

    const participants = await prisma.groupParticipant.findMany({
      where: { groupSupervisionId: group.id, paymentStatus: { in: ['CONFIRMED', 'FREE'] } },
      select: { userId: true },
    })
    for (const p of participants) {
      await prisma.notification.create({
        data: { userId: p.userId, type: 'GROUP_SUPERVISION_RECORDING', relatedId: group.id },
      }).catch(() => {})
      sendPushToUser(p.userId, '🎬 Запис доступний', `${group.title}`, `/group-supervisions/${group.id}`).catch(() => {})
    }

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/complete — supervisor completes, creates journal entries
router.post('/:id/complete', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({
      where: { id: req.params.id as string },
      include: { participants: { where: { paymentStatus: { in: ['CONFIRMED', 'FREE'] } } } },
    })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.supervisorId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return }

    const sessionDate = new Date(`${group.scheduledDate}T${group.scheduledTime}`)

    await prisma.$transaction(async tx => {
      await tx.groupSupervision.update({ where: { id: group.id }, data: { status: 'COMPLETED' } })
      for (const p of group.participants) {
        await tx.supervision.create({
          data: {
            userId: p.userId,
            supervisorId: group.supervisorId,
            date: sessionDate,
            type: p.isPresenter ? 'GROUP_PRESENTER' : 'GROUP_LISTENER',
            status: 'APPROVED',
            hours: group.duration / 60,
          },
        })
        await tx.notification.create({
          data: { userId: p.userId, type: 'GROUP_SUPERVISION_COMPLETED', relatedId: group.id },
        })
        sendPushToUser(p.userId, '✅ Групову супервізію завершено', 'Запис додано до журналу', '/supervisions').catch(() => {})
      }
    })

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// DELETE /:id — supervisor deletes (only WAITING_FOR_CASE)
router.delete('/:id', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.supervisorId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return }
    if (group.status !== 'WAITING_FOR_CASE') { res.status(400).json({ error: 'Можна видалити тільки ще не підтверджену супервізію' }); return }

    await prisma.groupSupervision.delete({ where: { id: group.id } })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/book-presenter — book the presenter spot (just ethics, no case details yet)
router.post('/:id/book-presenter', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.status !== 'WAITING_FOR_CASE') { res.status(400).json({ error: 'Місце супервізанта вже зайняте' }); return }
    if (group.supervisorId === req.userId) { res.status(400).json({ error: 'Супервізор не може бути супервізантом у власній групі' }); return }

    const { ethicsConfirmed } = req.body
    if (!ethicsConfirmed || ethicsConfirmed === 'false') {
      res.status(400).json({ error: 'Підтвердіть дотримання етичних норм' }); return
    }

    const [updatedGroup] = await prisma.$transaction([
      prisma.groupSupervision.update({
        where: { id: group.id },
        data: { status: 'CASE_CONFIRMED', presenterUserId: req.userId! },
      }),
      prisma.groupParticipant.upsert({
        where: { groupSupervisionId_userId: { groupSupervisionId: group.id, userId: req.userId! } },
        create: { groupSupervisionId: group.id, userId: req.userId!, isPresenter: true, ethicsConfirmed: true, paymentStatus: group.price === 0 ? 'FREE' : 'PENDING' },
        update: { isPresenter: true, ethicsConfirmed: true, paymentStatus: group.price === 0 ? 'FREE' : 'PENDING' },
      }),
    ])

    await prisma.notification.create({
      data: { userId: group.supervisorId, type: 'GROUP_SUPERVISION_CASE_SUBMITTED', relatedId: group.id },
    })
    sendPushToUser(group.supervisorId, '📋 Супервізанта заброньовано', `${group.title}`, '/supervisor').catch(() => {})

    res.json(updatedGroup)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// PATCH /:id/case-details — presenter fills/updates case form (protocol + video + supervision request)
router.patch(
  '/:id/case-details',
  uploadProtocol.single('protocolFile'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
      if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
      if (group.presenterUserId !== req.userId) { res.status(403).json({ error: 'Тільки супервізант може заповнити матеріали' }); return }

      const { caseTitle, caseDescription, caseVideoUrl } = req.body
      let protocolFileUrl = group.protocolFileUrl
      if (req.file) {
        protocolFileUrl = await uploadBuffer(req.file.buffer, 'group-protocols', req.file.mimetype)
      }

      const updated = await prisma.groupSupervision.update({
        where: { id: group.id },
        data: {
          ...(caseTitle !== undefined && { caseTitle: caseTitle || null }),
          ...(caseDescription !== undefined && { caseDescription: caseDescription || null }),
          ...(caseVideoUrl !== undefined && { caseVideoUrl: caseVideoUrl || null }),
          protocolFileUrl,
        },
      })
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Помилка сервера' })
    }
  }
)

// POST /:id/join — join as listener (no participant limit; registration open until session start)
router.post('/:id/join', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.status !== 'REGISTRATION_OPEN') { res.status(400).json({ error: 'Реєстрація зараз недоступна' }); return }
    if (group.supervisorId === req.userId) { res.status(400).json({ error: 'Супервізор не може приєднатись як учасник у власній групі' }); return }

    const { ethicsConfirmed } = req.body
    if (!ethicsConfirmed || ethicsConfirmed === 'false') {
      res.status(400).json({ error: 'Підтвердіть дотримання етичних норм' }); return
    }

    const existing = await prisma.groupParticipant.findUnique({
      where: { groupSupervisionId_userId: { groupSupervisionId: group.id, userId: req.userId! } },
    })
    if (existing) { res.status(409).json({ error: 'Ви вже зареєстровані' }); return }

    const isFree = group.price === 0
    const participant = await prisma.groupParticipant.create({
      data: {
        groupSupervisionId: group.id,
        userId: req.userId!,
        ethicsConfirmed: true,
        paymentStatus: isFree ? 'FREE' : 'PENDING',
      },
    })

    const therapist = await prisma.user.findUnique({ where: { id: req.userId! }, select: { firstName: true, lastName: true } })
    await prisma.notification.create({
      data: { userId: group.supervisorId, type: 'GROUP_SUPERVISION_PARTICIPANT_JOINED', relatedId: group.id },
    })
    sendPushToUser(group.supervisorId, '👤 Новий учасник', `${therapist?.firstName} ${therapist?.lastName} · ${group.title}`, '/supervisor').catch(() => {})

    res.status(201).json(participant)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/upload-receipt — participant uploads payment screenshot
router.post(
  '/:id/upload-receipt',
  upload.single('receiptFile'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) { res.status(400).json({ error: 'Файл квитанції обовʼязковий' }); return }

      const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
      if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }

      const participant = await prisma.groupParticipant.findUnique({
        where: { groupSupervisionId_userId: { groupSupervisionId: group.id, userId: req.userId! } },
      })
      if (!participant) { res.status(403).json({ error: 'Ви не зареєстровані в цій супервізії' }); return }

      const receiptUrl = await uploadBuffer(req.file.buffer, 'receipts', req.file.mimetype)
      const updated = await prisma.groupParticipant.update({
        where: { id: participant.id },
        data: { paymentReceiptUrl: receiptUrl, paymentStatus: 'RECEIPT_UPLOADED' },
      })

      const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { firstName: true, lastName: true } })
      await prisma.notification.create({
        data: { userId: group.supervisorId, type: 'GROUP_SUPERVISION_RECEIPT_UPLOADED', relatedId: group.id },
      })
      sendPushToUser(group.supervisorId, '💳 Квитанцію завантажено', `${user?.firstName} ${user?.lastName} · ${group.title}`, '/supervisor').catch(() => {})

      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Помилка сервера' })
    }
  }
)

// POST /:id/participants/:participantId/confirm-payment — confirm + send Zoom link email
router.post('/:id/participants/:participantId/confirm-payment', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.supervisorId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return }

    const participant = await prisma.groupParticipant.findUnique({
      where: { id: req.params.participantId as string },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    })
    if (!participant || participant.groupSupervisionId !== group.id) { res.status(404).json({ error: 'Учасника не знайдено' }); return }

    const updated = await prisma.groupParticipant.update({
      where: { id: participant.id },
      data: { paymentStatus: 'CONFIRMED' },
    })

    await prisma.notification.create({
      data: { userId: participant.userId, type: 'GROUP_SUPERVISION_PAYMENT_CONFIRMED', relatedId: group.id },
    })
    sendPushToUser(participant.userId, '✅ Оплату підтверджено', `${group.title} · посилання на Zoom доступне`, `/group-supervisions/${group.id}`).catch(() => {})

    // Send automatic confirmation email with Zoom link
    if (group.zoomLink) {
      sendGroupSupervisionConfirmed(
        participant.user.email,
        participant.user.firstName,
        group.title,
        group.scheduledDate,
        group.scheduledTime,
        group.zoomLink,
      ).catch(console.error)
    }

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /:id/participants/:participantId/reject-payment — reject payment
router.post('/:id/participants/:participantId/reject-payment', requireRole('SUPERVISOR', 'SUPERVISOR_CANDIDATE', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const group = await prisma.groupSupervision.findUnique({ where: { id: req.params.id as string } })
    if (!group) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (group.supervisorId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return }

    const participant = await prisma.groupParticipant.findUnique({ where: { id: req.params.participantId as string } })
    if (!participant || participant.groupSupervisionId !== group.id) { res.status(404).json({ error: 'Учасника не знайдено' }); return }

    const updated = await prisma.groupParticipant.update({
      where: { id: participant.id },
      data: { paymentStatus: 'PENDING', paymentReceiptUrl: null },
    })

    await prisma.notification.create({
      data: { userId: participant.userId, type: 'GROUP_SUPERVISION_PAYMENT_REJECTED', relatedId: group.id },
    })
    sendPushToUser(participant.userId, 'Оплату не підтверджено', `${group.title} · завантажте новий скрін`, `/group-supervisions/${group.id}`).catch(() => {})

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
