import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Seeding users only...');

  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    const [manager, client, delivery] = await Promise.all([
      // Manager
      // email: manager@example.com
      // password: password123
      prisma.user.upsert({
        where: { email: 'manager@example.com' },
        update: { passwordHash }, // Update password to ensure it matches
        create: {
          email: 'manager@example.com',
          passwordHash,
          fullName: 'Store Manager',
          role: UserRole.MANAGER,
        },
      }),

      // Client
      // email: client@example.com
      // password: password123
      prisma.user.upsert({
        where: { email: 'client@example.com' },
        update: { passwordHash },
        create: {
          email: 'client@example.com',
          passwordHash,
          fullName: 'Regular Client',
          role: UserRole.CLIENT,
        },
      }),

      // Delivery Person
      // email: delivery@example.com
      // password: password123
      prisma.user.upsert({
        where: { email: 'delivery@example.com' },
        update: { passwordHash },
        create: {
          email: 'delivery@example.com',
          passwordHash,
          fullName: 'Delivery Person',
          role: UserRole.DELIVERY_PERSON,
        },
      }),
    ]);

    console.log('Successfully seeded users!');
    console.log('--- Credentials ---');
    console.log(`Manager : ${manager.email} / password123`);
    console.log(`Client  : ${client.email}  / password123`);
    console.log(`Delivery: ${delivery.email} / password123`);
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
