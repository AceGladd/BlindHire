import fs from "fs";
import path from "path";

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9\s+#.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter((t) => t.length > 1);
}

export const STOP_WORDS = new Set([
  "olarak", "olmak", "sahip", "olan", "için", "gibi", "kadar", "veya", "ilgili", 
  "konusunda", "deneyimi", "geliştirme", "tercihen", "derecede", "kullanarak", 
  "üzerinde", "hakkında", "iyi", "çok", "ile", "bir", "az", "yıl", "en", "da", 
  "de", "ve", "alanında", "yetenek", "bilgi", "tecrübe", "şirket", "rol", 
  "genel", "bakış", "detaylı", "görev", "tanım", "sorumluluk", "aktif", "iş", 
  "çalışma", "ekip", "takım", "başvuru", "aday", "süreç", "önemli", "gerekli", 
  "beklenen", "tercih", "neden", "kapsamında", "yer", "alacak", "uyum", 
  "sağlayacak", "katkı", "yapacak", "yapabilen", "eden", "edebilen", "büyük", 
  "yüksek", "güçlü", "ileri", "düzey", "teknik", "sosyal", "kültür", "uygun"
]);

export const domainDictMap = new Map<string, number>();

function loadDomainDictionary() {
  try {
    const possiblePaths = [
      path.join(process.cwd(), 'domain-dictionary.json'),
      path.join(process.cwd(), 'frontend', 'domain-dictionary.json'),
      path.join(__dirname, '..', 'domain-dictionary.json'),
    ];

    for (const dictPath of possiblePaths) {
      if (fs.existsSync(dictPath)) {
        const rawDict = fs.readFileSync(dictPath, 'utf8');
        const parsed = JSON.parse(rawDict);
        if (parsed && parsed.fields) {
          for (const fieldName of Object.keys(parsed.fields)) {
            const fieldData = parsed.fields[fieldName];
            if (fieldData && Array.isArray(fieldData.terms)) {
              for (const termObj of fieldData.terms) {
                if (termObj.term && typeof termObj.weight === 'number') {
                  const normTerm = normalizeText(termObj.term);
                  const existingWeight = domainDictMap.get(normTerm) || 0;
                  if (termObj.weight > existingWeight) {
                    domainDictMap.set(normTerm, termObj.weight);
                  }
                }
              }
            }
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error('Failed to load domain-dictionary.json:', err);
  }
}

loadDomainDictionary();

export function extractRequirements(description: string): string[] {
  const cleanDescription = description.replace(/<[^>]*>?/gm, ' ');
  const normalizedDesc = normalizeText(cleanDescription);
  
  const techTerms = new Set<string>();
  
  // Cross-reference the normalized job description text against the domain dictionary
  for (const term of domainDictMap.keys()) {
    const paddedDesc = ` ${normalizedDesc} `;
    if (paddedDesc.includes(` ${term} `) || normalizedDesc.includes(term)) {
      techTerms.add(term);
    }
  }

  // Fallback: If dictionary matching yields fewer than 4 terms, parse significant terms directly
  if (techTerms.size < 4) {
    const tokens = cleanDescription.split(/\s+/);
    for (const rawToken of tokens) {
      const cleanToken = normalizeText(rawToken);
      if (
        cleanToken.length > 2 &&
        !STOP_WORDS.has(cleanToken) &&
        !/^\d+$/.test(cleanToken)
      ) {
        techTerms.add(cleanToken);
      }
    }
  }

  const reqsArray = Array.from(techTerms);
  reqsArray.sort((a, b) => (domainDictMap.get(b) || 0) - (domainDictMap.get(a) || 0));

  return reqsArray;
}

export const IT_SYNONYMS: Record<string, string[]> = {
  "yazilim": ["software", "development", "dev"],
  "gelistir": ["developer", "engineer", "programmer", "develop"],
  "muhendis": ["engineer", "engineering"],
  "veritaban": ["database", "db"],
  "ag": ["network", "networking"], 
  "bulut": ["cloud"],
  "guvenli": ["security", "sec", "cybersecurity", "cyber"],
  "siber": ["cyber"],
  "sistem": ["system", "systems"],
  "mimari": ["architecture", "architect", "design"],
  "veri": ["data"],
  "uygulama": ["application", "app", "apps"],
  "arayuz": ["interface", "ui", "frontend"],
  "sunucu": ["server", "backend"],
  "donanim": ["hardware"],
  "cozum": ["solution", "solutions"],
  "yonetim": ["management", "admin", "administration", "manager"],
  "test": ["testing", "qa", "test"],
  "kod": ["code", "coding"],
  "performans": ["performance"],
  "optimizasyon": ["optimization", "tuning", "optimize"],
  "mikroservis": ["microservice", "microservices"],
  "entegras": ["integration", "integrate"],
  "dagitim": ["deployment", "delivery", "deploy"],
  "log": ["logging", "logs", "log"],
  "izlem": ["monitoring", "monitor"],
  "sema": ["schema", "schemas"],
  "kuyruk": ["queue", "queues"],
  "onbellek": ["cache", "caching"],
  "hata": ["error", "bug", "fault", "debug"],
  "yerel": ["local"],
  "surum": ["version", "versioning"],
  "kalite": ["quality", "qa"],
  "analiz": ["analysis", "analytics", "analyzer"],
  "yapay": ["artificial"],
  "zeka": ["intelligence", "ai"],
  "makin": ["machine", "ml"],
  "ogrenm": ["learning", "ml"],
  "sistem tasarimi": ["system design", "systems design"],
  "sema tasarimi": ["schema design", "schemas design"],
  "ci cd": ["ci/cd", "ci-cd"]
};

export function getTermWeight(term: string): number {
  const w = domainDictMap.get(normalizeText(term));
  return w !== undefined ? w : 3;
}