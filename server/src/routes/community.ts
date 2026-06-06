import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { upload, uploadBuffer } from '../lib/cloudinary'
import { sendPushToUser } from '../lib/push'

const router = Router()
router.use(authMiddleware)

const POST_INCLUDE = {
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  reactions: { include: { user: { select: { id: true } } } },
  _count: { select: { comments: true } },
}

// GET /api/community/stats
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weeklyCount = await prisma.communityPost.count({ where: { createdAt: { gte: weekAgo } } })
    res.json({ weeklyCount })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/community?type=REFLECTION&page=1
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const type = req.query.type as string | undefined
    const page = parseInt((req.query.page as string) || '1')
    const limit = parseInt((req.query.limit as string) || '20')
    const skip = (page - 1) * limit
    const where = type && type !== 'ALL' ? { type: type as any } : {}

    const posts = await prisma.communityPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: POST_INCLUDE,
    })

    res.json(posts)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/community — create post
router.post('/', upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, title, content, linkUrl } = req.body
    if (!type || !content?.trim()) {
      res.status(400).json({ error: 'Тип та текст обовʼязкові' })
      return
    }

    let imageUrl: string | null = null
    if (req.file) {
      imageUrl = await uploadBuffer(req.file.buffer, 'eft-community', req.file.mimetype)
    }

    const post = await prisma.communityPost.create({
      data: {
        authorId: req.userId!,
        type,
        title: title?.trim() || null,
        content: content.trim(),
        imageUrl,
        linkUrl: linkUrl?.trim() || null,
      },
      include: POST_INCLUDE,
    })

    res.status(201).json(post)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/community/saved — posts where current user reacted with 💎 or 🔖
router.get('/saved', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const posts = await prisma.communityPost.findMany({
      where: {
        reactions: {
          some: {
            userId: req.userId!,
            emoji: { in: ['💎', '🔖'] },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: POST_INCLUDE,
    })
    res.json(posts)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// DELETE /api/community/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const post = await prisma.communityPost.findUnique({ where: { id } })
    if (!post) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (post.authorId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }
    await prisma.communityPost.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/community/:id/react — toggle reaction
router.post('/:id/react', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string
    const { emoji } = req.body
    if (!emoji) { res.status(400).json({ error: 'emoji required' }); return }

    const post = await prisma.communityPost.findUnique({ where: { id: postId } })
    if (!post) { res.status(404).json({ error: 'Не знайдено' }); return }

    const existing = await prisma.communityReaction.findUnique({
      where: { postId_userId_emoji: { postId, userId: req.userId!, emoji } },
    })

    if (existing) {
      await prisma.communityReaction.delete({ where: { id: existing.id } })
    } else {
      await prisma.communityReaction.create({
        data: { postId, userId: req.userId!, emoji },
      })
      if (post.authorId !== req.userId) {
        const reactor = await prisma.user.findUnique({
          where: { id: req.userId! },
          select: { firstName: true, lastName: true },
        })
        await prisma.notification.create({
          data: { userId: post.authorId, type: 'COMMUNITY_REACTION', relatedId: postId },
        })
        await sendPushToUser(
          post.authorId,
          'Нова реакція ♡',
          `${reactor?.firstName} ${reactor?.lastName} відреагував(ла) на вашу публікацію`,
          '/community',
        ).catch(console.error)
      }
    }

    const reactions = await prisma.communityReaction.findMany({
      where: { postId },
      include: { user: { select: { id: true } } },
    })
    res.json(reactions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// GET /api/community/:id/comments
router.get('/:id/comments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string
    const comments = await prisma.communityComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    })
    res.json(comments)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/community/:id/comments
router.post('/:id/comments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string
    const { content } = req.body
    if (!content?.trim()) { res.status(400).json({ error: 'Текст обовʼязковий' }); return }

    const post = await prisma.communityPost.findUnique({ where: { id: postId } })
    if (!post) { res.status(404).json({ error: 'Не знайдено' }); return }

    const comment = await prisma.communityComment.create({
      data: { postId, authorId: req.userId!, content: content.trim() },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    })

    if (post.authorId !== req.userId) {
      const commenter = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { firstName: true, lastName: true },
      })
      await prisma.notification.create({
        data: { userId: post.authorId, type: 'COMMUNITY_COMMENT', relatedId: postId },
      })
      await sendPushToUser(
        post.authorId,
        'Новий коментар',
        `${commenter?.firstName} ${commenter?.lastName} прокоментував(ла) вашу публікацію`,
        '/community',
      ).catch(console.error)
    }

    res.status(201).json(comment)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// DELETE /api/community/:postId/comments/:commentId
router.delete('/:postId/comments/:commentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string
    const comment = await prisma.communityComment.findUnique({ where: { id: commentId } })
    if (!comment) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (comment.authorId !== req.userId && !req.userRoles?.includes('ADMIN')) {
      res.status(403).json({ error: 'Заборонено' }); return
    }
    await prisma.communityComment.delete({ where: { id: commentId } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// POST /api/community/:postId/comments/:commentId/mark-useful
router.post('/:postId/comments/:commentId/mark-useful', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.postId as string
    const commentId = req.params.commentId as string

    const post = await prisma.communityPost.findUnique({ where: { id: postId } })
    if (!post) { res.status(404).json({ error: 'Не знайдено' }); return }
    if (post.authorId !== req.userId) {
      res.status(403).json({ error: 'Тільки автор питання може відзначити корисну відповідь' }); return
    }
    if (post.type !== 'QUESTION') {
      res.status(400).json({ error: 'Тільки для публікацій типу "Питання"' }); return
    }

    const comment = await prisma.communityComment.findUnique({ where: { id: commentId } })
    if (!comment) { res.status(404).json({ error: 'Не знайдено' }); return }

    const updated = await prisma.communityComment.update({
      where: { id: commentId },
      data: { isUseful: !comment.isUseful },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    })

    if (updated.isUseful && comment.authorId !== req.userId) {
      await prisma.notification.create({
        data: { userId: comment.authorId, type: 'COMMUNITY_USEFUL', relatedId: postId },
      })
      await sendPushToUser(
        comment.authorId,
        'Вашу відповідь відзначено корисною ♡',
        'Автор питання відзначив вашу відповідь як корисну',
        '/community',
      ).catch(console.error)
    }

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
