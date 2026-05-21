import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'

const router = Router()
router.use(authMiddleware)

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (_req, res: Response) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' })
})

// POST /api/push/subscribe
router.post('/subscribe', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { endpoint, keys } = req.body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Невірні дані підписки' }); return
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth },
    })

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

// DELETE /api/push/subscribe
router.delete('/subscribe', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { endpoint } = req.body
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint, userId: req.userId },
      })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
