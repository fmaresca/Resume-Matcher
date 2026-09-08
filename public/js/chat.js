/**
 * AI Career Coach Chat Assistant ("ResumeWatcher Copilot")
 * Real-time context-aware guidance for job seekers.
 */

class AICoach {
  constructor() {
    this.messages = [];
    this.getContext = null;
    this.isThinking = false;
    this.elements = {};
  }

  init(getContextFn) {
    this.getContext = getContextFn;
    this.bindDOMElements();
    this.setupListeners();
    this.renderWelcomeMessage();
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
      this.messages = [];
      this.renderWelcomeMessage();
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

  open() {
    this.elements.drawer?.classList.remove("translate-x-full");
    this.elements.backdrop?.classList.remove("hidden");
    this.updateContextUI();
    setTimeout(() => this.elements.input?.focus(), 200);
  }

  close() {
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
    this.elements.messagesList.innerHTML = `
      <div class="flex items-start gap-3 text-xs leading-relaxed animate-fade-in">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-md">
          AI
        </div>
        <div class="flex-1 bg-slate-800/80 border border-slate-700/80 rounded-2xl rounded-tl-none p-3.5 text-slate-200">
          <p class="font-semibold text-white mb-1.5 flex items-center gap-1.5">
            <span>Welcome! I'm your Career & ATS Strategist</span>
            <span class="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-normal">Active</span>
          </p>
          <p class="text-slate-300 mb-2">
            I'm here to help you get interviews and maximize your competitive edge. I have live visibility into your current resume, target job posting, and ATS score.
          </p>
          <p class="text-[11px] text-slate-400">
            Ask me anything below, or click one of the quick strategy prompts to get started!
          </p>
        </div>
      </div>
    `;
  }

  async handleSend() {
    if (this.isThinking) return;
    const text = this.elements.input?.value.trim();
    if (!text) return;

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
        `⚠️ **Error:** ${err.message}\n\n*Tip: Check that your Google Gemini API key is configured properly.*`
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

    msgDiv.innerHTML = `
      ${avatarHtml}
      <div class="${bubbleClasses} prose-chat overflow-x-auto">
        ${parsedContent}
      </div>
    `;

    this.elements.messagesList.appendChild(msgDiv);
    this.scrollToBottom();
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
