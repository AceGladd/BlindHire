import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) {
      return NextResponse.json({ message: "Yetkisiz erişim." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string; // 'avatar', 'cv', 'transcript'

    if (!file) {
      return NextResponse.json({ message: "Dosya bulunamadı." }, { status: 400 });
    }

    let mimeType = file.type;

    // MIME type check based on upload type
    if (type === "avatar") {
      const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validImageTypes.includes(file.type)) {
        return NextResponse.json({ message: "Profil fotoğrafı için sadece JPG, PNG veya WEBP formatları desteklenmektedir." }, { status: 400 });
      }
    } else {
      const validDocTypes = [
        "application/pdf", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
        "application/msword" // .doc
      ];
      if (!validDocTypes.includes(file.type)) {
        return NextResponse.json({ message: "Özgeçmiş/Transkript için sadece PDF veya DOCX formatları desteklenmektedir." }, { status: 400 });
      }
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ message: "Dosya boyutu en fazla 5MB olabilir." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let processedBuffer = buffer;

    // Avatar ise sharp ile kırpıp optimize edelim
    if (type === "avatar") {
      try {
        const sharp = (await import("sharp")).default;
        processedBuffer = await sharp(buffer)
          .resize(256, 256, { fit: "cover" })
          .webp({ quality: 80 })
          .toBuffer();
        mimeType = "image/webp";
      } catch (e) {
        console.error("Sharp processing error:", e);
      }
    }

    // Render disk sınırlamasını aşmak için dosyayı doğrudan Base64 data URL formatına dönüştürüyoruz
    const base64Data = processedBuffer.toString("base64");
    const fileUrl = `data:${mimeType};base64,${base64Data}`;

    return NextResponse.json({ 
      message: "Dosya başarıyla yüklendi.", 
      url: fileUrl 
    }, { status: 201 });

  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ message: "Dosya yüklenirken bir hata oluştu." }, { status: 500 });
  }
}