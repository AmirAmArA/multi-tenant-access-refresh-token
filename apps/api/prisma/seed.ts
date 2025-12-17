import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/modules/auth/utils";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});  


async function main() {
  const email = "a@a.com";
  const password = "123456";

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`User ${email} already exists, skipping creation.`);
    return;
  }

  // Hash the password
  const passwordHash = await hashPassword(password);

  // Create super admin user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });

  console.log(`✅ Created super admin user: ${user.email} (ID: ${user.id})`);
}

main()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
