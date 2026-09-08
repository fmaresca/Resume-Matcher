/**
 * Cloudflare Pages Function: /api/chat
 * Interactive AI Career Coach & ResumeWatcher Assistant powered by Google Gemini
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
    const { messages = [], context: appContext = {}, userApiKey } = body;

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "At least one message is required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey =
      (userApiKey && userApiKey.trim()) ||
      context.env.AI_API_KEY ||
      context.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "No Gemini API key configured. Please add your key in the UI settings or in Cloudflare Pages environment variables.",
          code: "MISSING_API_KEY",
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Build context summary for the AI
    const profileName = appContext.profile?.name || "General Professional";
    const currentScore = appContext.score !== undefined ? `${appContext.score}%` : "Not yet computed";
    const missingComps = (appContext.missingCompetencies || []).slice(0, 8).join(", ") || "None";
    const matchedComps = (appContext.matchedCompetencies || []).slice(0, 8).join(", ") || "None";
    const missingKws = (appContext.missingKeywords || []).slice(0, 8).join(", ") || "None";

    const systemInstruction = `You are the ResumeWatcher Career Coach & ATS Strategist—an elite, knowledgeable executive advisor helping candidates gain an unfair advantage in their job applications.

Persona & Voice Tone:
- You speak with a bright, cheerful, encouraging, and articulate British cadence (standard British English spelling and warm, poised British expressions like "Brilliant", "Spot on", "Cheerio", "Let's dive in", "Splendid").
- Your energy is positive, warm, polished, and empowering—like a top-tier executive mentor in London cheering the candidate on to victory!

Current User Application State:
- Target Role Profile: ${profileName}
- Live ATS Compatibility Score: ${currentScore}
- Matched Core Competencies: [${matchedComps}]
- Missing Competencies to Bridge: [${missingComps}]
- Missing Job Posting Keywords: [${missingKws}]
- Has Master Resume Uploaded: ${appContext.hasResume ? "Yes" : "No"}
- Has Target Job Description: ${appContext.hasJd ? "Yes" : "No"}

Your Core Objectives:
1. Guide the user on how to use ResumeWatcher to optimize their application materials step-by-step:
   - Step 1: Upload master resume (PDF/DOCX/TXT)
   - Step 2: Select the best matching strategic persona (Crisis Comms, Media Relations, Corporate PR, Wellness Clinical Director, B2B/B2C Sales, or Custom)
   - Step 3: Paste the target job description
   - Step 4: Click "Tailor Bullets", "AP Cover Letter", or "Gap Analysis" to generate tailored documents
2. Coach candidates on how to close keyword gaps and address missing competencies truthfully using the STAR method (Situation, Task, Action, Result).
3. Offer strategic tips on executive presence, metric quantification (percentages, revenue, time saved), and passing corporate ATS filters.
4. Keep answers concise, highly structured (using markdown bullet points and bold highlights), uplifting, and immediately actionable. Avoid overwhelming walls of text.`;

    // Map conversation history to Gemini format (user & model roles)
    const contents = [];

    // Prepend system prompt to the first turn or instruction
    let isFirstUserTurn = true;
    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      let text = msg.content;

      if (role === "user" && isFirstUserTurn) {
        text = `${systemInstruction}\n\n---\n\nUser Question:\n${text}`;
        isFirstUserTurn = false;
      }

      contents.push({
        role,
        parts: [{ text }],
      });
    }

    const payload = {
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1500,
      },
    };

    const models = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-2.5-flash"];
    let lastError = null;
    let replyText = null;

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (resp.ok) {
          const data = await resp.json();
          replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) break;
        } else {
          const errData = await resp.json().catch(() => ({}));
          lastError = errData.error?.message || `HTTP ${resp.status}`;
          if (resp.status !== 404 && resp.status !== 503) break;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!replyText) {
      return new Response(
        JSON.stringify({
          error: `Gemini Coach error: ${lastError || "Could not generate response."}`,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reply: replyText,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
}
