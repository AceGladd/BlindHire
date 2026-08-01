import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.cookies.get("user_id")?.value;
    if (!userId) {
      return NextResponse.json({ message: "Oturum açılmamış." }, { status: 401 });
    }

    const hrUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!hrUser || hrUser.role !== "HR" || !hrUser.companyId) {
      return NextResponse.json({ message: "Yetkisiz veya geçersiz şirket." }, { status: 403 });
    }

    const companyId = hrUser.companyId;
    let settings = await prisma.hRSettings.findUnique({
      where: { companyId }
    });

    if (!settings) {
      settings = {
        id: "default",
        companyId,
        stage1AutoProceedThreshold: 75,
        stage1AutoRejectThreshold: 50,
        stage2AutoInviteThreshold: 75,
        stage2AutoRejectThreshold: 60,
        stage3AutoProceedThreshold: 75,
        stage3AutoRejectThreshold: 50,
        stage4AutoHireThreshold: 80,
        stage4AutoRejectThreshold: 50,
        autoApproveJobs: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      }
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Sunucu hatası." }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.cookies.get("user_id")?.value;
    if (!userId) {
      return NextResponse.json({ message: "Oturum açılmamış." }, { status: 401 });
    }

    const payload = await request.json();
    const parseThresh = (val: any, defaultVal: number) => (val !== undefined && val !== null && !isNaN(parseInt(val))) ? parseInt(val) : defaultVal;
    
    const stage1AutoProceedThreshold = parseThresh(payload.stage1AutoProceedThreshold, 75);
    const stage1AutoRejectThreshold = parseThresh(payload.stage1AutoRejectThreshold, 50);
    const stage2AutoInviteThreshold = parseThresh(payload.stage2AutoInviteThreshold, 75);
    const stage2AutoRejectThreshold = parseThresh(payload.stage2AutoRejectThreshold, 60);
    const stage3AutoProceedThreshold = parseThresh(payload.stage3AutoProceedThreshold, 75);
    const stage3AutoRejectThreshold = parseThresh(payload.stage3AutoRejectThreshold, 50);
    const stage4AutoHireThreshold = parseThresh(payload.stage4AutoHireThreshold, 80);
    const stage4AutoRejectThreshold = parseThresh(payload.stage4AutoRejectThreshold, 50);

    const hrUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!hrUser || hrUser.role !== "HR" || !hrUser.companyId) {
      return NextResponse.json({ message: "Yetkisiz veya geçersiz şirket." }, { status: 403 });
    }

    const companyId = hrUser.companyId;

    const newSettings = await prisma.hRSettings.upsert({
      where: { companyId },
      update: {
        stage1AutoProceedThreshold,
        stage1AutoRejectThreshold,
        stage2AutoInviteThreshold,
        stage2AutoRejectThreshold,
        stage3AutoProceedThreshold,
        stage3AutoRejectThreshold,
        stage4AutoHireThreshold,
        stage4AutoRejectThreshold
      },
      create: {
        companyId,
        stage1AutoProceedThreshold,
        stage1AutoRejectThreshold,
        stage2AutoInviteThreshold,
        stage2AutoRejectThreshold,
        stage3AutoProceedThreshold,
        stage3AutoRejectThreshold,
        stage4AutoHireThreshold,
        stage4AutoRejectThreshold
      }
    });

    return NextResponse.json({ message: "Ayarlar güncellendi.", settings: newSettings });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Sunucu hatası." }, { status: 500 });
  }
}
