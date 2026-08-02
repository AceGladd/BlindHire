import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function parsePDF(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text || "";
}

import { extractRequirements } from "@/lib/ats";

async function groqDeepAnalysis(
  cvText: string,
  requirements: string[],
  jobTitle: string,
  jobDescription: string
) {
  const Groq = (await import("groq-sdk")).default;
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const truncatedCV = cvText.substring(0, 10000);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content: `You are an elite Technical Recruiter and ATS AI evaluator with 15+ years of experience in software engineering hiring. Your core directive is to deeply analyze technical fit, engineering impact, and role alignment, avoiding superficial keyword matching. Calibrate your expectations dynamically based on the inferred seniority of the Job Posting.

CRITICAL RULE 1: STRICT TRANSLATION IMMUNITY (ZERO LANGUAGE BIAS)
You will receive CVs in Turkish or English. You MUST evaluate purely on technical merit, architectural understanding, and project impact. Ignore grammatical quirks, sentence structure, or translation artifacts. 
- A Turkish CV and its exact English translation MUST yield the EXACT SAME numerical score in every category.
- If a candidate's English CV has slightly poorer grammar or shorter phrasing than the Turkish version, DO NOT penalize them. Evaluate the underlying facts.

CRITICAL RULE 2: DETERMINISTIC CATEGORY RULES
To prevent arbitrary point deductions, you MUST adhere to these strict baselines:
- EDUCATION (0-15): If the candidate has a completed/ongoing degree in an IT/Engineering field, the score MUST NOT drop below 8 points, regardless of language.
- FORMAT (0-15): If the CV has basic recognizable sections (Experience, Education, Skills), the score MUST NOT drop below 9 points, regardless of language.
- SOCIAL (0-15): Count the factual presence of clubs/hobbies/open-source. A fact is a fact in any language.

CRITICAL RULE 3: DEEP EVALUATION & SCORING (0-100 TOTAL)
Score the CV across the 5 categories below. For each category, provide EXACTLY ONE concise, highly analytical sentence of reasoning that proves you read the context, followed by the score.

1. Education & Academic (0-15 pts): Evaluate degree relevance and coursework. Ignore university prestige entirely.
2. Technical Depth (0-40 pts): This is the most critical metric. Do not reward mere lists of tools. Reward candidates who explain WHAT they built, HOW they architected it, and the IMPACT (e.g., "Used Node.js for microservices" scores much higher than just listing "Node.js").
3. Social & Collaboration (0-15 pts): Open-source contributions, hackathons, tech clubs, mentoring, and team-based development.
4. Vision & Role Alignment (0-15 pts): Does the candidate's career trajectory and core domain deeply match the specific role?
5. Format & ATS Compliance (0-15 pts): Logical structure, readability, and clear professional presentation.

CRITICAL RULE 3: FIELD MISMATCH & THE 45-POINT HARD CEILING
Analyze the candidate's PRIMARY specialization against the JOB POSTING's primary requirement. 
Example: A highly skilled Cybersecurity/AppSec expert applying for a strict Backend Web Developer role is a MISMATCH.
If you detect a genuine field mismatch, you MUST set "fieldMismatch": true and enforce this HARD CEILING to prevent the candidate from passing the screening:
- Technical Depth (Category 2) MUST be capped at a maximum of 15 points.
- Vision Alignment (Category 4) MUST be capped at a maximum of 3 points.
- The TOTAL SUM of all 5 categories MUST NOT exceed 45 points, regardless of their other achievements.

OUTPUT FORMAT RESTRICTION (JSON ONLY)
Keep the output strictly to this JSON schema. Keep "strengths" and "weaknesses" to a maximum of 3 items each (max 10 words per item).
{
  "education": { "score": 0, "reasoning": "..." },
  "technicalDepth": { "score": 0, "reasoning": "..." },
  "socialSkills": { "score": 0, "reasoning": "..." },
  "visionAlignment": { "score": 0, "reasoning": "..." },
  "formatCompliance": { "score": 0, "reasoning": "..." },
  "fieldMismatch": false,
  "strengths": ["...", "...", "..."],
  "weaknesses": ["...", "...", "..."]
}
`
      },
      {
        role: "user",
        content: `JOB POSTING:\nTitle: ${jobTitle}\nRequired skills: ${requirements.join(", ")}\nFull description: ${jobDescription}\n\n---\nCANDIDATE CV (raw text):\n${truncatedCV}\n\n---\nEvaluate this CV against this job posting following the 5-category scoring system. Return only the JSON object.`
      },
    ],
    response_format: { type: "json_object" },
  });

  let raw = completion.choices[0]?.message?.content || "{}";
  raw = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Groq JSON Parse error", err, raw);
  }

  const edScore = parsed.education?.score || 0;
  let techScore = parsed.technicalDepth?.score || 0;
  const socScore = parsed.socialSkills?.score || 0;
  let visScore = parsed.visionAlignment?.score || 0;
  const fmtScore = parsed.formatCompliance?.score || 0;

  const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];
    
  // Enforce Hard Ceiling in code
  const hasStructuredMismatch = parsed.fieldMismatch === true;
  const mismatchKeywords = ["mismatch", "uyuşmaz", "uyumsuz", "farklı alan", "örtüşm", "alakasız", "başka bir alan"];
  const hasTextMismatch = weaknesses.some((w: string) => {
    const lowerW = w.toLowerCase();
    return mismatchKeywords.some(keyword => lowerW.includes(keyword));
  });
  
  let isMismatch = hasStructuredMismatch || hasTextMismatch;
  
  if (isMismatch) {
    techScore = Math.min(techScore, 15);
    visScore = Math.min(visScore, 3);
  }

  let manualFinalScore = edScore + techScore + socScore + visScore + fmtScore;

  if (isMismatch && manualFinalScore > 45) {
    manualFinalScore = 45;
  }

  return {
    finalScore: manualFinalScore,
    scores: {
      education: edScore,
      technicalDepth: techScore,
      socialSkills: socScore,
      visionAlignment: visScore,
      formatCompliance: fmtScore
    },
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get("user_id")?.value;
    if (!userId) {
      return NextResponse.json({ message: "Oturum açılmamış." }, { status: 401 });
    }

    const { applicationId } = await request.json();
    if (!applicationId) {
      return NextResponse.json({ message: "Geçersiz başvuru ID." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: "Yetkisiz erişim." }, { status: 403 });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { jobPosting: true }
    });
    if (!application) return NextResponse.json({ message: "Başvuru bulunamadı." }, { status: 404 });

    const isHr = user.role === "HR" && user.companyId === application.jobPosting.companyId;
    const isOwner = application.candidateId === userId;

    if (!isHr && !isOwner) {
      return NextResponse.json({ message: "Yetkisiz erişim." }, { status: 403 });
    }

    // Removed duplicate application fetch and hrUser check

    if (!application.cvUrl) {
      return NextResponse.json({ message: "Adayın CV'si bulunamadı." }, { status: 400 });
    }

    // 1. Fetch or Read CV PDF
    let buffer: Buffer;
    
    if (application.cvUrl.startsWith("/")) {
      // Local file in public folder
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "public", application.cvUrl);
      if (!fs.existsSync(filePath)) {
        throw new Error("CV dosyası sunucuda bulunamadı.");
      }
      buffer = fs.readFileSync(filePath);
    } else {
      // External URL
      const pdfResponse = await fetch(application.cvUrl);
      if (!pdfResponse.ok) {
        throw new Error("CV dosyası indirilemedi.");
      }
      const arrayBuffer = await pdfResponse.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // 2. Parse PDF
    const cvText = await parsePDF(buffer);

    // 3. Prepare Requirements
    const reqs = extractRequirements(application.jobPosting.description);

    // 4. Call Groq
    const aiResult = await groqDeepAnalysis(cvText, reqs, application.jobPosting.title, application.jobPosting.description);

    // 5. Fetch Stage 2 thresholds from company settings (use generated client name hRSettings)
    // Replace older prisma.companySettings usages which may be undefined
    const companySettings = await (prisma as any).hRSettings?.findUnique
      ? (prisma as any).hRSettings.findUnique({ where: { companyId: application.jobPosting.companyId } })
      : null;
    const s2Reject = companySettings?.stage2AutoRejectThreshold ?? 60;

    // 6. Update Application
    // 5. Fetch Stage 2 thresholds from company settings
    let companySettings: any = null;
    try {
      if ((prisma as any).companySettings && (prisma as any).companySettings.findUnique) {
        companySettings = await (prisma as any).companySettings.findUnique({ where: { companyId: application.jobPosting.companyId } });
      } else if ((prisma as any).hRSettings && (prisma as any).hRSettings.findUnique) {
        companySettings = await (prisma as any).hRSettings.findUnique({ where: { companyId: application.jobPosting.companyId } });
      }
    } catch (e) {
      console.error('Error fetching company settings:', e);
    }

    const s2Reject = companySettings?.stage2AutoRejectThreshold ?? 60;
    const s2Invite = companySettings?.stage2AutoInviteThreshold ?? 75;

    // 6. Decide status based on LLM score vs thresholds
    let newStatus: string;
    let decisionMessage: string;

    if (aiResult.finalScore < s2Reject) {
      // Score below reject threshold → auto reject
      newStatus = "REJECTED";
      decisionMessage = `LLM puanı (${aiResult.finalScore}) ret barajının (${s2Reject}) altında. Otomatik reddedildi.`;
    } else if (aiResult.finalScore >= s2Invite) {
      // Score above invite threshold → auto invite to interview
      newStatus = "INTERVIEW_INVITED";
      decisionMessage = `LLM puanı (${aiResult.finalScore}) davet barajının (${s2Invite}) üstünde. Mülakata davet edildi.`;
    } else {
      // Score between thresholds → manual IK review
      newStatus = "LLM_REVIEW";
      decisionMessage = `LLM puanı (${aiResult.finalScore}) İK inceleme aralığında (${s2Reject}-${s2Invite}). Manuel incelemeye alındı.`;
    }

    // 7. Update Application
    await prisma.application.updateMany({
      where: { id: applicationId },
      data: {
        reliability: aiResult.finalScore,
        status: "LLM_REVIEW", // Move to Stage 2
        // Optionally store the threshold used for auditing (not modifying other logic)
        status: newStatus
      }
    });

    return NextResponse.json({ success: true, message: decisionMessage, score: aiResult.finalScore, status: newStatus });
  } catch (error: any) {
    console.error("Trigger LLM Error:", error);
    return NextResponse.json({ message: error.message || "Sunucu hatası." }, { status: 500 });
  }
}
