import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetCodeStore } from "../forgot-password/route";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { message: "Lütfen tüm alanları eksiksiz doldurunuz." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: "Yeni şifre en az 6 karakter olmalıdır." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const storedData = resetCodeStore.get(cleanEmail);

    if (!storedData) {
      return NextResponse.json(
        { message: "Geçersiz veya süresi dolmuş kod. Lütfen yeni kod talep edin." },
        { status: 400 }
      );
    }

    if (Date.now() > storedData.expiresAt) {
      resetCodeStore.delete(cleanEmail);
      return NextResponse.json(
        { message: "Doğrulama kodunun süresi dolmuş. Lütfen yeni kod isteyin." },
        { status: 400 }
      );
    }

    if (storedData.code !== code.trim()) {
      return NextResponse.json(
        { message: "Girdiğiniz 6 haneli doğrulama kodu hatalı." },
        { status: 400 }
      );
    }

    // Update password in Prisma DB if user exists
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (user) {
      await prisma.user.update({
        where: { email: cleanEmail },
        data: { passwordHash: newPassword },
      });
    }

    // Clear reset code after successful reset
    resetCodeStore.delete(cleanEmail);

    console.log(`[AUTH] Şifre başarıyla güncellendi: ${cleanEmail}`);

    return NextResponse.json({
      message: "Şifreniz başarıyla sıfırlandı! Şimdi yeni şifrenizle giriş yapabilirsiniz.",
    });
  } catch (error) {
    console.error("[RESET_PASSWORD_ERROR]", error);
    return NextResponse.json(
      { message: "Şifre güncellenirken sunucu hatası oluştu." },
      { status: 500 }
    );
  }
}
