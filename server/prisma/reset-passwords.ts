import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('Test1234', 12)
  const emails = ['therapist@eft.ua', 'supervisor@eft.ua', 'admin@eft.ua']
  for (const email of emails) {
    try {
      const u = await prisma.user.update({ where: { email }, data: { password: hash } })
      console.log('updated:', u.email)
    } catch {
      console.log('not found:', email)
    }
  }
}

main().finally(() => prisma.$disconnect())
