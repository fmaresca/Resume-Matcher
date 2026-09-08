/**
 * Pre-built role profiles and schemas with LocalStorage persistence for custom profiles.
 * Includes PR tracks, Wellness Clinical Director, B2C/B2B Sales, and Custom Profile.
 */

export const PREBUILT_PROFILES = {
  crisis_management: {
    id: "crisis_management",
    name: "Crisis Communications & Issues Management",
    category: "Public Relations",
    description: "Rapid response, reputation management, brand protection, and executive holding statements.",
    coreCompetencies: [
      "Rapid Response Messaging",
      "Reputation Management",
      "Holding Statements",
      "Executive Media Prep",
      "Crisis Simulation",
      "Scenario Planning",
      "Stakeholder Communication",
      "Media Monitoring",
      "Fact Checking",
      "Issues Escalation",
      "Brand Resilience",
    ],
    actionVerbs: [
      "Mitigated",
      "Formulated",
      "Briefed",
      "Countered",
      "Navigated",
      "Protected",
      "Mobilized",
      "Defused",
      "Resolved",
      "Spearheaded",
    ],
    promptEmphasis:
      "Emphasize high-stakes composure, accuracy under extreme time pressure, brand resilience, and proactive stakeholder communication.",
  },

  media_relations: {
    id: "media_relations",
    name: "Media Relations & Earned Media",
    category: "Public Relations",
    description: "Journalist outreach, editorial pitches, press tours, and Tier-1 coverage placements.",
    coreCompetencies: [
      "Media Pitching",
      "Press Release Drafting",
      "Editorial Calendars",
      "Journalist Outreach",
      "Press Kits",
      "Coverage Tracking",
      "Cision / Muck Rack",
      "Media Tour Coordination",
      "Press Conferences",
      "Earned Media Value (EMV)",
      "Storytelling",
    ],
    actionVerbs: [
      "Secured",
      "Pitched",
      "Authored",
      "Amplified",
      "Broadcast",
      "Liaised",
      "Orchestrated",
      "Cultivated",
      "Negotiated",
      "Placed",
    ],
    promptEmphasis:
      "Highlight placement metrics, earned media value, relationships with Tier-1 and trade press, and compelling narrative storytelling.",
  },

  corporate_stakeholder: {
    id: "corporate_stakeholder",
    name: "Corporate PR & Stakeholder Engagement",
    category: "Public Relations",
    description: "Executive visibility, ESG messaging, internal town halls, and annual reporting.",
    coreCompetencies: [
      "Thought Leadership",
      "Internal Communications",
      "ESG Messaging",
      "Executive Bylines",
      "Multi-Channel Campaigns",
      "Town Halls",
      "Annual Reports",
      "Social Listening",
      "Investor Relations Support",
      "Brand Voice Consistency",
    ],
    actionVerbs: [
      "Aligned",
      "Championed",
      "Drafted",
      "Facilitated",
      "Synthesized",
      "Broadcast",
      "Unified",
      "Spearheaded",
      "Positioned",
      "Cultivated",
    ],
    promptEmphasis:
      "Focus on brand voice consistency, executive visibility, multi-stakeholder alignment, corporate positioning, and ESG strategy.",
  },

  wellness_clinical_director: {
    id: "wellness_clinical_director",
    name: "Wellness Clinical Director",
    category: "Healthcare & Clinical",
    description: "Clinical governance, multidisciplinary care, staff supervision, and HIPAA compliance.",
    coreCompetencies: [
      "Clinical Governance",
      "Multidisciplinary Team Leadership",
      "HIPAA & Regulatory Compliance",
      "Patient Care Protocols",
      "Quality Assurance & Outcomes",
      "Staff Supervision & Credentialing",
      "Evidence-Based Practice (EBP)",
      "Program Development & Evaluation",
      "Crisis Intervention & Risk Assessment",
      "Electronic Health Records (EHR)",
      "Accreditation (Joint Commission/CARF)",
    ],
    actionVerbs: [
      "Directed",
      "Implemented",
      "Standardized",
      "Supervised",
      "Assessed",
      "Revamped",
      "Audited",
      "Orchestrated",
      "Enhanced",
      "Mentored",
      "Championed",
    ],
    promptEmphasis:
      "Emphasize clinical leadership, evidence-based wellness interventions, rigorous regulatory compliance (HIPAA/Joint Commission), multidisciplinary team supervision, and measurable patient outcome improvements.",
  },

  b2c_b2b_sales: {
    id: "b2c_b2b_sales",
    name: "B2C & B2B Sales Associate / Executive",
    category: "Sales & Business Development",
    description: "Pipeline management, consultative selling, outbound prospecting, and deal negotiation.",
    coreCompetencies: [
      "Pipeline & Funnel Management",
      "Consultative & Solution Selling",
      "Outbound Prospecting (Cold Calling/Emailing)",
      "B2B Account Management",
      "B2C Customer Acquisition",
      "Contract & Deal Negotiation",
      "CRM Hygiene (Salesforce/HubSpot)",
      "Quota & Revenue Attainment",
      "Value Proposition Pitching",
      "Objection Handling",
      "ARR / MRR Growth",
    ],
    actionVerbs: [
      "Generated",
      "Closed",
      "Negotiated",
      "Exceeded",
      "Prospected",
      "Converted",
      "Upsold",
      "Retained",
      "Accelerated",
      "Cultivated",
      "Outperformed",
    ],
    promptEmphasis:
      "Focus on metrics-driven quota attainment (ARR/MRR), pipeline conversion velocity, consultative discovery, high-ticket deal negotiation, and account retention.",
  },
};

const CUSTOM_PROFILE_STORAGE_KEY = "resumewatcher_custom_profile";

export function getCustomProfile() {
  try {
    const raw = localStorage.getItem(CUSTOM_PROFILE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to load custom profile from localStorage", e);
  }

  return {
    id: "custom",
    name: "Custom Target Profile",
    category: "User Defined",
    description: "Tailored to your specific niche keywords and guidelines.",
    coreCompetencies: [
      "Strategic Planning",
      "Cross-functional Collaboration",
      "Project Management",
      "Data Analysis",
    ],
    actionVerbs: ["Spearheaded", "Delivered", "Optimized", "Engineered", "Executed"],
    promptEmphasis: "Focus on measurable results, efficiency gains, and direct alignment with job posting requirements.",
  };
}

export function saveCustomProfile(profile) {
  try {
    const data = {
      ...profile,
      id: "custom",
      category: "User Defined",
    };
    localStorage.setItem(CUSTOM_PROFILE_STORAGE_KEY, JSON.stringify(data));
    return data;
  } catch (e) {
    console.error("Failed to save custom profile", e);
    return profile;
  }
}

export function getProfile(id) {
  if (id === "custom") {
    return getCustomProfile();
  }
  return PREBUILT_PROFILES[id] || PREBUILT_PROFILES.crisis_management;
}
