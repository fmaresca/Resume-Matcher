/**
 * ATS Keyword Coverage Scoring & Gap Analysis Engine
 * Evaluates master resume text against job description & selected profile competencies.
 */

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
  "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
  "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
  "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
  "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
  "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
  "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
  "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
  "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
  "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what",
  "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
  "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd",
  "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
  "will", "shall", "must", "may", "might", "can", "etc", "experience", "role",
  "work", "skills", "job", "candidate", "company", "team", "years", "requirements",
  "preferred", "required", "responsible", "duties", "ability", "strong", "proven"
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function extractKeywordsFromJD(text) {
  if (!text) return [];
  const words = tokenize(text);
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Sort by frequency and take top candidates
  const sorted = Object.entries(freq)
    .filter(([_, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  return sorted.slice(0, 30);
}

export function scoreResume(resumeText, jobDescription, profile) {
  if (!resumeText || !jobDescription) {
    return {
      score: 0,
      matchedKeywords: [],
      missingKeywords: [],
      matchedCompetencies: [],
      missingCompetencies: [],
      verbMatches: [],
      summary: "Add your resume and target job description to compute ATS compatibility.",
    };
  }

  const resumeLower = resumeText.toLowerCase();
  const jdKeywords = extractKeywordsFromJD(jobDescription);

  // 1. Evaluate Profile Core Competencies
  const competencies = profile?.coreCompetencies || [];
  const matchedCompetencies = [];
  const missingCompetencies = [];

  for (const comp of competencies) {
    const compLower = comp.toLowerCase();
    // Check full phrase or essential parts
    const words = compLower.split(/\s+/);
    const hasPhrase = resumeLower.includes(compLower);
    const hasAllWords = words.every((w) => resumeLower.includes(w));

    if (hasPhrase || (words.length > 1 && hasAllWords)) {
      matchedCompetencies.push(comp);
    } else {
      missingCompetencies.push(comp);
    }
  }

  // 2. Evaluate General Job Description Keywords
  const matchedKeywords = [];
  const missingKeywords = [];

  for (const kw of jdKeywords) {
    if (resumeLower.includes(kw)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  // 3. Evaluate Action Verbs
  const actionVerbs = profile?.actionVerbs || [];
  const verbMatches = actionVerbs.filter((verb) =>
    resumeLower.includes(verb.toLowerCase())
  );

  // 4. Compute Weighted Score (0 - 100)
  const compScore = competencies.length
    ? (matchedCompetencies.length / competencies.length) * 100
    : 70;
  const kwScore = jdKeywords.length
    ? (matchedKeywords.length / jdKeywords.length) * 100
    : 70;
  const verbScore = actionVerbs.length
    ? (verbMatches.length / actionVerbs.length) * 100
    : 50;

  // Weighted formula: 45% Competencies, 40% JD Keywords, 15% Action Verbs
  const rawScore = compScore * 0.45 + kwScore * 0.40 + verbScore * 0.15;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let summary = "";
  if (score >= 80) {
    summary = "Excellent match! Your resume incorporates high-relevancy keywords and strong alignment.";
  } else if (score >= 60) {
    summary = "Solid foundation with moderate keyword alignment. Review the missing target keywords to boost ATS pass-rate.";
  } else {
    summary = "Low ATS compatibility. Your resume is missing key industry competencies and vocabulary found in the job description.";
  }

  return {
    score,
    compScore: Math.round(compScore),
    kwScore: Math.round(kwScore),
    verbScore: Math.round(verbScore),
    matchedKeywords: matchedKeywords.slice(0, 15),
    missingKeywords: missingKeywords.slice(0, 15),
    matchedCompetencies,
    missingCompetencies,
    verbMatches,
    summary,
  };
}
