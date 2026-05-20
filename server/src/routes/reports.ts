import { Router, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { buildReportHTML } from '../lib/reportHtml'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type = 'full', dateFrom, dateTo } = req.query as Record<string, string | undefined>
    const userId = req.userId!

    const dateFilter = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true, lastName: true, latinName: true,
        email: true, phone: true, telegram: true, eftLevel: true,
      },
    })

    if (!user) { res.status(404).json({ error: 'Не знайдено' }); return }

    // Therapist block shared by both report types
    const therapist = {
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      latinName: user.latinName ?? null,
      email: user.email,
      phone: user.phone ?? null,
      telegram: user.telegram ?? null,
      eftLevel: user.eftLevel,  // raw enum — frontend translates
    }

    if (type === 'summary') {
      const [supervisions, seminarsAgg, skillsGroups] = await Promise.all([
        prisma.supervision.findMany({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          select: { type: true, hours: true },
        }),
        prisma.seminar.aggregate({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          _count: { id: true },
          _sum: { hours: true, points: true },
        }),
        prisma.skillsGroup.aggregate({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          _count: { id: true },
          _sum: { hours: true },
        }),
      ])

      const byType: Record<string, number> = {}
      supervisions.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1 })
      const totalSupHours = supervisions.reduce((sum, s) => sum + (s.hours ?? 1), 0)

      res.json({
        type: 'summary',
        period: { from: dateFrom ?? null, to: dateTo ?? null },
        generatedAt: new Date().toISOString(),
        therapist,
        totals: {
          supervisions: { total: supervisions.length, byType, totalHours: totalSupHours },
          seminars: {
            total: seminarsAgg._count.id,
            totalHours: seminarsAgg._sum.hours ?? 0,
            totalPoints: seminarsAgg._sum.points ?? 0,
          },
          skillsGroups: {
            total: skillsGroups._count.id,
            totalHours: skillsGroups._sum.hours ?? 0,
          },
        },
      })
      return
    }

    // Full report
    const [supervisions, seminars, skillsGroups] = await Promise.all([
      prisma.supervision.findMany({
        where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
        include: { supervisor: { select: { firstName: true, lastName: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.seminar.findMany({
        where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
        orderBy: { date: 'asc' },
      }),
      prisma.skillsGroup.findMany({
        where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
        include: { supervisor: { select: { firstName: true, lastName: true } } },
        orderBy: { date: 'asc' },
      }),
    ])

    res.json({
      type: 'full',
      period: { from: dateFrom ?? null, to: dateTo ?? null },
      generatedAt: new Date().toISOString(),
      therapist,
      supervisions: supervisions.map(s => ({
        date: s.date.toISOString(),
        supervisorName: `${s.supervisor.firstName} ${s.supervisor.lastName}`,
        type: s.type,
        hours: s.hours,
      })),
      seminars: seminars.map(s => ({
        title: s.title,
        date: s.date.toISOString(),
        hours: s.hours,
        points: s.points,
        certificateUrl: s.certificateUrl,
      })),
      skillsGroups: skillsGroups.map(s => ({
        date: s.date.toISOString(),
        supervisorName: `${s.supervisor.firstName} ${s.supervisor.lastName}`,
        hours: s.hours,
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка сервера' })
  }
})

router.get('/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type = 'full', dateFrom, dateTo } = req.query as Record<string, string | undefined>
    const userId = req.userId!

    const dateFilter = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true, lastName: true, latinName: true,
        email: true, phone: true, telegram: true, eftLevel: true,
      },
    })

    if (!user) { res.status(404).json({ error: 'Не знайдено' }); return }

    const therapist = {
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      latinName: user.latinName ?? null,
      email: user.email,
      phone: user.phone ?? null,
      telegram: user.telegram ?? null,
      eftLevel: user.eftLevel,
    }

    const data: any = {
      type,
      period: { from: dateFrom ?? null, to: dateTo ?? null },
      generatedAt: new Date().toISOString(),
      therapist,
    }

    if (type === 'summary') {
      const [supervisions, seminarsAgg, skillsGroupsAgg] = await Promise.all([
        prisma.supervision.findMany({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          select: { type: true, hours: true },
        }),
        prisma.seminar.aggregate({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          _count: { id: true },
          _sum: { hours: true, points: true },
        }),
        prisma.skillsGroup.aggregate({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          _count: { id: true },
          _sum: { hours: true },
        }),
      ])
      const byType: Record<string, number> = {}
      supervisions.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1 })
      const totalSupHours = supervisions.reduce((sum, s) => sum + (s.hours ?? 1), 0)
      data.totals = {
        supervisions: { total: supervisions.length, byType, totalHours: totalSupHours },
        seminars: {
          total: seminarsAgg._count.id,
          totalHours: seminarsAgg._sum.hours ?? 0,
          totalPoints: seminarsAgg._sum.points ?? 0,
        },
        skillsGroups: {
          total: skillsGroupsAgg._count.id,
          totalHours: skillsGroupsAgg._sum.hours ?? 0,
        },
      }
    } else {
      const [supervisions, seminars, skillsGroups] = await Promise.all([
        prisma.supervision.findMany({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          include: { supervisor: { select: { firstName: true, lastName: true } } },
          orderBy: { date: 'asc' },
        }),
        prisma.seminar.findMany({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          orderBy: { date: 'asc' },
        }),
        prisma.skillsGroup.findMany({
          where: { userId, status: 'APPROVED', ...(hasDateFilter && { date: dateFilter }) },
          include: { supervisor: { select: { firstName: true, lastName: true } } },
          orderBy: { date: 'asc' },
        }),
      ])
      data.supervisions = supervisions.map(s => ({
        date: s.date.toISOString(),
        supervisorName: `${s.supervisor.firstName} ${s.supervisor.lastName}`,
        type: s.type,
        hours: s.hours,
      }))
      data.seminars = seminars.map(s => ({
        title: s.title,
        date: s.date.toISOString(),
        hours: s.hours,
        points: s.points,
        certificateUrl: s.certificateUrl,
      }))
      data.skillsGroups = skillsGroups.map(s => ({
        date: s.date.toISOString(),
        supervisorName: `${s.supervisor.firstName} ${s.supervisor.lastName}`,
        hours: s.hours,
      }))
    }

    const html = buildReportHTML(data, type as 'full' | 'summary')

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer') as typeof import('puppeteer')
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })
      await page.waitForFunction('document.fonts.ready')
      const pdf = await page.pdf({ format: 'A4', printBackground: true })

      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `EFT_Report_${user.lastName || ''}_${user.firstName || ''}_${dateStr}.pdf`

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      res.send(Buffer.from(pdf))
    } finally {
      await browser.close()
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Помилка формування PDF' })
  }
})

export default router
