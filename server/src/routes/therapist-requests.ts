import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { sendPushToUser } from '../lib/push'
import { generateTherapistRequestPdf } from '../lib/therapistRequestPdf'

const router = Router()
router.use(authMiddleware)

const therapistSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  telegram: true,
  email: true,
}

// GET /api/therapist-requests — list all OPEN requests
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await prisma.therapistRequest.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: therapistSelect },
        _count: { select: { responses: true } },
      },
    })
    res.json(requests)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/therapist-requests — create new request
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, workFormat, country, city, language, therapyFormats, price } = req.body
    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ error: 'Заповніть заголовок та опис' })
      return
    }

    const request = await prisma.therapistRequest.create({
      data: {
        authorId: req.userId!,
        title: title.trim(),
        description: description.trim(),
        workFormat: workFormat || null,
        country: country?.trim() || null,
        city: city?.trim() || null,
        language: language?.trim() || null,
        therapyFormats: Array.isArray(therapyFormats) ? therapyFormats : [],
        price: price != null && price !== '' ? parseFloat(price) : null,
      },
      include: {
        author: { select: therapistSelect },
        _count: { select: { responses: true } },
      },
    })

    // Notify all users
    ;(async () => {
      try {
        const users = await prisma.user.findMany({
          select: { id: true },
          where: { id: { not: req.userId! } },
        })
        await prisma.notification.createMany({
          data: users.map(u => ({
            userId: u.id,
            type: 'NEW_THERAPIST_REQUEST',
            relatedId: request.id,
            isRead: false,
          })),
        })
        for (const u of users) {
          sendPushToUser(
            u.id,
            'Новий запит на пошук терапевта',
            request.title,
            `/therapist-requests/${request.id}`,
          ).catch(() => {})
        }
      } catch (e) { console.error('Notify error:', e) }
    })()

    res.status(201).json(request)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/therapist-requests/:id — single request with responses
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await prisma.therapistRequest.findUnique({
      where: { id: req.params.id as string },
      include: {
        author: { select: therapistSelect },
        responses: {
          orderBy: { createdAt: 'asc' },
          include: { therapist: { select: therapistSelect } },
        },
        _count: { select: { responses: true } },
      },
    })
    if (!request) { res.status(404).json({ error: 'Не знайдено' }); return }

    // Non-authors see responses only partially (for display, but can't select/PDF)
    const isAuthor = request.authorId === req.userId
    const myResponse = request.responses.find(r => r.therapistId === req.userId)

    res.json({ ...request, isAuthor, myResponseId: myResponse?.id ?? null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/therapist-requests/:id/respond — add response
router.post('/:id/respond', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await prisma.therapistRequest.findUnique({
      where: { id: req.params.id as string },
    })
    if (!request) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (request.status !== 'OPEN') { res.status(400).json({ error: 'Запит закрито' }); return }
    if (request.authorId === req.userId) { res.status(400).json({ error: 'Не можна відгукнутися на власний запит' }); return }

    const { presentation, links } = req.body
    if (!presentation?.trim()) { res.status(400).json({ error: 'Додайте самопрезентацію' }); return }

    const existing = await prisma.therapistResponse.findUnique({
      where: { requestId_therapistId: { requestId: request.id, therapistId: req.userId! } },
    })
    if (existing) { res.status(409).json({ error: 'Ви вже відгукнулись на цей запит' }); return }

    const response = await prisma.therapistResponse.create({
      data: {
        requestId: request.id,
        therapistId: req.userId!,
        presentation: presentation.trim(),
        links: links ? JSON.stringify(links) : null,
      },
      include: { therapist: { select: therapistSelect } },
    })

    // Notify author
    await prisma.notification.create({
      data: {
        userId: request.authorId,
        type: 'THERAPIST_REQUEST_RESPONSE',
        relatedId: request.id,
        isRead: false,
      },
    }).catch(() => {})

    res.status(201).json(response)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// PATCH /api/therapist-requests/:id/responses/:responseId/select — toggle selection
router.patch('/:id/responses/:responseId/select', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await prisma.therapistRequest.findUnique({ where: { id: req.params.id as string } })
    if (!request || request.authorId !== req.userId) { res.status(403).json({ error: 'Заборонено' }); return }

    const response = await prisma.therapistResponse.findUnique({ where: { id: req.params.responseId as string } })
    if (!response || response.requestId !== request.id) { res.status(404).json({ error: 'Не знайдено' }); return }

    const updated = await prisma.therapistResponse.update({
      where: { id: response.id },
      data: { isSelected: !response.isSelected },
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/therapist-requests/:id/close — close request
router.post('/:id/close', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await prisma.therapistRequest.findUnique({ where: { id: req.params.id as string } })
    if (!request) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (request.authorId !== req.userId) { res.status(403).json({ error: 'Заборонено' }); return }

    const updated = await prisma.therapistRequest.update({
      where: { id: request.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/therapist-requests/:id/pdf — generate PDF of selected responses
router.get('/:id/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await prisma.therapistRequest.findUnique({
      where: { id: req.params.id as string },
      include: {
        responses: {
          where: { isSelected: true },
          orderBy: { createdAt: 'asc' },
          include: { therapist: { select: therapistSelect } },
        },
      },
    })
    if (!request) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (request.authorId !== req.userId) { res.status(403).json({ error: 'Заборонено' }); return }
    if (request.responses.length === 0) { res.status(400).json({ error: 'Оберіть терапевтів для PDF' }); return }

    const pdf = await generateTherapistRequestPdf(request.responses)
    const dateStr = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="EFT_Therapists_${dateStr}.pdf"`)
    res.send(Buffer.from(pdf))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка формування PDF' })
  }
})

// GET /api/therapist-requests/my — author's own requests
router.get('/my/list', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await prisma.therapistRequest.findMany({
      where: { authorId: req.userId! },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { responses: true } },
      },
    })
    res.json(requests)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
