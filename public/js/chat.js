/**
 * AI Career Coach Chat Assistant ("ResumeWatcher Copilot")
 * Real-time context-aware guidance for job seekers with British Voice Audio (TTS).
 */

// Strip markdown syntax and special characters so speech sounds smooth and conversational
function cleanTextForSpeech(text) {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, "Code block omitted.") // Remove code blocks
    .replace(/`([^`]+)`/g, "$1")                      // Remove inline code ticks
    .replace(/^#+\s+/gm, "")                          // Remove heading hashes
    .replace(/\*\*([^*]+)\*\*/g, "$1")                // Remove bold
    .replace(/\*([^*]+)\*/g, "$1")                    // Remove italics
    .replace(/__([^_]+)__/g, "$1")                    // Remove bold
    .replace(/_([^_]+)_/g, "$1")                      // Remove italics
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")          // Remove markdown links
    .replace(/^[\*\-\+]\s+/gm, "")                    // Remove bullet markers
    .replace(/^\d+\.\s+/gm, "")                       // Remove numbered list markers
    .replace(/>\s+/gm, "")                            // Remove blockquotes
    .replace(/---|\*\*\*/g, "")                       // Remove horizontal rules
    .replace(/💡|🎯|⭐|👔|🎙️|⚠️|🇬🇧|✓|\+/g, "")        // Remove special symbols
    .replace(/\s+/g, " ")                             // Collapse multiple whitespaces
    .trim();
}

// Select a high-quality British female voice from the browser's SpeechSynthesis engine
function findBritishFemaleVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Identify all en-GB voices
  const enGb = voices.filter(
    (v) =>
      v.lang &&
      (v.lang.toLowerCase() === "en-gb" ||
        v.lang.toLowerCase().startsWith("en-gb") ||
        v.lang.toLowerCase().replace("_", "-") === "en-gb")
  );

  // Preferred British female voice names across Windows, Edge, Chrome, iOS Safari & Android
  const femaleNames = [
    "female",
    "libby",
    "sonia",
    "hazel",
    "serena",
    "martha",
    "kate",
    "victoria",
    "stephanie",
    "fiona",
    "alice",
    "susan",
    "mia",
  ];

  for (const name of femaleNames) {
    const match = enGb.find((v) => v.name.toLowerCase().includes(name));
    if (match) return match;
  }

  // 2. Any en-GB voice that is not explicitly named male
  if (enGb.length > 0) {
    const nonMale = enGb.find(
      (v) =>
        !v.name.toLowerCase().includes("male") &&
        !v.name.toLowerCase().includes("george") &&
        !v.name.toLowerCase().includes("oliver") &&
        !v.name.toLowerCase().includes("ryan")
    );
    if (nonMale) return nonMale;
    return enGb[0];
  }

  // 3. Fallback to British-associated locales
  const ukVoice = voices.find(
    (v) =>
      v.lang &&
      (v.lang.includes("GB") || v.lang.includes("UK") || v.lang.includes("en_GB"))
  );
  if (ukVoice) return ukVoice;

  // 4. Fallback to any English female voice
  const allEn = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  for (const name of femaleNames) {
    const match = allEn.find((v) => v.name.toLowerCase().includes(name));
    if (match) return match;
  }

  return allEn[0] || voices[0] || null;
}

class AICoach {
  constructor() {
    this.messages = [];
    this.getContext = null;
    this.isThinking = false;
    this.elements = {};
    this.speechEnabled = localStorage.getItem("resumewatcher_speech_enabled") !== "false";
    this.isSpeaking = false;
    this.currentSpeakingId = null;
    this.msgIdCounter = 0;
  }

  init(getContextFn) {
    this.getContext = getContextFn;
    this.bindDOMElements();
    this.setupListeners();
    this.initSpeech();
    this.renderWelcomeMessage();
    this.updateVoiceToggleUI();
  }

  bindDOMElements() {
    this.elements = {
      drawer: document.getElementById("chat-drawer"),
      backdrop: document.getElementById("chat-backdrop"),
      closeBtn: document.getElementById("close-chat-btn"),
      openBtns: document.querySelectorAll(".open-chat-trigger"),
      messagesList: document.getElementById("chat-messages-list"),
      input: document.getElementById("chat-input"),
      sendBtn: document.getElementById("send-chat-btn"),
      clearBtn: document.getElementById("clear-chat-btn"),
      quickPrompts: document.querySelectorAll(".chat-quick-prompt"),
      contextBadge: document.getElementById("chat-context-badge"),
      toggleVoiceBtn: document.getElementById("toggle-voice-btn"),
      voiceIconContainer: document.getElementById("voice-icon-container"),
      voiceStatusLabel: document.getElementById("voice-status-label"),
    };
  }

  setupListeners() {
    // Open chat triggers
    this.elements.openBtns.forEach((btn) => {
      btn.addEventListener("click", () => this.open());
    });

    // Close chat
    this.elements.closeBtn?.addEventListener("click", () => this.close());
    this.elements.backdrop?.addEventListener("click", () => this.close());

    // Send on button click
    this.elements.sendBtn?.addEventListener("click", () => this.handleSend());

    // Send on Enter (Shift+Enter for newline)
    this.elements.input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Clear history
    this.elements.clearBtn?.addEventListener("click", () => {
      this.stopSpeaking();
      this.messages = [];
      this.renderWelcomeMessage();
    });

    // Toggle Voice responses
    this.elements.toggleVoiceBtn?.addEventListener("click", () => {
      this.speechEnabled = !this.speechEnabled;
      localStorage.setItem("resumewatcher_speech_enabled", this.speechEnabled);
      if (!this.speechEnabled) {
        this.stopSpeaking();
      }
      this.updateVoiceToggleUI();
    });

    // Quick prompt chips
    this.elements.quickPrompts.forEach((chip) => {
      chip.addEventListener("click", () => {
        const text = chip.dataset.prompt || chip.textContent.trim();
        if (text) {
          if (this.elements.input) this.elements.input.value = text;
          this.handleSend();
        }
      });
    });
  }

  initSpeech() {
    if (!("speechSynthesis" in window)) return;
    // Pre-load voices if supported by the browser
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        findBritishFemaleVoice();
      };
    }
  }

  updateVoiceToggleUI() {
    if (!this.elements.voiceIconContainer || !this.elements.voiceStatusLabel) return;
    if (this.speechEnabled) {
      this.elements.voiceIconContainer.innerHTML = `
        <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
        </svg>
      `;
      this.elements.voiceStatusLabel.textContent = "Voice ON 🇬🇧";
      this.elements.voiceStatusLabel.className = "text-[10px] font-medium hidden sm:inline text-emerald-600 dark:text-emerald-400";
    } else {
      this.elements.voiceIconContainer.innerHTML = `
        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>
        </svg>
      `;
      this.elements.voiceStatusLabel.textContent = "Voice OFF";
      this.elements.voiceStatusLabel.className = "text-[10px] font-medium hidden sm:inline text-slate-400";
    }
  }

  open() {
    this.elements.drawer?.classList.remove("translate-x-full");
    this.elements.backdrop?.classList.remove("hidden");
    this.updateContextUI();
    setTimeout(() => this.elements.input?.focus(), 200);
  }

  close() {
    this.stopSpeaking();
    this.elements.drawer?.classList.add("translate-x-full");
    this.elements.backdrop?.classList.add("hidden");
  }

  updateContextUI() {
    if (!this.elements.contextBadge || !this.getContext) return;
    const ctx = this.getContext();
    const profileName = ctx.profile?.name || "PR Track";
    const score = ctx.score !== undefined ? `${ctx.score}% Match` : "0% Match";
    this.elements.contextBadge.textContent = `${profileName} • ${score}`;
  }

  renderWelcomeMessage() {
    if (!this.elements.messagesList) return;
    const welcomeId = "msg-welcome";
    const welcomeText = "Welcome! I'm your Career and ATS Strategist. I'm here to help you get interviews and maximize your competitive edge. I have live visibility into your current resume, target job posting, and ATS score. Ask me anything below, or click one of the quick strategy prompts to get started!";

    this.elements.messagesList.innerHTML = `
      <div class="flex items-start gap-3 text-xs leading-relaxed animate-fade-in">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-md">
          AI
        </div>
        <div class="flex-1 bg-slate-800/80 border border-slate-700/80 rounded-2xl rounded-tl-none p-3.5 text-slate-200 shadow">
          <p class="font-semibold text-white mb-1.5 flex items-center gap-1.5">
            <span>Welcome! I'm your Career & ATS Strategist</span>
            <span class="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-normal">Active</span>
          </p>
          <p class="text-slate-300 mb-2">
            I'm here to help you get interviews and maximize your competitive edge. I have live visibility into your current resume, target job posting, and ATS score.
          </p>
          <p class="text-[11px] text-slate-400 mb-2">
            Ask me anything below, or click one of the quick strategy prompts to get started!
          </p>
          <div class="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span class="flex items-center gap-1 text-[10px] text-indigo-300 font-medium">
              🇬🇧 <span>British Coach Voice</span>
            </span>
            <button type="button" class="btn-speak-msg flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/70 hover:bg-slate-700 text-slate-200 hover:text-white transition" data-msg-id="${welcomeId}">
              <svg class="w-3 h-3 text-emerald-400 speak-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
              </svg>
              <span class="speak-label font-medium text-[11px]">Listen</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind speak listener for the welcome message
    const welcomeBtn = this.elements.messagesList.querySelector(`[data-msg-id="${welcomeId}"]`);
    welcomeBtn?.addEventListener("click", () => {
      this.speak(welcomeText, welcomeId);
    });
  }

  async handleSend() {
    if (this.isThinking) return;
    const text = this.elements.input?.value.trim();
    if (!text) return;

    this.stopSpeaking();
    this.elements.input.value = "";
    this.appendMessage("user", text);

    // Prepare message history
    this.messages.push({ role: "user", content: text });

    // Show thinking bubble
    this.showThinkingBubble();
    this.isThinking = true;

    // Retrieve live context from app
    const appContext = this.getContext ? this.getContext() : {};

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: this.messages,
          context: appContext,
          userApiKey: appContext.userApiKey || "",
        }),
      });

      const data = await response.json();
      this.removeThinkingBubble();

      if (!response.ok) {
        throw new Error(data.error || "Failed to receive response from Coach.");
      }

      this.messages.push({ role: "assistant", content: data.reply });
      this.appendMessage("assistant", data.reply);
    } catch (err) {
      this.removeThinkingBubble();
      this.appendMessage(
        "assistant",
        `⚠️ **Error:** ${err.message}\n\n*Tip: Check your network connection or API status.*`
      );
    } finally {
      this.isThinking = false;
      this.scrollToBottom();
    }
  }

  appendMessage(role, text) {
    if (!this.elements.messagesList) return;

    const isUser = role === "user";
    const msgDiv = document.createElement("div");
    msgDiv.className = `flex items-start gap-3 text-xs leading-relaxed ${isUser ? "flex-row-reverse" : ""}`;

    let parsedContent = text;
    if (window.marked && !isUser) {
      parsedContent = window.marked.parse(text);
    } else {
      parsedContent = text.replace(/\n/g, "<br>");
    }

    const avatarHtml = isUser
      ? `<div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-md">You</div>`
      : `<div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-md">AI</div>`;

    const bubbleClasses = isUser
      ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none p-3.5 max-w-[85%] shadow"
      : "bg-slate-800/80 border border-slate-700/80 text-slate-200 rounded-2xl rounded-tl-none p-3.5 max-w-[90%] shadow";

    const msgId = `msg-${++this.msgIdCounter}`;

    const speechControlsHtml = !isUser
      ? `
        <div class="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
          <span class="flex items-center gap-1 text-[10px] text-indigo-300 font-medium">
            🇬🇧 <span>British Coach Voice</span>
          </span>
          <button type="button" class="btn-speak-msg flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/70 hover:bg-slate-700 text-slate-200 hover:text-white transition" data-msg-id="${msgId}">
            <svg class="w-3 h-3 text-emerald-400 speak-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
            </svg>
            <span class="speak-label font-medium text-[11px]">Listen</span>
          </button>
        </div>
      `
      : "";

    msgDiv.innerHTML = `
      ${avatarHtml}
      <div class="${bubbleClasses} prose-chat overflow-x-auto">
        ${parsedContent}
        ${speechControlsHtml}
      </div>
    `;

    this.elements.messagesList.appendChild(msgDiv);
    this.scrollToBottom();

    // Attach speak button handler for assistant messages
    if (!isUser) {
      const speakBtn = msgDiv.querySelector(`[data-msg-id="${msgId}"]`);
      speakBtn?.addEventListener("click", () => {
        this.speak(text, msgId);
      });

      // If auto voice response is enabled, speak immediately
      if (this.speechEnabled) {
        this.speak(text, msgId);
      }
    }
  }

  speak(text, msgId) {
    if (!("speechSynthesis" in window)) return;

    // If currently speaking this same message, tapping stops it
    if (this.isSpeaking && this.currentSpeakingId === msgId) {
      this.stopSpeaking();
      return;
    }

    this.stopSpeaking();

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = findBritishFemaleVoice();
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = "en-GB";
    utterance.pitch = 1.15; // Bright, cheerful, engaging cadence
    utterance.rate = 1.02;  // Upbeat, conversational tempo

    this.currentSpeakingId = msgId;
    this.isSpeaking = true;
    this.updateSpeakingButtonUI(msgId, true);

    utterance.onend = () => {
      this.isSpeaking = false;
      this.updateSpeakingButtonUI(this.currentSpeakingId, false);
      this.currentSpeakingId = null;
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.updateSpeakingButtonUI(this.currentSpeakingId, false);
      this.currentSpeakingId = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentSpeakingId) {
      this.updateSpeakingButtonUI(this.currentSpeakingId, false);
    }
    this.isSpeaking = false;
    this.currentSpeakingId = null;
  }

  updateSpeakingButtonUI(msgId, isPlaying) {
    if (!msgId || !this.elements.messagesList) return;
    const btn = this.elements.messagesList.querySelector(`[data-msg-id="${msgId}"]`);
    if (!btn) return;

    if (isPlaying) {
      btn.className = "btn-speak-msg flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 transition";
      btn.innerHTML = `
        <span class="flex items-center gap-0.5 h-3 text-rose-400">
          <span class="soundwave-bar"></span>
          <span class="soundwave-bar"></span>
          <span class="soundwave-bar"></span>
        </span>
        <span class="font-medium text-[11px]">Stop</span>
      `;
    } else {
      btn.className = "btn-speak-msg flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/70 hover:bg-slate-700 text-slate-200 hover:text-white transition";
      btn.innerHTML = `
        <svg class="w-3 h-3 text-emerald-400 speak-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
        </svg>
        <span class="speak-label font-medium text-[11px]">Listen</span>
      `;
    }
  }

  showThinkingBubble() {
    if (!this.elements.messagesList) return;
    const thinkingDiv = document.createElement("div");
    thinkingDiv.id = "chat-thinking-indicator";
    thinkingDiv.className = "flex items-start gap-3 text-xs";
    thinkingDiv.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-md">
        AI
      </div>
      <div class="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none px-4 py-3 text-slate-400 flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 0ms"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 150ms"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 300ms"></span>
      </div>
    `;
    this.elements.messagesList.appendChild(thinkingDiv);
    this.scrollToBottom();
  }

  removeThinkingBubble() {
    const el = document.getElementById("chat-thinking-indicator");
    if (el) el.remove();
  }

  scrollToBottom() {
    if (this.elements.messagesList) {
      this.elements.messagesList.scrollTop = this.elements.messagesList.scrollHeight;
    }
  }
}

export const coach = new AICoach();
