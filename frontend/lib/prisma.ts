import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Avoid deleting an existing global; preserve singleton in dev to prevent multiple PrismaClients
// (some environments hot-reload modules and re-instantiating PrismaClient causes errors)
export const prisma = (globalThis as any).prismaGlobal ?? prismaClientSingleton();

// Backwards compatibility alias: older code may reference prisma.companySettings
// but the Prisma model is named HRSettings (generated client: prisma.hRSettings).
// Add an alias so prisma.companySettings -> prisma.hRSettings when available.
try {
  if (!(prisma as any).companySettings && (prisma as any).hRSettings) {
    (prisma as any).companySettings = (prisma as any).hRSettings;
  }
} catch (e) {
  // ignore - defensive in case Prisma client shape differs in some runtime
}

if (process.env.NODE_ENV !== 'production') (globalThis as any).prismaGlobal = prisma;
