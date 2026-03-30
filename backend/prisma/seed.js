import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_STAFF_POSITIONS = [
  'Strategic Growth & Market Development',
  'Client & Stakeholder Engagement',
  'Monitoring & Reporting',
  'Content Production',
  'Creative Development',
  'Research & Innovation',
  'Operational Support',
];

async function main() {
  const email = 'admin@example.com';
  const plain = 'AdminPass123!';
  const hashed = await bcrypt.hash(plain, parseInt(process.env.BCRYPT_SALT_ROUNDS || '10'));

  const mainSubsidiary = await prisma.subsidiary.upsert({
    where: { code: 'MAIN' },
    update: {
      name: 'Main',
      isActive: true,
      country: 'Nigeria',
    },
    create: {
      name: 'Main',
      code: 'MAIN',
      country: 'Nigeria',
      isActive: true,
    },
    select: { id: true },
  });

  // Ensure we create a user with a deterministic id so stub tokens match
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const user = await prisma.user.create({
    data: {
      id: 'user-1',
      email,
      passwordHash: hashed,
      fullName: 'System Admin',
      role: 'ADMIN',
      subsidiaryAccess: [mainSubsidiary.id],
      subsidiaryId: mainSubsidiary.id,
      employeeId: 'EMP001',
      isActive: true
    }
  });

  for (const name of DEFAULT_STAFF_POSITIONS) {
    const position = await prisma.staffPosition.upsert({
      where: { name },
      update: {
        archived: 0,
        updatedById: user.id,
      },
      create: {
        name,
        archived: 0,
        createdById: user.id,
        updatedById: user.id,
      },
      select: { id: true },
    });

    await prisma.staffPositionSubsidiary.upsert({
      where: {
        positionId_subsidiaryId: {
          positionId: position.id,
          subsidiaryId: mainSubsidiary.id,
        },
      },
      update: {},
      create: {
        positionId: position.id,
        subsidiaryId: mainSubsidiary.id,
      },
    });
  }

  console.log('Seeded admin user:', user.email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
