import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/company-manager/hr-users
// Sadece giriş yapan company manager'ın firmasına ait İK kullanıcılarını getirir
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.cookies.get("user_id")?.value;
    const role = request.cookies.get("user_role")?.value;

    if (!userId || role !== "COMPANY_MANAGER") {
      return NextResponse.json({ message: "Yetkisiz erişim." }, { status: 403 });
    }

    const manager = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true }
    });

    if (!manager?.companyId) {
      return NextResponse.json({ message: "Firmanız bulunamadı." }, { status: 404 });
    }

    const hrUsers = await prisma.user.findMany({
      where: { 
        companyId: manager.companyId,
        role: "HR"
      },
      orderBy: { createdAt: "desc" },
    });

    const mappedUsers = hrUsers.map((u: any) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      createdAt: u.createdAt,
    }));

    return NextResponse.json(mappedUsers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Sunucu hatası." }, { status: 500 });
  }
}

// POST /api/company-manager/hr-users
// Kendi firmasına yeni bir İK kullanıcısı ekler
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.cookies.get("user_id")?.value;
    const role = request.cookies.get("user_role")?.value;

    if (!userId || role !== "COMPANY_MANAGER") {
      return NextResponse.json({ message: "Yetkisiz erişim." }, { status: 403 });
    }

    const manager = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true }
    });

    if (!manager?.companyId) {
      return NextResponse.json({ message: "Firmanız bulunamadı." }, { status: 404 });
    }

    const { fullName, email, password } = await request.json();

    if (!fullName || !email || !password) {
      return NextResponse.json({ message: "Eksik parametre girdiniz." }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (exists) {
      return NextResponse.json({ message: "Bu e-posta adresi ile zaten kayıtlı bir hesap var." }, { status: 400 });
    }

    const newHrUser = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: password, // Plain text to match login format currently used
        role: "HR",
        companyId: manager.companyId,
      },
    });

    return NextResponse.json(
      { id: newHrUser.id, fullName: newHrUser.fullName, email: newHrUser.email },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Sunucu hatası." }, { status: 500 });
  }
}

// DELETE /api/company-manager/hr-users
// Kendi firmasından bir İK kullanıcısını siler
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.cookies.get("user_id")?.value;
    const role = request.cookies.get("user_role")?.value;

    if (!userId || role !== "COMPANY_MANAGER") {
      return NextResponse.json({ message: "Yetkisiz erişim." }, { status: 403 });
    }

    const manager = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true }
    });

    if (!manager?.companyId) {
      return NextResponse.json({ message: "Firmanız bulunamadı." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "ID belirtilmedi." }, { status: 400 });
    }

    // Verify the target HR user belongs to the same company
    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser || targetUser.companyId !== manager.companyId || targetUser.role !== "HR") {
      return NextResponse.json({ message: "Kullanıcı bulunamadı veya silme yetkiniz yok." }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: "İK kullanıcısı silindi." });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Sunucu hatası." }, { status: 500 });
  }
}