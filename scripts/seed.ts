/**
 * Seed konta demo (MVP bez logowania).
 * W fazie 2 Better Auth zastąpi to prawdziwymi kontami — dane demo można wtedy
 * przepiąć na pierwsze zalogowane konto (UPDATE users SET ... WHERE email = demo).
 */
import { prisma, DEMO_USER_EMAIL } from "../server/db";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, name: "Czytelnik demo", theme: "light" },
  });
  console.log(`✓ Konto demo gotowe: ${user.email} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
