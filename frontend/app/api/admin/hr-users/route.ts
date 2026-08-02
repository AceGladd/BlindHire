import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const hrUsers = await prisma.user.findMany({
      where: { 
        role: { in: ["HR", "COMPANY_MANAGER"] } 
      },
      include: { company: true },
      orderBy: { createdAt: "desc" },
    });

    const mappedUsers = hrUsers.map((u: any) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      companyId: u.companyId,
      companyName: u.company?.name || "Belirsiz Şirket",
      role: u.role,
      createdAt: u.createdAt,
    }));

    return NextResponse.json(mappedUsers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Sunucu hatası." }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { fullName, email, password, companyId, role } = await request.json();

    if (!fullName || !email || !password || !companyId) {
      return NextResponse.json({ message: "Eksik parametre girdiniz." }, { status: 400 });
    }

    const assignedRole = role === "COMPANY_MANAGER" ? "COMPANY_MANAGER" : "HR";

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
        passwordHash: password, // Plain text to match login
        role: assignedRole,
        companyId,
      },
    });

    return NextResponse.json(
      { id: newHrUser.id, fullName: newHrUser.fullName, email: newHrUser.email, role: newHrUser.role },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Sunucu hatası." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "ID belirtilmedi." }, { status: 400 });
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