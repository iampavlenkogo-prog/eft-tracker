import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

const router = Router()
router.use(authMiddleware)

const authorSelect = { id: true, firstName: true, lastName: true, avatarUrl: true }

// GET /api/phrases?limit=5&random=true  — all phrases (dashboard feed)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50)
    const random = req.query.random === 'true'

    const phrases = await prisma.communityPhrase.findMany({
      orderBy: { createdAt: 'desc' },
      take: random ? 50 : limit,
      include: {
        author: { select: authorSelect },
        savedBy: { where: { userId: req.userId }, select: { id: true } },
      },
    })

    const result = random
      ? phrases.sort(() => Math.random() - 0.5).slice(0, limit)
      : phrases

    res.json(result.map(p => ({
      id: p.id,
      text: p.text,
      author: p.author,
      createdAt: p.createdAt,
      savedByMe: p.savedBy.length > 0,
    })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/phrases/my — current user's own phrases
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const phrases = await prisma.communityPhrase.findMany({
      where: { authorId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: authorSelect } },
    })
    res.json(phrases)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/phrases/collection — own phrases + saved phrases
router.get('/collection', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [own, saved] = await Promise.all([
      prisma.communityPhrase.findMany({
        where: { authorId: req.userId },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: authorSelect } },
      }),
      prisma.savedPhrase.findMany({
        where: { userId: req.userId },
        orderBy: { savedAt: 'desc' },
        include: {
          phrase: { include: { author: { select: authorSelect } } },
        },
      }),
    ])

    const savedPhrases = saved
      .filter(s => s.phrase.authorId !== req.userId)
      .map(s => ({ ...s.phrase, savedAt: s.savedAt, savedId: s.id }))

    res.json({ own, saved: savedPhrases })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/phrases — create phrase
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { text } = req.body
    if (!text?.trim()) {
      res.status(400).json({ error: 'Текст фрази обовʼязковий' }); return
    }
    const phrase = await prisma.communityPhrase.create({
      data: { text: text.trim(), authorId: req.userId! },
      include: { author: { select: authorSelect } },
    })
    res.status(201).json(phrase)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// PATCH /api/phrases/:id — edit own phrase
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const phrase = await prisma.communityPhrase.findUnique({ where: { id: req.params.id as string } })
    if (!phrase) { res.status(404).json({ error: 'Не знайдено' }); return }

    const isAdmin = (req as any).roles?.includes('ADMIN')
    if (phrase.authorId !== req.userId && !isAdmin) {
      res.status(403).json({ error: 'Заборонено' }); return
    }

    const { text } = req.body
    if (!text?.trim()) { res.status(400).json({ error: 'Текст обовʼязковий' }); return }

    const updated = await prisma.communityPhrase.update({
      where: { id: req.params.id as string },
      data: { text: text.trim() },
      include: { author: { select: authorSelect } },
    })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// DELETE /api/phrases/:id — delete own phrase
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const phrase = await prisma.communityPhrase.findUnique({ where: { id: req.params.id as string } })
    if (!phrase) { res.status(404).json({ error: 'Не знайдено' }); return }

    const isAdmin = (req as any).roles?.includes('ADMIN')
    if (phrase.authorId !== req.userId && !isAdmin) {
      res.status(403).json({ error: 'Заборонено' }); return
    }

    await prisma.communityPhrase.delete({ where: { id: req.params.id as string } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/phrases/:id/save — save to collection
router.post('/:id/save', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.savedPhrase.create({
      data: { userId: req.userId!, phraseId: req.params.id as string },
    })
    res.json({ ok: true })
  } catch (err: any) {
    if (err.code === 'P2002') { res.json({ ok: true }); return }
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// DELETE /api/phrases/:id/save — remove from collection
router.delete('/:id/save', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.savedPhrase.deleteMany({
      where: { userId: req.userId, phraseId: req.params.id as string },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
