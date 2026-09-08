/**
 * Cloudflare Pages Function: /api/tailor
 * Edge runtime for LLM dispatch using Google Gemini API
 */

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const body = await context.request.json();
    const {
      resumeText,
      jobDescription,
      profile,
      documentType = "bullets",
      userApiKey,
    } = body;

    if (!resumeText || !resumeText.trim()) {
      return new Response(
        JSON.stringify({ error: "Master resume text is required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!jobDescription || !jobDescription.trim()) {
      return new Response(
        JSON.stringify({ error: "Job description is required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const candidateKeys = [];
    if (userApiKey && userApiKey.trim()) {
      candidateKeys.push(userApiKey.trim());
    }
    const serverKey = context.env.AI_API_KEY || context.env.GEMINI_API_KEY;
    if (serverKey && !candidateKeys.includes(serverKey)) {
      candidateKeys.push(serverKey);
    }

    if (candidateKeys.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "No Gemini API key configured. Please enter your Google Gemini API key in the UI settings or configure AI_API_KEY / GEMINI_API_KEY in Cloudflare Pages environment variables.",
          code: "MISSING_API_KEY",
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Prepare profile guidance
    const profileName = profile?.name || "General Professional";
    const competencies = Array.isArray(profile?.coreCompetencies)
      ? profile.coreCompetencies.join(", ")
      : "";
    const actionVerbs = Array.isArray(profile?.actionVerbs)
      ? profile.actionVerbs.join(", ")
      : "";
    const promptEmphasis = profile?.promptEmphasis || "";

    // Build prompt based on requested document type
    let systemInstruction = "";
    let userPrompt = "";

    if (documentType === "bullets") {
      systemInstruction = `You are an elite executive resume writer and ATS optimization expert specializing in ${profileName}.
Your objective is to tailor the candidate's master resume for the provided job posting.
Rules:
1. Preserve 100% factual accuracy—never fabricate credentials, companies, or fake metrics not present or implied in the master resume.
2. Structure bullet points strictly using the STAR methodology (Situation/Task, Action, Result).
3. Naturally infuse key competencies: [${competencies}].
4. Utilize punchy action verbs where appropriate: [${actionVerbs}].
5. Adhere to style guidance: ${promptEmphasis}.
6. Output in clean Markdown format with two sections:
   ### ATS-Optimized Professional Summary (3-4 impactful sentences)
   ### Targeted High-Impact Bullet Points (5-7 STAR-aligned achievement bullets)`;

      userPrompt = `TARGET JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE MASTER RESUME:\n${resumeText}\n\nPlease generate the ATS-optimized summary and bullet points now:`;
    } else if (documentType === "cover_letter") {
      systemInstruction = `You are a distinguished communications specialist and executive career advisor specializing in ${profileName}.
Your objective is to write a bespoke, compelling cover letter adhering to AP Style guidelines that connects the candidate's master resume to the target job description.
Rules:
1. Follow AP Style: concise, clear, journalistic cadence, avoiding clichés ("I am writing to express my enthusiasm").
2. Reflect the strategic persona: ${promptEmphasis}.
3. Prioritize demonstrated achievements and outcomes from the master resume that directly solve the employer's needs in the job description.
4. Keep the letter to 3-4 structured paragraphs:
   - Hook / Alignment: Immediate value proposition and role fit.
   - Core Proof / Achievement Story: 1-2 quantified success examples using STAR format.
   - Strategic Fit & Forward Momentum: Synthesis of how candidate adds immediate value.
   - Professional Closing.
5. Format with standard placeholders for [Candidate Name], [Date], [Hiring Manager / Company Name].`;

      userPrompt = `TARGET JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE MASTER RESUME:\n${resumeText}\n\nPlease draft the AP-Style cover letter now:`;
    } else {
      // Gap Analysis & Interview Prep
      systemInstruction = `You are an ATS algorithms specialist and senior hiring manager for ${profileName}.
Perform a thorough ATS gap analysis and interview positioning guide.
Include:
1. **Critical Keywords Missing**: Exact phrases and terminology from the job description missing in the resume.
2. **Experience & Metric Enhancements**: Concrete advice on how the candidate can reframe existing resume points to match what the hiring team seeks.
3. **Key Interview Talking Points**: 3 questions the employer will likely ask based on this JD and how the candidate should answer based on their resume.`;

      userPrompt = `TARGET JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE MASTER RESUME:\n${resumeText}\n\nPlease generate the comprehensive ATS gap analysis and interview strategy now:`;
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemInstruction}\n\n---\n\n${userPrompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2500,
      },
    };

    // Attempt generation with latest available Google Gemini models
    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
      "gemini-2.5-flash",
      "gemini-1.5-flash",
    ];
    let lastError = null;
    let responseText = null;

    keyLoop: for (const key of candidateKeys) {
      for (const model of models) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const resp = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (resp.ok) {
            const data = await resp.json();
            const candidateText =
              data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) {
              responseText = candidateText;
              break keyLoop;
            }
          } else {
            const errData = await resp.json().catch(() => ({}));
            lastError = errData.error?.message || `HTTP ${resp.status}`;
            // If the key is invalid or unauthorized, switch immediately to the next candidate key
            if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
              continue keyLoop;
            }
            if (resp.status !== 404 && resp.status !== 503) {
              break;
            }
          }
        } catch (err) {
          lastError = err.message;
        }
      }
    }

    if (!responseText) {
      return new Response(
        JSON.stringify({
          error: `Gemini API error: ${lastError || "Failed to generate content."}`,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentType,
        profileId: profile?.id || "custom",
        result: responseText,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: `Edge function error: ${error.message}`,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
