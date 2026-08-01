import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email-service";

// In-memory code store
export const resetCodeStore = new Map<string, { code: string; expiresAt: number }>();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "Geçerli bir e-posta adresi giriniz." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists in database
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    const isSuperAdmin = cleanEmail === "admin@blindhire.ai" || cleanEmail === "admin";

    if (!user && !isSuperAdmin) {
      return NextResponse.json({
        message: "Eğer e-posta adresi sistemimizde kayıtlı ise doğrulama kodu gönderildi.",
      });
    }

    // Generate 6-digit numeric verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

    // Store in memory
    resetCodeStore.set(cleanEmail, { code, expiresAt });

    // Send real email via nodemailer email service
    await sendPasswordResetEmail(cleanEmail, code, user?.fullName || "Kullanıcı");

    console.log(`[AUTH] 6 Haneli Şifre Sıfırlama Kodu e-posta ile gönderildi: ${cleanEmail}`);

    return NextResponse.json({
      message: `Doğrulama kodu ${cleanEmail} e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.`,
    });
  } catch (error) {
    console.error("[FORGOT_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { message: "Sunucu hatası oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
