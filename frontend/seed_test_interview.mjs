// Canli LLM testi icin gecici seed scripti: tek bir Company/User/JobPosting/Application
// olusturur ve mulakat sifresini ekrana yazdirir. Kullanimdan sonra silinebilir.
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { name: "Test Sirketi" },
    update: {},
    create: { name: "Test Sirketi" },
  });

  const candidate = await prisma.user.upsert({
    where: { email: "test.aday@example.com" },
    update: {},
    create: {
      email: "test.aday@example.com",
      passwordHash: crypto.createHash("sha256").update("test").digest("hex"),
      fullName: "Test Aday",
      role: "CANDIDATE",
    },
  });

  const jobPosting = await prisma.jobPosting.create({
    data: {
      title: "Backend Gelistirici (Test)",
      description: "Canli LLM testi icin olusturulan test ilani.",
      companyId: company.id,
      status: "ACTIVE",
    },
  });

  const password = "TEST123";
  const application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      jobPostingId: jobPosting.id,
      cvUrl: "https://example.com/dummy-cv.pdf",
      status: "PENDING",
      interviewId: "default",
      interviewPassword: password,
    },
  });

  console.log("\n=== TEST MULAKAT LINKI HAZIR ===");
  console.log("URL: http://localhost:3000/interview/default");
  console.log("Sifre:", password);
  console.log("Application ID:", application.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
