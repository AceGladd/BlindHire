import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { PALETTES } from "@/lib/theme";
import sharp from "sharp";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email, candidateName, companyName, interviewLink, interviewPassword, themeId } = await request.json();

    if (!email || !interviewLink || !interviewPassword) {
      return NextResponse.json(
        { message: "Eksik parametre." },
        { status: 400 }
      );
    }

    const parsedThemeId = parseInt(String(themeId).replace("theme-", ""), 10);
    const theme = PALETTES.get ? PALETTES.find((p: any) => p.id === parsedThemeId) : PALETTES[0];
    const t1 = theme.colors[0];
    const t2 = theme.colors[1];
    const t3 = theme.colors[2];

    const svgString = `<?xml version="1.0" encoding="UTF-8" ?>
<svg width="216" height="154" viewBox="0 0 953 682" version="1.1" xmlns="http://www.w3.org/2000/svg">
<g>
<path fill="${t1}" opacity="1.00" d=" M 675.39 17.56 C 699.28 17.26 723.17 17.78 747.06 17.45 C 761.15 17.35 775.40 17.58 789.18 20.85 C 795.09 22.20 800.77 24.35 806.42 26.49 C 836.84 37.63 863.06 59.58 879.72 87.33 C 899.09 119.23 906.80 158.23 899.96 195.01 C 894.20 230.98 874.00 264.14 845.49 286.66 C 827.92 300.68 806.89 310.19 784.86 314.51 C 772.39 316.85 759.67 317.35 747.02 317.31 C 719.01 317.14 690.99 317.47 662.97 317.21 C 656.61 316.94 650.82 319.83 645.00 321.94 C 625.41 329.29 605.80 336.63 585.90 343.11 C 579.42 345.28 572.99 348.51 565.98 348.18 C 556.12 347.27 549.18 335.84 552.38 326.59 C 557.76 309.92 563.91 293.51 569.72 276.99 C 570.32 273.83 567.55 271.52 565.70 269.37 C 543.74 246.28 529.45 215.78 526.90 183.92 C 524.75 161.06 527.10 137.60 535.06 115.99 C 540.54 101.70 547.21 87.73 556.62 75.58 C 578.28 46.99 610.71 26.84 645.88 19.87 C 655.57 17.79 665.53 17.92 675.39 17.56 M 581.33 98.30 C 566.85 118.07 559.23 142.54 558.92 166.97 C 558.02 201.13 573.94 235.10 600.32 256.71 C 604.56 259.94 607.59 265.57 605.95 270.95 C 602.58 282.81 597.11 293.90 592.90 305.46 C 611.30 299.39 629.42 292.52 647.86 286.57 C 652.14 285.22 656.42 283.52 660.99 283.64 C 694.66 283.36 728.32 283.87 761.99 283.32 C 805.96 281.79 846.64 251.04 861.95 210.09 C 869.00 190.99 871.07 170.11 867.94 150.00 C 863.34 117.31 844.07 86.69 816.02 69.10 C 798.73 57.45 777.84 51.30 757.01 51.56 C 726.01 51.66 695.00 51.29 664.01 51.81 C 631.40 54.24 600.47 71.85 581.33 98.30 Z" />
<path fill="${t1}" opacity="1.00" d=" M 246.51 373.62 C 261.28 370.80 276.71 379.40 283.64 392.43 C 287.75 399.81 288.52 408.73 286.64 416.88 C 282.60 433.26 265.80 445.56 248.92 443.86 C 232.95 442.55 219.35 428.72 217.61 412.91 C 214.94 394.92 228.48 376.36 246.51 373.62 Z" />
<path fill="${t1}" opacity="1.00" d=" M 450.36 374.55 C 468.06 369.36 489.01 380.88 493.20 399.06 C 499.14 417.34 486.34 438.39 468.02 443.02 C 455.27 446.39 441.25 440.93 432.92 430.99 C 427.90 425.15 425.30 417.53 424.80 409.92 C 424.12 394.19 435.20 378.84 450.36 374.55 Z" />
<path fill="${t1}" opacity="1.00" d=" M 309.47 495.72 C 313.51 494.51 317.78 494.58 321.97 494.60 C 347.32 494.76 372.66 494.62 398.01 494.57 C 403.20 494.70 408.90 496.88 411.45 501.68 C 414.12 506.86 412.89 513.14 410.20 518.05 C 404.73 527.94 396.11 536.00 386.06 541.11 C 370.99 548.79 352.88 550.31 336.75 545.22 C 326.05 541.90 316.49 535.32 309.15 526.91 C 305.03 522.08 301.79 516.29 300.83 509.95 C 300.06 504.04 303.55 497.42 309.47 495.72 Z" />
<path fill="${t1}" opacity="1.00" d=" M 584.42 533.51 C 591.37 541.86 600.63 549.16 611.78 550.34 C 594.69 577.49 567.34 598.02 536.40 606.57 C 523.12 611.22 508.90 610.88 495.06 611.82 C 492.17 618.58 488.52 625.13 483.34 630.42 C 473.96 639.96 460.23 644.80 446.94 643.80 C 433.34 642.94 420.23 635.73 412.49 624.47 C 406.00 615.06 402.24 603.42 403.50 591.93 C 404.82 576.60 413.37 561.48 427.27 554.27 C 446.60 543.13 473.79 547.61 487.49 565.55 C 490.57 569.90 492.40 575.03 495.76 579.20 C 530.49 580.46 565.82 563.17 584.42 533.51 M 444.41 578.66 C 435.84 581.46 430.70 591.39 432.94 600.05 C 434.90 610.04 446.69 615.97 456.13 613.01 C 466.35 610.10 472.30 597.15 467.48 587.59 C 463.75 579.10 452.85 575.33 444.41 578.66 Z" />
</g>
<g>
<path fill="${t2}" opacity="1.00" d=" M 289.39 55.42 C 309.44 42.54 338.87 47.69 353.16 66.83 C 363.56 79.53 366.25 97.26 362.13 112.91 C 357.84 128.09 345.91 140.65 331.30 146.39 C 331.24 167.66 331.20 188.94 331.17 210.21 C 382.47 210.21 433.77 210.20 485.07 210.20 C 491.89 210.20 499.23 211.72 504.33 216.57 C 507.94 220.31 510.11 225.73 509.23 230.95 C 507.92 239.59 500.01 247.17 491.06 246.90 C 411.07 246.57 331.08 246.62 251.08 246.83 C 221.28 246.83 191.90 258.90 170.07 279.07 C 146.11 301.86 131.94 334.88 132.59 368.01 C 132.74 411.33 132.46 454.65 132.73 497.97 C 132.93 521.96 140.67 545.52 153.21 565.85 C 172.64 598.36 206.94 621.81 244.52 627.20 C 254.62 628.75 264.86 628.22 275.04 628.36 C 298.38 628.44 321.72 628.48 345.07 628.49 C 352.22 628.49 359.81 632.46 362.43 639.39 C 364.90 646.79 363.73 656.14 357.45 661.34 C 352.91 665.16 346.65 665.23 341.02 665.31 C 314.36 665.19 287.70 665.34 261.04 665.25 C 225.58 664.90 189.97 653.19 162.30 630.79 C 130.78 605.87 109.12 569.35 100.74 530.18 C 70.88 530.96 42.69 509.73 33.49 481.62 C 29.43 470.56 30.32 458.59 30.38 447.03 C 30.53 441.03 29.68 435.06 29.69 429.07 C 29.62 420.06 30.42 411.07 30.36 402.06 C 29.95 381.35 40.08 361.06 56.02 348.03 C 68.43 337.72 84.53 332.94 100.41 331.85 C 106.49 302.71 121.71 275.74 142.59 254.64 C 158.85 238.50 178.87 226.31 200.37 218.50 C 218.99 212.70 238.53 209.66 258.04 210.17 C 271.56 210.41 285.08 210.11 298.59 209.87 C 298.80 188.77 298.94 167.66 298.66 146.56 C 289.32 142.13 280.41 136.12 274.33 127.61 C 266.20 116.01 263.52 100.91 266.61 87.14 C 269.37 73.98 278.20 62.61 289.39 55.42 M 64.82 402.02 C 64.74 421.68 64.63 441.34 64.79 461.00 C 65.39 477.89 80.62 492.41 97.39 492.97 C 97.90 451.70 97.51 410.43 97.53 369.15 C 80.48 369.82 65.20 384.87 64.82 402.02 Z" />
<path fill="${t2}" opacity="1.00" d=" M 693.26 87.27 C 702.04 83.90 712.35 91.91 712.17 101.09 C 712.56 142.41 712.32 183.72 712.34 225.04 C 712.34 230.51 712.78 236.62 709.30 241.25 C 704.32 248.28 692.37 249.08 687.09 241.99 C 683.01 237.33 683.62 230.75 683.50 224.99 C 683.69 184.01 683.45 143.02 683.54 102.04 C 683.43 95.74 687.30 89.52 693.26 87.27 Z" />
<path fill="${t2}" opacity="1.00" d=" M 744.33 117.51 C 750.30 114.95 757.15 118.42 760.63 123.43 C 763.95 127.94 763.10 133.83 763.27 139.08 C 762.92 162.04 763.71 185.01 763.08 207.97 C 762.86 215.82 754.87 222.66 747.06 221.29 C 740.09 219.92 735.27 212.94 735.33 206.03 C 735.47 180.65 735.19 155.28 735.45 129.90 C 735.47 124.43 739.40 119.56 744.33 117.51 Z" />
<path fill="${t2}" opacity="1.00" d=" M 642.52 128.70 C 649.83 126.57 658.67 132.14 659.09 139.94 C 659.85 158.62 659.40 177.32 659.36 196.00 C 659.30 204.50 649.12 210.86 641.44 207.30 C 636.77 205.02 632.66 200.44 632.76 194.98 C 632.49 176.98 632.48 158.98 632.75 140.97 C 632.55 135.19 637.20 130.28 642.52 128.70 Z" />
<path fill="${t2}" opacity="1.00" d=" M 795.36 142.71 C 803.30 139.81 813.73 146.10 813.29 154.96 C 813.11 164.95 813.88 175.00 812.57 184.95 C 811.30 191.44 804.31 195.44 798.01 194.98 C 792.93 194.82 787.87 191.31 786.84 186.18 C 784.70 176.93 786.02 167.39 785.64 158.00 C 785.24 151.50 789.09 144.87 795.36 142.71 Z" />
<path fill="${t2}" opacity="1.00" d=" M 633.89 354.09 C 641.27 351.43 648.22 347.49 655.94 345.84 C 677.84 355.88 693.08 378.93 693.55 403.03 C 693.72 416.04 693.68 429.05 693.63 442.06 C 693.60 446.35 693.76 450.65 693.22 454.92 C 691.38 471.03 683.13 486.33 670.59 496.64 C 658.59 506.79 643.21 512.95 627.46 513.50 C 624.28 526.51 619.27 539.19 611.78 550.34 C 600.63 549.16 591.37 541.86 584.42 533.51 C 592.40 519.40 597.22 503.31 596.83 487.02 C 596.80 447.44 596.69 407.86 596.80 368.28 C 608.93 362.94 621.56 358.89 633.89 354.09 M 629.68 372.57 C 629.35 408.06 629.33 443.54 629.62 479.03 C 640.71 477.31 651.74 471.24 656.91 460.93 C 663.06 449.59 660.69 436.31 660.92 423.99 C 660.75 412.56 662.71 399.97 656.18 389.81 C 650.65 380.19 639.95 375.35 629.68 372.57 Z" />
</g>
</svg>`;

    const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();

    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mülakat Daveti</title>
</head>
<body style="margin: 0; padding: 40px 0; background-color: #f4f4f5; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center">
        <table width="1000" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d0d12; max-width: 1000px; width: 100%; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
          <tr>
            <td>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 24px 24px 12px 24px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    
                    <div style="text-align: center; margin-bottom: 0; padding-left: 44px;">
                      <img src="cid:logo@blindhire.ai" width="216" height="154" alt="BlindHire.ai" style="display: inline-block; border: 0; outline: none; text-decoration: none; pointer-events: none; -webkit-user-select: none; user-select: none;" />
                    </div>

                    <table border="0" cellspacing="0" cellpadding="0" align="center">
                      <tr>
                        <td align="center">
                          <h1 style="margin: 0; font-size: 40px; font-weight: 900; letter-spacing: -1px;">
                            <span style="color: ${t1};">BlindHire</span><span style="color: ${t2};">.ai</span>
                          </h1>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 4px 0 0 0; color: ${t2}; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      Otonom İşe Alım Sistemi
                    </p>
                  </td>
                </tr>
                
                <!-- Body Content -->
                <tr>
                  <td style="padding: 24px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <!-- Gradient Greeting Text -->
                    <h2 style="margin: 0 0 16px 0; font-size: 26px; font-weight: 700; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                       <span style="color: ${t1};">Merhaba </span><span style="color: ${t2};">${candidateName},</span>
                    </h2>
                    
                    <p style="margin: 0 0 16px 0; font-size: 17px; line-height: 1.8; color: #a1a1aa; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      <strong style="color: #ffffff;">${companyName || "Şirketimiz"}</strong> bünyesinde yapmış olduğunuz kariyer başvurunuz titizlikle incelenmiş ve yetkinlikleriniz mülakat aşaması için uygun bulunmuştur.
                    </p>
                    
                    <p style="margin: 0 0 24px 0; font-size: 17px; line-height: 1.8; color: #a1a1aa; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      Değerlendirme sürecinizin bir sonraki adımı olarak sizi yapay zeka destekli otonom mülakat platformumuza davet ediyoruz.
                    </p>

                    <!-- Credentials Card -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #121214; border: 1px solid #27272a; border-radius: 16px; overflow: hidden;">
                      <tr>
                        <td style="padding: 24px; text-align: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                          
                          <!-- Access Code -->
                          <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: ${t2}; text-transform: uppercase; letter-spacing: 2px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            Tek Kullanımlık Erişim Kodunuz
                          </p>
                          <!-- Forced width for password box to stretch it -->
                          <table width="380" border="0" cellspacing="0" cellpadding="0" align="center" style="margin-bottom: 24px;">
                            <tr>
                              <td align="center" style="background-color: #000000; padding: 20px 20px; border-radius: 12px; border: 1px solid #27272a; border-bottom: 2px solid ${t2}; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                <span style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #ffffff;">
                                  ${interviewPassword}
                                </span>
                              </td>
                            </tr>
                          </table>

                          <!-- Button -->
                          <table border="0" cellspacing="0" cellpadding="0" align="center">
                            <tr>
                              <td align="center" style="background: linear-gradient(135deg, ${t1}, ${t2}); border-radius: 10px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                <a href="${interviewLink}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 19px; font-weight: 800; color: #000000; text-decoration: none; border-radius: 10px; letter-spacing: 0.5px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                  Mülakata Giriş Yap
                                </a>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 20px 0 0 0; font-size: 16px; color: #71717a; word-break: break-all; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            Buton çalışmazsa aşağıdaki bağlantıyı tarayıcınıza yapıştırın:<br><br>
                            <a href="${interviewLink}" style="color: ${t1}; font-size: 19px; font-weight: 700; text-decoration: none; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${interviewLink}</a>
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Hardware Note -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 24px; background-color: #09090b; border-left: 4px solid ${t2}; border-radius: 8px;">
                      <tr>
                        <td style="padding: 12px 16px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                          <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #a1a1aa; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            <strong style="color: #ffffff;">Gereksinimler:</strong> Mülakat esnasında kamera ve mikrofon erişimine izin vermeniz zorunludur. Kesintisiz bir internet bağlantısı ile sessiz bir ortamda bulunmanızı önemle rica ederiz.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr><td height="40"></td></tr>
              </table>

            </td>
          </tr>
        </table>
        
        <!-- Prevent Gmail Clipping -->
        <div style="display: none; white-space: nowrap; font: 15px courier; line-height: 0;">
          &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 
          &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 
          &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;
          ID: ${Date.now()}-${Math.random()}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const userEmail = process.env.SMTP_EMAIL;
    const userPass = process.env.SMTP_PASSWORD;

    if (!userEmail || !userPass || userEmail === "example@gmail.com") {
      console.log(`[MOCK EMAIL] Sent to ${email} for candidate ${candidateName}. Link: ${interviewLink}, Password: ${interviewPassword}`);
      return NextResponse.json({ message: "E-posta başarıyla gönderildi (MOCK MODU)." });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // 587 portu için false (STARTTLS) kullanılır
      auth: {
        user: userEmail,
        pass: userPass,
      },
      family: 4, // Render'ın IPv6 kısıtlamasını aşarak IPv4 üzerinden bağlanmasını sağlar
    } as any);

    const mailOptions: any = {
      from: `"BlindHire Kariyer" <${userEmail}>`,
      to: email,
      subject: `Kariyer Fırsatı: Mülakat Daveti - ${companyName || "Şirket"}`,
      html: htmlContent,
      attachments: [{
        filename: 'logo.png',
        content: pngBuffer,
        cid: 'logo@blindhire.ai',
        contentDisposition: 'inline',
        contentType: 'image/png'
      }]
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: "E-posta başarıyla gönderildi." });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ message: "E-posta gönderimi başarısız oldu.", error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}