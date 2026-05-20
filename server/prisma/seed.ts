import { PrismaClient, EftLevel, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('Test1234', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@eft.ua' },
    update: { password: passwordHash },
    create: {
      email: 'admin@eft.ua',
      password: passwordHash,
      firstName: 'Admin',
      lastName: 'EFT',
      latinName: 'Admin EFT',
      eftLevel: EftLevel.SUPERVISOR,
      roles: [Role.ADMIN],
    },
  })

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@eft.ua' },
    update: { password: passwordHash },
    create: {
      email: 'supervisor@eft.ua',
      password: passwordHash,
      firstName: 'Supervisor',
      lastName: 'EFT',
      latinName: 'Supervisor EFT',
      eftLevel: EftLevel.SUPERVISOR,
      roles: [Role.SUPERVISOR, Role.THERAPIST],
    },
  })

  const therapist = await prisma.user.upsert({
    where: { email: 'therapist@eft.ua' },
    update: { password: passwordHash },
    create: {
      email: 'therapist@eft.ua',
      password: passwordHash,
      firstName: 'Therapist',
      lastName: 'EFT',
      latinName: 'Therapist EFT',
      eftLevel: EftLevel.ADVANCED,
      roles: [Role.THERAPIST],
    },
  })

  console.log('Seed completed:')
  console.log(`  Admin:      ${admin.email}`)
  console.log(`  Supervisor: ${supervisor.email}`)
  console.log(`  Therapist:  ${therapist.email}`)
  console.log('  Password for all: Test1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
