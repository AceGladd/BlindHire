import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

// ─── Reusable PDF parsing + scoring functions (inlined to avoid import issues) ──
import { normalizeText, tokenize, STOP_WORDS, IT_SYNONYMS, domainDictMap, getTermWeight, extractRequirements } from "@/lib/ats";

function computeLocalATSScore(
  cvTokens: string[],
  cvText: string,
  requirements: string[],
  jobTitle: string
): { score: number; matched: string[]; missed: string[] } {
  const reqWords = requirements
    .map(w => normalizeText(w))
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
    
  const reqSet = new Set(reqWords);
  const cvSet = new Set(cvTokens);
  
  const matched: string[] = [];
  const missed: string[] = [];
  const cvArray = Array.from(cvSet);
  const normalizedCvText = normalizeText(cvText);
  const paddedCvText = ` ${normalizedCvText} `;

  for (const word of reqSet) {
    let found = false;
    if (word.includes(" ")) {
      if (paddedCvText.includes(` ${word} `)) {
        found = true;
      }
    } else {
      if (cvSet.has(word)) found = true;
    }

    if (!found) {
      for (const [trRoot, enSynonyms] of Object.entries(IT_SYNONYMS)) {
        const matchesRoot = (trRoot === "ag") 
          ? (word === "ag" || word.startsWith("aglar") || word.startsWith("agi"))
          : (trRoot === word || (word.startsWith(trRoot) && !word.includes(" ")));
          
        if (matchesRoot) {
          for (const syn of enSynonyms) {
            if (syn.includes(" ")) {
              if (paddedCvText.includes(` ${syn} `)) {
                found = true;
                break;
              }
            } else {
              if (cvSet.has(syn) || cvArray.some(cvToken => cvToken.startsWith(syn))) {
                found = true;
                break;
              }
            }
          }
        }
        if (found) break;
      }
    }
    if (found) matched.push(word);
    else missed.push(word);
  }

  // 0. CORE JOB TITLE GATE (Strict Filtering)
  const titleWords = normalizeText(jobTitle)
    .split(/\s+/)
    .filter(w => 
      w.length > 2 && 
      !STOP_WORDS.has(w) && 
      !["kidemli", "uzman", "senior", "junior", "gelistirici", "muhendis", "developer", "engineer", "analist", "analyst", "stajyer", "ve", "icin", "ile"].includes(w)
    );
    
  let hasCoreTitleSkill = false;
  if (titleWords.length > 0) {
    for (const tw of titleWords) {
      if (cvSet.has(tw) || cvArray.some(ct => ct.includes(tw))) {
        hasCoreTitleSkill = true;
        break;
      }
    }
  } else {
    hasCoreTitleSkill = true; // Fallback if title is empty or generic
  }

  // 1. Technical Score (Max 70 points) - Ağırlıklı Hesaplama (Weighted Domain Dictionary)
  const maxKeywordsList = Array.from(reqSet).slice(0, 25); // Limit the required terms considered
  let totalRequiredWeight = 0;
  let totalMatchedWeight = 0;
  const matchedSet = new Set(matched);

  for (const reqTerm of maxKeywordsList) {
    const weight = getTermWeight(reqTerm);
    totalRequiredWeight += weight;
    if (matchedSet.has(reqTerm)) {
      totalMatchedWeight += weight;
    }
  }

  let techScore = totalRequiredWeight > 0 ? (totalMatchedWeight / totalRequiredWeight) * 70 : 0;
  if (techScore > 70) techScore = 70;

  // 2. Experience Match (Max 10 points)
  let expScore = 0;
  const lowerText = cvText.toLowerCase();
  const expRegex = /(\d+)\+?\s*(yıl|year|years)/g;
  let maxYears = 0;
  let match;
  while ((match = expRegex.exec(lowerText)) !== null) {
    const y = parseInt(match[1]);
    if (y > maxYears) maxYears = y;
  }
  
  if (maxYears >= 5) expScore = 10;
  else if (maxYears >= 2) expScore = 7;
  else if (lowerText.includes("deneyim") || lowerText.includes("experience") || lowerText.includes("staj") || lowerText.includes("intern") || lowerText.includes("work")) expScore = 3;

  // 3. Education & Projects (Max 10 points)
  let eduProjScore = 0;
  if (lowerText.includes("üniversite") || lowerText.includes("university") || lowerText.includes("lisans") || lowerText.includes("bachelor") || lowerText.includes("mezun")) {
    eduProjScore += 5;
  }
  if (lowerText.includes("proje") || lowerText.includes("project") || lowerText.includes("github") || lowerText.includes("portfolio")) {
    eduProjScore += 5;
  }

  // 4. Formatting, Length & Language (Max 10 points)
  let formatScore = 0;
  
  const wordCount = cvTokens.length;
  if (wordCount >= 150 && wordCount <= 1000) {
    formatScore += 7;
  } else if (wordCount > 1000 && wordCount <= 1500) {
    formatScore += 4;
  } else if (wordCount > 1500) {
    formatScore -= 3;
  }

  // formatScore deductions for specific section titles (Education, Skills) 
  // have been completely removed to avoid penalizing valid CVs that don't explicitly use those exact words.
  // Deneyim kısmı da zaten zorunlu değildi (Junior/Stajyer koruması)

  let finalScore = techScore + expScore + eduProjScore + formatScore;
  
  // Eğer teknik kelime eşleşmesi çok düşükse (Tech score < 15) bu CV büyük ihtimalle alakasızdır.
  // Ekstra -5 puan ceza uygulayalım ki alakasızlık iyice belirginleşsin.
  if (techScore < 15) {
      finalScore -= 5;
  }

  finalScore = Math.round(finalScore);
  if (finalScore < 0) finalScore = 0;
  if (finalScore > 100) finalScore = 100;

  return { score: finalScore, matched, missed };
}

async function groqDeepAnalysis(
  cvText: string,
  requirements: string[],
  jobTitle: string,
  jobDescription: string
): Promise<{
  finalScore: number;
  scores: any;
  strengths: string[];
  weaknesses: string[];
  verdict: "PASSED" | "REJECTED";
}> {
  const Groq = (await import("groq-sdk")).default;
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const truncatedCV = cvText.substring(0, 8000);

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.1,
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are an expert technical recruiter and applicant-tracking specialist with 15+ years of experience screening CVs for software/tech roles. You evaluate CVs the way a rigorous, fair, and consistent hiring committee would: evidence-based, skeptical of buzzwords, and calibrated so that an average candidate scores in the 40-60 range, not 80+.

You will be given a JOB POSTING (title, description, required skills) and a CANDIDATE CV (raw text).

FIRST, dynamically infer the required SENIORITY LEVEL (e.g., Intern, Junior, Mid, Senior, Lead) from the JOB POSTING.
Calibrate your expectations accordingly! For an Intern/Junior, DO NOT penalize for lack of production-scale architecture; focus on academic projects, hackathons, and potential. For a Senior, demand deep architectural context.

Score the CV using EXACTLY the 5 categories below. For each category, you must:
(a) quote or paraphrase the specific evidence,
(b) explain why that evidence earns points based on the inferred seniority,
(c) output a numeric score.

CATEGORY 1 — Education & Academic Performance (0-15 pts)
Neutral, evidence-based signals only. Do NOT use university prestige as a standalone factor.
Consider degree relevance, GPA (if stated, don't penalize omission), coursework.
0-3: unrelated/incomplete. 4-8: related, minimal detail. 9-12: solid detail. 13-15: highly relevant, strong academic evidence.

CATEGORY 2 — Technical Depth (0-40 pts)
Award points ONLY when CV describes WHAT was built and HOW it was used.
0-10: mostly keyword list. 11-20: shallow/generic project context. 21-30: concrete projects with detail. 31-40: consistently deep, specific technical narratives. (Calibrate expectations based on inferred seniority).

CATEGORY 3 — Social & Collaborative Skills (0-15 pts)
Clubs, hackathons, open-source, mentoring, leadership.
0-3: no evidence. 4-8: minimal/vague mentions. 9-12: concrete examples. 13-15: strong examples.

CATEGORY 4 — Role & Vision Alignment (0-15 pts)
Compare candidate's "About Me" / stated goals against the Job Posting field.
Mismatch (e.g. backend job but cybersecurity profile): 0-3 pts (Flag as weakness!). Neutral/generic: 4-9 pts. Explicit alignment: 10-15 pts.

CATEGORY 5 — Format & ATS Compliance (0-15 pts)
0-3: unstructured, hard to parse, missing sections. 4-8: partially structured or overly verbose. 9-12: clear standard sections. 13-15: clean, fully ATS-compliant structure.

CROSS-CATEGORY CONSISTENCY CHECK (apply AFTER scoring all 5 categories individually)

Before finalizing your scores, check for a FIELD MISMATCH: does the candidate's core
technical background (their actual skills, projects, and work experience) belong to a
genuinely different specialization than the one required by the JOB POSTING?
*Compare the CV's PRIMARY technical stack against the posting's PRIMARY required stack.*

If you determine there IS a genuine field mismatch, you MUST enforce a HARD CEILING:
- Technical Depth (Category 2) MUST be capped at 15.
- Vision Alignment (Category 4) MUST be capped at 3.
- The TOTAL SUM of all 5 categories MUST NOT exceed 45.

EXAMPLE JSON OUTPUT FOR A FIELD MISMATCH (e.g. Cybersecurity applying to Backend):
{
  "education": { "score": 10, "reasoning": "Irrelevant degree but completed" },
  "technicalDepth": { "score": 10, "reasoning": "Strong in security, but no backend experience (Capped)" },
  "socialSkills": { "score": 12, "reasoning": "Active in cybersecurity clubs" },
  "visionAlignment": { "score": 2, "reasoning": "Wants to do AppSec, not backend (Capped)" },
  "formatCompliance": { "score": 10, "reasoning": "Well structured" },
  "strengths": ["..."],
  "weaknesses": ["MASSIVE FIELD MISMATCH: Candidate is AppSec, role is Backend", "..."],
  "recommendation": "Reject"
}

OUTPUT FORMAT: ONLY valid JSON, no markdown fences.
{
  "education": { "score": 0, "reasoning": "..." },
  "technicalDepth": { "score": 0, "reasoning": "..." },
  "socialSkills": { "score": 0, "reasoning": "..." },
  "visionAlignment": { "score": 0, "reasoning": "..." },
  "formatCompliance": { "score": 0, "reasoning": "..." },
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "recommendation": "Strong Match"
}`
      },
      {
        role: "user",
        content: `JOB POSTING:\nTitle: ${jobTitle}\nRequired skills: ${requirements.join(", ")}\nFull description: ${jobDescription}\n\n---\nCANDIDATE CV (raw text):\n${truncatedCV}\n\n---\nEvaluate this CV against this job posting following the 5-category scoring system. Return only the JSON object.`
      },
    ],
    response_format: { type: "json_object" },
  });

  let raw = completion.choices[0]?.message?.content || "{}";
  
  // Markdown clean up (just in case)
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
  const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];

  // Enforce Hard Ceiling in code if the LLM flagged a mismatch but failed to do the math
  let isMismatch = weaknesses.some((w: string) => w.toLowerCase().includes("mismatch"));
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
    verdict: manualFinalScore >= 75 ? "PASSED" : "REJECTED",
  };
}

async function parsePDF(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text || "";
}

// ─── MAIN APPLICATION ROUTE ─────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = request.cookies.get("auth_token")?.value;
    const role = request.cookies.get("user_role")?.value;

    if (token !== "authenticated" || role !== "CANDIDATE") {
      return NextResponse.json(
        { message: "Oturum açmanız gerekiyor." },
        { status: 401 }
      );
    }

    const userId = request.cookies.get("user_id")?.value;
    if (!userId) {
      return NextResponse.json(
        { message: "Geçersiz oturum." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const jobId = formData.get("jobId") as string;
    const file = formData.get("file") as File | null;

    if (!jobId || !file) {
      return NextResponse.json(
        { message: "Eksik parametre veya dosya." },
        { status: 400 }
      );
    }

    const candidate = await prisma.user.findUnique({
      where: { id: userId, role: "CANDIDATE" },
    });

    if (!candidate) {
      return NextResponse.json(
        { message: "Geçerli aday bulunamadı." },
        { status: 400 }
      );
    }

    const existingApplication = await prisma.application.findFirst({
      where: {
        candidateId: candidate.id,
        jobPostingId: jobId,
      },
    });

    if (existingApplication) {
      return NextResponse.json(
        { message: "Bu ilana zaten başvurdunuz." },
        { status: 400 }
      );
    }

    // ── Save the uploaded file ──
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, safeFilename);
    fs.writeFileSync(filePath, buffer);

    const cvUrl = `/uploads/${safeFilename}`;

    // ── Get job requirements from description ──
    const jobPosting = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    const hrSettings = await prisma.hRSettings.findFirst({
      where: { companyId: jobPosting?.companyId || undefined },
    });

    const s1Proceed = hrSettings?.stage1AutoProceedThreshold ?? 75;
    const s1Reject = hrSettings?.stage1AutoRejectThreshold ?? 50;
    const s2Invite = hrSettings?.stage2AutoInviteThreshold ?? 75;
    const s2Reject = hrSettings?.stage2AutoRejectThreshold ?? 60;

    const requirements = jobPosting
      ? extractRequirements(jobPosting.description)
      : [];

    // ── TWO-STAGE SCORING PIPELINE ──
    let techScore = 0;
    let reliability = 0;
    let aiAnalysis: {
      pipeline: string;
      strengths?: string[];
      weaknesses?: string[];
    } = { pipeline: "FALLBACK" };

    const isPDF =
      file.name.toLowerCase().endsWith(".pdf") && requirements.length > 0;

    if (isPDF) {
      try {
        // ── STAGE 1: Local keyword scoring (zero cost) ──
        const cvText = await parsePDF(buffer);

        if (cvText && cvText.trim().length > 20) {
          const cvTokens = tokenize(cvText);
          const stage1 = computeLocalATSScore(cvTokens, cvText, requirements, jobPosting?.title || "");

          console.log(
            `[APPLICATION] Stage 1 Score: ${stage1.score}/100 | Matched: ${stage1.matched.length}/${requirements.length}`
          );

          techScore = stage1.score;

          // ── DYNAMIC OPTIMIZATION GATE:
          // Infer seniority to adjust threshold optionally, but we primarily use HR settings now.
          const lowerJobTitle = (jobPosting?.title || "").toLowerCase();
          const isJunior = lowerJobTitle.includes("junior") || lowerJobTitle.includes("stajyer") || lowerJobTitle.includes("intern") || lowerJobTitle.includes("yeni mezun");
          const effectiveS1Proceed = isJunior ? Math.max(50, s1Proceed - 15) : s1Proceed;

          if (stage1.score >= effectiveS1Proceed && process.env.GROQ_API_KEY) {
            try {
              console.log(
                "[APPLICATION] Stage 1 passed threshold. Invoking Groq LLM..."
              );
              const stage2 = await groqDeepAnalysis(cvText, requirements, jobPosting?.title || "", jobPosting?.description || "");

              reliability = stage2.finalScore; // AI Semantic Score
              aiAnalysis = {
                pipeline: "STAGE_2_COMPLETE",
                strengths: stage2.strengths,
                weaknesses: stage2.weaknesses,
              };

              console.log(
                `[APPLICATION] Stage 2 Final Score: ${stage2.finalScore}/100 | Verdict: ${stage2.verdict}`
              );
            } catch (groqErr) {
              console.error(
                "[APPLICATION] Groq failed, keeping Stage 1 score:",
                groqErr
              );
              aiAnalysis = { pipeline: "STAGE_2_FALLBACK" };
            }
          } else {
            aiAnalysis = { pipeline: "STAGE_1_ONLY" };
          }
        }
      } catch (pdfErr) {
        console.error("[APPLICATION] PDF parse error:", pdfErr);
        aiAnalysis = { pipeline: "PDF_PARSE_FAILED" };
      }
    } else {
      aiAnalysis = { pipeline: "NO_PDF_OR_REQUIREMENTS" };
    }

    // ── Determine status based on HR settings ──
    let status = "PENDING";
    let finalInterviewId: string | undefined = undefined;
    let finalInterviewPassword: string | undefined = undefined;

    // Check Stage 2 results first
    if (aiAnalysis.pipeline === "STAGE_2_COMPLETE") {
      if (reliability >= s2Invite) {
        status = "INTERVIEW_INVITED";
      } else if (reliability < s2Reject) {
        status = "REJECTED";
      }
    } else {
      // If Stage 2 didn't run (or failed), fallback to Stage 1 checks
      if (techScore >= s1Proceed) {
        // Normally goes to Stage 2, but if API key is missing or it failed:
        status = "PENDING"; // Needs manual HR check
      } else if (techScore < s1Reject) {
        status = "REJECTED";
      }
    }

    if (status === "INTERVIEW_INVITED") {
     const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://blindhire-pcym.onrender.com";
      finalInterviewId = Math.random().toString(36).substring(2, 10);
      finalInterviewPassword = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      try {
        fetch(`${baseUrl}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: candidate.email,
            candidateName: candidate.fullName,
            interviewLink: `${baseUrl}/interview/${finalInterviewId}`,
            interviewPassword: finalInterviewPassword,
          }),
        }).catch((e) => console.error("Mail Error:", e));
      } catch (e) {
        console.error("Fetch API error:", e);
      }

      console.log(
        `[AI-AGENT] Aday ${candidate.fullName} mülakata davet edildi. Otomatik mülakat maili gönderiliyor...`
      );
    }

    const newApp = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobPostingId: jobId,
        cvUrl: cvUrl,
        techScore,
        reliability,
        status,
        interviewId: finalInterviewId,
        interviewPassword: finalInterviewPassword,
      },
    });

    return NextResponse.json(
      {
        message: "Başvurunuz alındı.",
        applicationId: newApp.id,
        status,
        techScore,
        reliability,
        aiPipeline: aiAnalysis.pipeline,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
