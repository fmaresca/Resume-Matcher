import {
  PREBUILT_PROFILES,
  getProfile,
  getCustomProfile,
  saveCustomProfile,
} from "./profiles.js";
import { parseDocument } from "./parser.js";
import { scoreResume } from "./scorer.js";
import { coach } from "./chat.js";

// Application State
const state = {
  resumeText: "",
  jobDescriptionText: "",
  selectedProfileId: "crisis_management",
  userApiKey: localStorage.getItem("resumewatcher_gemini_key") || "",
  activeTab: "bullets", // 'bullets', 'cover_letter', 'gap_analysis'
  isGenerating: false,
  generatedOutputs: {
    bullets: "",
    cover_letter: "",
    gap_analysis: "",
  },
  lastScoreData: null,
};

// Sample Datasets for Instant 1-Click Testing
const SAMPLE_RESUME = `ALEXA MORGAN
New York, NY | alexa.morgan@email.com | (555) 019-2834 | linkedin.com/in/alexa-morgan

PROFESSIONAL SUMMARY
Dynamic communications and operations strategist with 6+ years of experience in high-stakes stakeholder messaging, brand reputation, and team coordination. Proven track record managing complex communications, media monitoring, and operational alignment across corporate and healthcare environments.

CORE COMPETENCIES
Rapid Response Messaging, Reputation Management, Stakeholder Communication, Media Monitoring, Fact Checking, Press Release Drafting, Multidisciplinary Team Leadership, Client Relationship Management, Consultative Pitching.

PROFESSIONAL EXPERIENCE

Senior Communications & Account Specialist | Apex Media Group | 2022 - Present
- Formulated rapid response messaging and executive holding statements during 4 critical brand incidents, mitigating negative media pickup by 65%.
- Briefed C-suite executives prior to national press interviews and coordinated crisis simulation workshops for 40+ staff members.
- Secured Tier-1 media placements across national business publications, increasing client earned media visibility by 40%.
- Supervised a team of 4 junior coordinators, overseeing media lists, Cision coverage reports, and editorial outreach.

Operations & Outreach Coordinator | Metro Health & Wellness Network | 2019 - 2022
- Directed patient care communications and ensured strict HIPAA compliance across all outreach materials and digital touchpoints.
- Standardized crisis communication protocols and coordinated multidisciplinary team meetings between clinicians, department directors, and administrators.
- Managed client relationships and consultative onboarding for over 150 partner organizations, exceeding retention targets by 22%.

EDUCATION
B.A. in Communications & Media Studies | New York University, 2019`;

const SAMPLE_JDS = {
  crisis_management: `Role: Crisis Communications & Issues Management Specialist
Company: Vanguard Global Strategies
Location: New York, NY (Hybrid)

About the Role:
We are seeking a high-caliber Crisis Communications Specialist to safeguard corporate reputations and navigate sensitive public relations scenarios.

Key Responsibilities:
- Lead rapid response messaging and develop executive holding statements under extreme deadlines.
- Conduct reputation management audits and implement proactive media monitoring dashboards.
- Facilitate crisis simulation workshops and executive media prep sessions for Fortune 500 leadership.
- Protect brand resilience and coordinate scenario planning with legal, PR, and executive teams.
- Author precise fact-checking memos and counter false media narratives.

Requirements:
- 4+ years of hands-on experience in crisis communications, reputation management, or issues escalation.
- Proven track record formulating holding statements and briefing senior executives.
- Superior writing and editing abilities adhering strictly to AP Style.
- Familiarity with Cision, Muck Rack, and social listening platforms.`,

  wellness_clinical_director: `Role: Wellness Clinical Director
Company: Horizon Integrated Health & Wellness
Location: Remote / Flexible

About the Role:
Horizon is looking for an experienced Wellness Clinical Director to oversee clinical governance, multidisciplinary care delivery, and health program development.

Key Responsibilities:
- Direct comprehensive wellness protocols, ensuring full HIPAA and Joint Commission regulatory compliance.
- Lead and supervise multidisciplinary teams of clinicians, therapists, and wellness specialists.
- Revamp quality assurance procedures and clinical care workflows to drive measurable patient outcome improvements.
- Standardize evidence-based practice (EBP) guidelines and audit electronic health records (EHR) systems.
- Supervise crisis intervention protocols and risk assessment procedures across outpatient programs.

Requirements:
- Master's or Doctorate in Healthcare Administration, Nursing, Clinical Psychology, or related clinical field.
- 5+ years of clinical management and staff supervision experience.
- Deep expertise in clinical governance, accreditation standards, and HIPAA compliance.`,

  b2c_b2b_sales: `Role: Senior B2B & B2C Account Executive / Sales Associate
Company: Nexus Enterprise Growth Solutions
Location: Chicago, IL (Hybrid)

About the Role:
Nexus is hiring an ambitious Sales Executive to drive revenue acceleration across both enterprise B2B accounts and high-value consumer channels.

Key Responsibilities:
- Manage the entire sales pipeline and consultative sales cycle from outbound prospecting to deal closing.
- Execute cold outbound prospecting and qualify inbound leads with high velocity.
- Negotiate high-ticket contracts and overcome complex prospect objections.
- Maintain pristine CRM hygiene in Salesforce and forecast quarterly ARR/MRR attainment.
- Deliver compelling value proposition pitches tailored to executive buyers and key decision-makers.

Requirements:
- 3+ years in B2B or B2C consultative selling with documented quota attainment.
- Proven record exceeding sales targets and accelerating pipeline conversion.
- Mastery of modern sales tech stacks (Salesforce, HubSpot, Outreach, LinkedIn Sales Navigator).`,
};

// DOM Elements
const elements = {
  resumeInput: document.getElementById("resume-input"),
  fileUploadArea: document.getElementById("file-upload-area"),
  fileInput: document.getElementById("file-input"),
  fileNameBadge: document.getElementById("file-name-badge"),
  fileNameText: document.getElementById("file-name-text"),
  clearFileBtn: document.getElementById("clear-file-btn"),
  jdInput: document.getElementById("jd-input"),
  profileSelect: document.getElementById("profile-select"),
  profileDescription: document.getElementById("profile-description"),
  profileCategory: document.getElementById("profile-category"),
  customProfileSection: document.getElementById("custom-profile-section"),
  customNameInput: document.getElementById("custom-name"),
  customCompetenciesInput: document.getElementById("custom-competencies"),
  customVerbsInput: document.getElementById("custom-verbs"),
  customEmphasisInput: document.getElementById("custom-emphasis"),
  saveCustomProfileBtn: document.getElementById("save-custom-profile-btn"),
  // Gauge and Match Elements
  gaugeCircle: document.getElementById("gauge-circle"),
  gaugeContainer: document.getElementById("gauge-container"),
  scoreText: document.getElementById("score-text"),
  scoreSummary: document.getElementById("score-summary"),
  matchedKwContainer: document.getElementById("matched-keywords"),
  missingKwContainer: document.getElementById("missing-keywords"),
  matchedCompContainer: document.getElementById("matched-competencies"),
  missingCompContainer: document.getElementById("missing-competencies"),
  verbBadgeContainer: document.getElementById("verb-badges"),
  // Action Buttons
  btnBullets: document.getElementById("btn-gen-bullets"),
  btnCoverLetter: document.getElementById("btn-gen-cover-letter"),
  btnGapAnalysis: document.getElementById("btn-gen-gap"),
  // Tabs & Outputs
  tabBtns: document.querySelectorAll(".output-tab-btn"),
  outputContent: document.getElementById("output-content"),
  outputPlaceholder: document.getElementById("output-placeholder"),
  outputLoading: document.getElementById("output-loading"),
  loadingStatusText: document.getElementById("loading-status-text"),
  copyBtn: document.getElementById("copy-btn"),
  downloadBtn: document.getElementById("download-btn"),
  // Quick Sample Buttons
  sampleResumeBtn: document.getElementById("btn-sample-resume"),
  sampleJdPrBtn: document.getElementById("btn-sample-jd-pr"),
  sampleJdClinicalBtn: document.getElementById("btn-sample-jd-clinical"),
  sampleJdSalesBtn: document.getElementById("btn-sample-jd-sales"),
  // Settings & Theme
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  apiKeyBtn: document.getElementById("api-key-btn"),
  apiKeyModal: document.getElementById("api-key-modal"),
  closeModalBtn: document.getElementById("close-modal-btn"),
  saveApiKeyBtn: document.getElementById("save-api-key-btn"),
  apiKeyInput: document.getElementById("api-key-input"),
  apiKeyStatusBadge: document.getElementById("api-key-status-badge"),
  // Help Guide Modal
  helpGuideBtn: document.getElementById("help-guide-btn"),
  helpGuideModal: document.getElementById("help-guide-modal"),
  closeHelpModalBtn: document.getElementById("close-help-modal-btn"),
  guideCloseBottomBtn: document.getElementById("guide-close-bottom-btn"),
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toast-message"),
};

// Returns live context for the AI Career Coach
function getLiveContext() {
  const profile = getProfile(state.selectedProfileId);
  return {
    profile,
    score: state.lastScoreData?.score || 0,
    matchedCompetencies: state.lastScoreData?.matchedCompetencies || [],
    missingCompetencies: state.lastScoreData?.missingCompetencies || [],
    matchedKeywords: state.lastScoreData?.matchedKeywords || [],
    missingKeywords: state.lastScoreData?.missingKeywords || [],
    hasResume: !!(state.resumeText && state.resumeText.trim()),
    hasJd: !!(state.jobDescriptionText && state.jobDescriptionText.trim()),
    userApiKey: state.userApiKey || "",
  };
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  setupProfiles();
  updateApiKeyBadge();
  renderScore();
  coach.init(getLiveContext);
});

function setupProfiles() {
  updateProfileUI();
}

function updateProfileUI() {
  const profile = getProfile(state.selectedProfileId);
  if (elements.profileDescription) {
    elements.profileDescription.textContent = profile.description || "";
  }
  if (elements.profileCategory) {
    elements.profileCategory.textContent = profile.category || "General";
  }

  if (state.selectedProfileId === "custom") {
    elements.customProfileSection?.classList.remove("hidden");
    const custom = getCustomProfile();
    if (elements.customNameInput) elements.customNameInput.value = custom.name || "";
    if (elements.customCompetenciesInput)
      elements.customCompetenciesInput.value = (custom.coreCompetencies || []).join(", ");
    if (elements.customVerbsInput)
      elements.customVerbsInput.value = (custom.actionVerbs || []).join(", ");
    if (elements.customEmphasisInput)
      elements.customEmphasisInput.value = custom.promptEmphasis || "";
  } else {
    elements.customProfileSection?.classList.add("hidden");
  }

  calculateAndRenderScore();
}

function setupEventListeners() {
  // Resume input change
  elements.resumeInput?.addEventListener("input", (e) => {
    state.resumeText = e.target.value;
    calculateAndRenderScore();
  });

  // JD input change
  elements.jdInput?.addEventListener("input", (e) => {
    state.jobDescriptionText = e.target.value;
    calculateAndRenderScore();
  });

  // Profile select change
  elements.profileSelect?.addEventListener("change", (e) => {
    state.selectedProfileId = e.target.value;
    updateProfileUI();
  });

  // Save Custom Profile
  elements.saveCustomProfileBtn?.addEventListener("click", () => {
    const customData = {
      name: elements.customNameInput.value.trim() || "Custom Target Profile",
      coreCompetencies: elements.customCompetenciesInput.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      actionVerbs: elements.customVerbsInput.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      promptEmphasis: elements.customEmphasisInput.value.trim(),
    };
    saveCustomProfile(customData);
    showToast("Custom profile saved successfully!");
    calculateAndRenderScore();
  });

  // Drag and drop file upload
  const dropArea = elements.fileUploadArea;
  if (dropArea) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.add("border-indigo-500", "bg-indigo-950/20");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropArea.classList.remove("border-indigo-500", "bg-indigo-950/20");
      });
    });

    dropArea.addEventListener("drop", async (e) => {
      const dt = e.dataTransfer;
      const file = dt.files?.[0];
      if (file) handleFileUpload(file);
    });

    dropArea.addEventListener("click", () => elements.fileInput?.click());
  }

  elements.fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  });

  elements.clearFileBtn?.addEventListener("click", () => {
    elements.fileInput.value = "";
    elements.fileNameBadge?.classList.add("hidden");
    state.resumeText = "";
    if (elements.resumeInput) elements.resumeInput.value = "";
    calculateAndRenderScore();
  });

  // Quick Samples
  elements.sampleResumeBtn?.addEventListener("click", () => {
    state.resumeText = SAMPLE_RESUME;
    if (elements.resumeInput) elements.resumeInput.value = SAMPLE_RESUME;
    showToast("Sample master resume loaded.");
    calculateAndRenderScore();
  });

  elements.sampleJdPrBtn?.addEventListener("click", () => {
    state.jobDescriptionText = SAMPLE_JDS.crisis_management;
    if (elements.jdInput) elements.jdInput.value = SAMPLE_JDS.crisis_management;
    elements.profileSelect.value = "crisis_management";
    state.selectedProfileId = "crisis_management";
    updateProfileUI();
    showToast("PR Crisis job posting loaded.");
  });

  elements.sampleJdClinicalBtn?.addEventListener("click", () => {
    state.jobDescriptionText = SAMPLE_JDS.wellness_clinical_director;
    if (elements.jdInput) elements.jdInput.value = SAMPLE_JDS.wellness_clinical_director;
    elements.profileSelect.value = "wellness_clinical_director";
    state.selectedProfileId = "wellness_clinical_director";
    updateProfileUI();
    showToast("Wellness Clinical Director job posting loaded.");
  });

  elements.sampleJdSalesBtn?.addEventListener("click", () => {
    state.jobDescriptionText = SAMPLE_JDS.b2c_b2b_sales;
    if (elements.jdInput) elements.jdInput.value = SAMPLE_JDS.b2c_b2b_sales;
    elements.profileSelect.value = "b2c_b2b_sales";
    state.selectedProfileId = "b2c_b2b_sales";
    updateProfileUI();
    showToast("B2B/B2C Sales job posting loaded.");
  });

  // Action Buttons
  elements.btnBullets?.addEventListener("click", () => generateDocument("bullets"));
  elements.btnCoverLetter?.addEventListener("click", () => generateDocument("cover_letter"));
  elements.btnGapAnalysis?.addEventListener("click", () => generateDocument("gap_analysis"));

  // Tab navigation
  elements.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Copy Output
  elements.copyBtn?.addEventListener("click", () => {
    const currentText = state.generatedOutputs[state.activeTab];
    if (!currentText) {
      showToast("No content to copy for this tab.", "warning");
      return;
    }
    navigator.clipboard.writeText(currentText);
    showToast("Copied to clipboard!");
  });

  // Download Output
  elements.downloadBtn?.addEventListener("click", () => {
    const currentText = state.generatedOutputs[state.activeTab];
    if (!currentText) {
      showToast("No content to download.", "warning");
      return;
    }
    const profile = getProfile(state.selectedProfileId);
    const filename = `${profile.id}_${state.activeTab}.md`;
    downloadTextFile(filename, currentText);
    showToast(`Downloaded ${filename}`);
  });

  // API Key Modal
  elements.apiKeyBtn?.addEventListener("click", () => {
    if (elements.apiKeyInput) elements.apiKeyInput.value = state.userApiKey;
    elements.apiKeyModal?.classList.remove("hidden");
  });

  elements.closeModalBtn?.addEventListener("click", () => {
    elements.apiKeyModal?.classList.add("hidden");
  });

  elements.saveApiKeyBtn?.addEventListener("click", () => {
    const key = elements.apiKeyInput.value.trim();
    state.userApiKey = key;
    if (key) {
      localStorage.setItem("resumewatcher_gemini_key", key);
      showToast("Gemini API key saved in browser storage.");
    } else {
      localStorage.removeItem("resumewatcher_gemini_key");
      showToast("User API key cleared. Using server default if configured.");
    }
    updateApiKeyBadge();
    elements.apiKeyModal?.classList.add("hidden");
  });

  // Theme Toggle Button (Light/Dark Mode)
  elements.themeToggleBtn?.addEventListener("click", () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("resumewatcher_theme", "light");
      showToast("Switched to Light mode");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      localStorage.setItem("resumewatcher_theme", "dark");
      showToast("Switched to Dark mode");
    }
  });

  // Global Keyboard Navigation (Close dialogs on Escape)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      elements.helpGuideModal?.classList.add("hidden");
      elements.apiKeyModal?.classList.add("hidden");
      coach.close();
    }
  });

  // Help Guide Modal
  elements.helpGuideBtn?.addEventListener("click", () => {
    elements.helpGuideModal?.classList.remove("hidden");
  });

  elements.closeHelpModalBtn?.addEventListener("click", () => {
    elements.helpGuideModal?.classList.add("hidden");
  });

  elements.guideCloseBottomBtn?.addEventListener("click", () => {
    elements.helpGuideModal?.classList.add("hidden");
  });
}

async function handleFileUpload(file) {
  try {
    showToast(`Parsing ${file.name}...`, "info");
    const text = await parseDocument(file);
    state.resumeText = text;
    if (elements.resumeInput) elements.resumeInput.value = text;
    if (elements.fileNameText) elements.fileNameText.textContent = file.name;
    elements.fileNameBadge?.classList.remove("hidden");
    showToast(`Extracted ${text.split(/\s+/).length} words from ${file.name}`);
    calculateAndRenderScore();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function calculateAndRenderScore() {
  const profile = getProfile(state.selectedProfileId);
  const scoreData = scoreResume(
    state.resumeText,
    state.jobDescriptionText,
    profile
  );
  state.lastScoreData = scoreData;
  renderScore(scoreData);
}

function renderScore(scoreData = null) {
  const data =
    scoreData || {
      score: 0,
      matchedKeywords: [],
      missingKeywords: [],
      matchedCompetencies: [],
      missingCompetencies: [],
      verbMatches: [],
      summary: "Add your resume and target job description to compute ATS compatibility.",
    };

  // Update circular gauge
  const circumference = 2 * Math.PI * 42; // r=42
  const offset = circumference - (data.score / 100) * circumference;

  if (elements.gaugeContainer) {
    elements.gaugeContainer.setAttribute("aria-valuenow", data.score);
  }

  if (elements.gaugeCircle) {
    elements.gaugeCircle.style.strokeDasharray = `${circumference}`;
    elements.gaugeCircle.style.strokeDashoffset = `${offset}`;

    // Dynamic color
    if (data.score >= 80) {
      elements.gaugeCircle.style.stroke = "#10b981"; // Emerald
    } else if (data.score >= 60) {
      elements.gaugeCircle.style.stroke = "#f59e0b"; // Amber
    } else {
      elements.gaugeCircle.style.stroke = "#6366f1"; // Indigo
    }
  }

  if (elements.scoreText) {
    elements.scoreText.textContent = `${data.score}%`;
  }

  if (elements.scoreSummary) {
    elements.scoreSummary.textContent = data.summary;
  }

  // Render Matched Competencies
  if (elements.matchedCompContainer) {
    elements.matchedCompContainer.innerHTML = (data.matchedCompetencies || [])
      .map(
        (c) =>
          `<span class="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">✓ ${c}</span>`
      )
      .join("") || `<span class="text-xs text-slate-500 dark:text-gray-500 italic">No direct competency matches yet</span>`;
  }

  // Render Missing Competencies
  if (elements.missingCompContainer) {
    elements.missingCompContainer.innerHTML = (data.missingCompetencies || [])
      .map(
        (c) =>
          `<span class="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-500/15 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">+ ${c}</span>`
      )
      .join("") || `<span class="text-xs text-emerald-600 dark:text-emerald-400 italic">All target competencies covered!</span>`;
  }

  // Render Matched Keywords
  if (elements.matchedKwContainer) {
    elements.matchedKwContainer.innerHTML = (data.matchedKeywords || [])
      .map(
        (k) =>
          `<span class="px-2 py-0.5 text-xs rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono">${k}</span>`
      )
      .join("") || `<span class="text-xs text-slate-500 dark:text-gray-500 italic">None detected</span>`;
  }

  // Render Missing Keywords
  if (elements.missingKwContainer) {
    elements.missingKwContainer.innerHTML = (data.missingKeywords || [])
      .map(
        (k) =>
          `<span class="px-2 py-0.5 text-xs rounded bg-amber-500/15 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-mono">${k}</span>`
      )
      .join("") || `<span class="text-xs text-slate-500 dark:text-gray-500 italic">None detected</span>`;
  }

  // Render Action Verbs
  if (elements.verbBadgeContainer) {
    elements.verbBadgeContainer.innerHTML = (data.verbMatches || [])
      .map(
        (v) =>
          `<span class="px-2.5 py-1 text-xs rounded-full bg-indigo-500/15 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-mono">${v}</span>`
      )
      .join("") || `<span class="text-xs text-slate-500 dark:text-gray-500 italic">None detected</span>`;
  }
}

async function generateDocument(documentType) {
  if (!state.resumeText || !state.resumeText.trim()) {
    showToast("Please upload or paste a master resume first.", "warning");
    return;
  }
  if (!state.jobDescriptionText || !state.jobDescriptionText.trim()) {
    showToast("Please provide a target job description.", "warning");
    return;
  }

  state.activeTab = documentType;
  switchTab(documentType);

  // Set loading state
  state.isGenerating = true;
  elements.outputPlaceholder?.classList.add("hidden");
  elements.outputContent?.classList.add("hidden");
  elements.outputLoading?.classList.remove("hidden");

  const statusMessages = {
    bullets: "Optimizing high-impact STAR bullet points & professional summary with Gemini...",
    cover_letter: "Composing AP-style strategic cover letter tailored to role competencies...",
    gap_analysis: "Running deep ATS semantic gap analysis and interview strategy...",
  };
  if (elements.loadingStatusText) {
    elements.loadingStatusText.textContent = statusMessages[documentType] || "Generating with Gemini...";
  }

  const profile = getProfile(state.selectedProfileId);

  try {
    const response = await fetch("/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText: state.resumeText,
        jobDescription: state.jobDescriptionText,
        profile: profile,
        documentType: documentType,
        userApiKey: state.userApiKey,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === "MISSING_API_KEY") {
        elements.apiKeyModal?.classList.remove("hidden");
        throw new Error(data.error);
      }
      throw new Error(data.error || `Generation failed (HTTP ${response.status})`);
    }

    state.generatedOutputs[documentType] = data.result;
    displayOutput(data.result);
    showToast("Tailored document generated successfully!");
  } catch (err) {
    showToast(err.message, "error");
    if (!state.generatedOutputs[documentType]) {
      elements.outputPlaceholder?.classList.remove("hidden");
      elements.outputContent?.classList.add("hidden");
    }
  } finally {
    state.isGenerating = false;
    elements.outputLoading?.classList.add("hidden");
  }
}

function switchTab(tab) {
  state.activeTab = tab;

  // Update tab buttons UI with accessibility attributes
  elements.tabBtns.forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) {
      btn.classList.add("bg-indigo-600", "text-white", "shadow");
      btn.classList.remove("text-slate-600", "dark:text-gray-400", "hover:text-slate-900", "dark:hover:text-white");
    } else {
      btn.classList.remove("bg-indigo-600", "text-white", "shadow");
      btn.classList.add("text-slate-600", "dark:text-gray-400", "hover:text-slate-900", "dark:hover:text-white");
    }
  });

  // Display content for this tab
  const content = state.generatedOutputs[tab];
  if (content) {
    displayOutput(content);
  } else if (!state.isGenerating) {
    elements.outputPlaceholder?.classList.remove("hidden");
    elements.outputContent?.classList.add("hidden");
  }
}

function displayOutput(markdownText) {
  elements.outputPlaceholder?.classList.add("hidden");
  elements.outputLoading?.classList.add("hidden");
  elements.outputContent?.classList.remove("hidden");

  // Render markdown with marked.js if available, else simple fallback
  if (window.marked && typeof window.marked.parse === "function") {
    elements.outputContent.innerHTML = window.marked.parse(markdownText);
  } else {
    elements.outputContent.innerHTML = markdownText
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }
}

function updateApiKeyBadge() {
  if (!elements.apiKeyStatusBadge) return;

  if (state.userApiKey) {
    elements.apiKeyStatusBadge.textContent = "Custom Key Active (Click to edit)";
  } else {
    elements.apiKeyStatusBadge.textContent = "Custom Key Override (Optional)";
  }
}

function showToast(message, type = "success") {
  if (!elements.toast || !elements.toastMessage) return;

  elements.toastMessage.textContent = message;

  let bgClass = "bg-slate-900 border-slate-700 text-white";
  if (type === "error") bgClass = "bg-rose-950/90 border-rose-600 text-rose-100";
  if (type === "warning") bgClass = "bg-amber-950/90 border-amber-600 text-amber-100";
  if (type === "info") bgClass = "bg-indigo-950/90 border-indigo-600 text-indigo-100";

  elements.toast.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 ${bgClass}`;

  clearTimeout(elements.toast._timer);
  elements.toast._timer = setTimeout(() => {
    elements.toast.classList.add("translate-y-4", "opacity-0");
  }, 4000);
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
