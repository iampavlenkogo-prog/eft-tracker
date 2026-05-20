import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { requireRole } from '../middleware/roleMiddleware'
import { upload, uploadBuffer } from '../lib/cloudinary'
import { sendSeminarRequest } from '../lib/email'

const router = Router()
router.use(authMiddleware)

async function notifySeminarRequest(therapistId: string, seminarTitle: string) {
  try {
    const [therapist, admins] = await Promise.all([
      prisma.user.findUnique({ where: { id: therapistId }, select: { firstName: true, lastName: true } }),
      prisma.user.findMany({ where: { roles: { has: 'ADMIN' } }, select: { email: true } }),
    ])
    if (therapist && admins.length > 0) {
      await Promise.all(
        admins.map(a => sendSeminarRequest(a.email, `${therapist.firstName} ${therapist.lastName}`, seminarTitle))
      )
    }
  } catch (err) { console.error('Email error:', err) }
}

router.get('/:id/certificate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seminar = await prisma.seminar.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
      select: { certificateUrl: true },
    })
    if (!seminar?.certificateUrl) { res.status(404).json({ error: 'Не знайдено' }); return }

    const url = seminar.certificateUrl
    const isRaw = url.includes('/raw/upload/')

    if (isRaw) {
      // Proxy PDF through server with correct Content-Type
      const https = await import('https')
      const fileRes = await new Promise<{ statusCode: number; buffer: Buffer }>((resolve, reject) => {
        https.default.get(url, (r) => {
          const chunks: Buffer[] = []
          r.on('data', (c: Buffer) => chunks.push(c))
          r.on('end', () => resolve({ statusCode: r.statusCode ?? 200, buffer: Buffer.concat(chunks) }))
          r.on('error', reject)
        }).on('error', reject)
      })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline; filename="certificate.pdf"')
      res.status(200).send(fileRes.buffer)
    } else {
      // Public image (PNG/JPG) — redirect directly
      res.json({ url })
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seminars = await prisma.seminar.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
    })
    res.json(seminars)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.post('/', upload.single('certificate'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, date, hours, points } = req.body

    if (!title || !date || hours == null || points == null) {
      res.status(400).json({ error: 'Всі обовʼязкові поля мають бути заповнені' })
      return
    }

    let certificateUrl: string | null = null

    if (req.file) {
      const cloudinaryConfigured =
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET

      if (!cloudinaryConfigured) {
        res.status(500).json({ error: 'Cloudinary не налаштовано — заповніть .env та перезапустіть сервер' })
        return
      }

      try {
        certificateUrl = await uploadBuffer(req.file.buffer, 'eft-certificates', req.file.mimetype)
      } catch {
        res.status(500).json({ error: 'Помилка завантаження файлу до Cloudinary' })
        return
      }
    }

    const seminar = await prisma.seminar.create({
      data: {
        userId: req.userId!,
        title,
        date: new Date(date),
        hours: parseFloat(hours),
        points: parseFloat(points),
        certificateUrl,
      },
    })

    res.status(201).json(seminar)
    notifySeminarRequest(req.userId!, title)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/pending', requireRole('ADMIN'), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seminars = await prisma.seminar.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(seminars)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.patch('/:id/approve', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const seminar = await prisma.seminar.findUnique({ where: { id } })
    if (!seminar) { res.status(404).json({ error: 'Не знайдено' }); return }

    const updated = await prisma.seminar.update({ where: { id }, data: { status: 'APPROVED' } })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.patch('/:id/reject', requireRole('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const seminar = await prisma.seminar.findUnique({ where: { id } })
    if (!seminar) { res.status(404).json({ error: 'Не знайдено' }); return }

    const updated = await prisma.seminar.update({ where: { id }, data: { status: 'REJECTED' } })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
