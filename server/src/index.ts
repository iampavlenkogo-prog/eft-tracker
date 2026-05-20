import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRouter from './routes/auth'
import supervisionsRouter from './routes/supervisions'
import usersRouter from './routes/users'
import dashboardRouter from './routes/dashboard'
import seminarsRouter from './routes/seminars'
import reportsRouter from './routes/reports'
import slotsRouter from './routes/slots'
import adminRouter from './routes/admin'
import eventsRouter from './routes/events'
import notificationsRouter from './routes/notifications'
import skillsGroupsRouter from './routes/skillsGroups'
import { startReminderScheduler } from './lib/reminderScheduler'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/supervisions', supervisionsRouter)
app.use('/api/users', usersRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/seminars', seminarsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/slots', slotsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/events', eventsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/skills-groups', skillsGroupsRouter)

// Global JSON error handler — catches multer errors and other middleware errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Global error handler:', err)
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Помилка сервера'
  res.status(status).json({ error: message })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  startReminderScheduler()
})

export default app
