import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { sendWelcomeEmail, sendPasswordResetEmail, sendAdminNewUserNotification } from '../lib/email'
import { upload, uploadBuffer } from '../lib/cloudinary'

const router = Router()

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  latinName: true,
  phone: true,
  telegram: true,
  meetingLink: true,
  eftLevel: true,
  roles: true,
  avatarUrl: true,
  createdAt: true,
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, latinName, phone, telegram, eftLevel } = req.body

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'Email, пароль, імʼя та прізвище обовʼязкові' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Користувач з таким email вже існує' })
      return
    }

    const hashed = await bcrypt.hash(password, 10)
    const resolvedLevel = eftLevel || 'BASIC'
    const roles: ('THERAPIST' | 'SUPERVISOR')[] = ['THERAPIST']
    if (resolvedLevel === 'SUPERVISOR') roles.push('SUPERVISOR')

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        firstName,
        lastName,
        latinName: latinName || null,
        phone: phone || null,
        telegram: telegram || null,
        eftLevel: resolvedLevel,
        roles,
      },
      select: userSelect,
    })

    const token = jwt.sign(
      { userId: user.id, roles: user.roles },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    sendWelcomeEmail(email, firstName, password, new Date()).catch(console.error)

    prisma.user.findMany({
      where: { roles: { has: 'ADMIN' } },
      select: { email: true },
    }).then(admins => {
      const therapistName = `${firstName} ${lastName}`
      admins.forEach(a =>
        sendAdminNewUserNotification(a.email, therapistName, email, resolvedLevel).catch(console.error)
      )
    }).catch(console.error)

    res.status(201).json({ user, token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email та пароль обовʼязкові' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(401).json({ error: 'Невірний email або пароль' })
      return
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      res.status(401).json({ error: 'Невірний email або пароль' })
      return
    }

    const token = jwt.sign(
      { userId: user.id, roles: user.roles },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    const { password: _, ...userWithoutPassword } = user
    res.json({ user: userWithoutPassword, token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: userSelect })
    if (!user) { res.status(404).json({ error: 'Користувача не знайдено' }); return }
    res.json(user)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.patch('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, latinName, phone, telegram, meetingLink, eftLevel } = req.body

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(latinName !== undefined && { latinName: latinName || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(telegram !== undefined && { telegram: telegram || null }),
        ...(meetingLink !== undefined && { meetingLink: meetingLink || null }),
        ...(eftLevel && { eftLevel }),
      },
      select: userSelect,
    })

    res.json(user)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.patch('/password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Всі поля обовʼязкові' }); return
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Новий пароль має бути мінімум 8 символів' }); return
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) { res.status(404).json({ error: 'Не знайдено' }); return }

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) { res.status(400).json({ error: 'Невірний поточний пароль' }); return }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const ok = { message: 'Якщо цей email зареєстрований, ви отримаєте лист з інструкціями' }
  try {
    const { email } = req.body
    if (!email) { res.status(400).json({ error: 'Email обовʼязковий' }); return }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { res.json(ok); return }

    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    })

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`
    sendPasswordResetEmail(email, user.firstName, resetLink).catch(console.error)

    res.json(ok)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.post('/avatar', authMiddleware, upload.single('avatar'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Файл не завантажено' }); return }
    const url = await uploadBuffer(req.file.buffer, 'avatars', req.file.mimetype)
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl: url },
      select: userSelect,
    })
    res.json(user)
  } catch (err: any) {
    console.error('Avatar upload error:', err)
    const message = err?.message || err?.http_code || JSON.stringify(err)
    res.status(500).json({ error: `Помилка завантаження: ${message}` })
  }
})

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Токен та новий пароль обовʼязкові' }); return
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Пароль має бути мінімум 8 символів' }); return
    }

    const user = await prisma.user.findUnique({ where: { resetToken: token } })
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      res.status(400).json({ error: 'Посилання недійсне або прострочене' }); return
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    })

    res.json({ message: 'Пароль успішно змінено' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

export default router
