// ============================================================
//  DermaNova AI — ChatGPT Conversation Engine  (chatgpt.js)
//  Handles:
//   • System prompt initialization
//   • ML prediction → GPT explanation
//   • Conversational follow-up with full message history
//   • Typing animation & rich explanation card rendering
// ============================================================

'use strict';

// ── System Prompt ────────────────────────────────────────────
const DERMA_SYSTEM_PROMPT = `You are DermaNova AI, an expert medical assistant specialized strictly in dermatology, skin lesions, and skin cancer diagnosis support.

⚠️ STRICT DOMAIN SCOPE & GUARDRAIL:
- You ONLY answer questions directly related to medical skin cancer, skin lesions, dermatology, dermatoscopy, and skin health care.
- IF THE USER'S MESSAGE IS ON ANY TOPIC OTHER THAN MEDICAL SKIN CANCER OR DERMATOLOGY (such as general knowledge, coding, recipes, sports, non-skin medical topics, weather, entertainment, history, general chit-chat, etc.):
  DO NOT answer the question or provide explanations. Simply and strictly reply with ONLY:
  "I am DermaNova AI, a specialized dermatology assistant. Please ask skin cancer or dermatology related questions."

Your role when assisting with valid skin condition predictions or dermatology queries:
1. Explain skin lesion conditions and ML diagnostic predictions in plain clinical language.
2. Interpret malignancy risk and confidence scores.
3. Suggest evidence-based next steps, warning signs/red flags, and differential diagnoses.
4. Always maintain a professional medical decision-support tone.`;

// ── State ────────────────────────────────────────────────────
let _conversationHistory = [];   // [{role:'user'|'assistant'|'system', content:'...'}]
let _currentPredictionCtx = null; // last ML prediction passed in
let _isThinking = false;

// ── Public API ───────────────────────────────────────────────

/**
 * Reset conversation (call on new chat session).
 */
function resetConversation() {
    _conversationHistory = [];
    _currentPredictionCtx = null;
}

/**
 * Called by app.js after ML prediction. Renders explanation card then
 * streams GPT explanation into it.
 *
 * @param {object} prediction  { label, prob, imageCount, userText }
 * @param {HTMLElement} parentEl  message content div to append card into
 */
async function generateDermaExplanation(prediction, parentEl) {
    if (_isThinking) return;

    _currentPredictionCtx = prediction;

    // Initialize system prompt only once per session
    if (_conversationHistory.length === 0) {
        _conversationHistory.push({ role: 'system', content: DERMA_SYSTEM_PROMPT });
    }

    // Build context message for GPT from the real model verdict
    const verdict = (typeof prediction.malignant === 'boolean')
        ? (prediction.malignant ? 'Malignant' : 'Benign')
        : (prediction.label || 'Skin lesion detected');
    const probPct  = Math.round((prediction.prob || 0) * 100);
    const thrLine  = (prediction.threshold != null)
        ? ` (decision threshold ${Math.round(prediction.threshold * 100)}%)`
        : '';
    const userContextMsg = `New patient case submitted for analysis:
- Model Classification: ${verdict}
- Malignant Probability: ${probPct}%${thrLine}
- Images Analyzed: ${prediction.imageCount || 1}
${prediction.userText ? '- Physician notes: ' + prediction.userText : ''}

Please provide a clinical explanation of this result.`;

    _conversationHistory.push({ role: 'user', content: userContextMsg });

    // Render the explanation card with a loading state
    const card = _createExplanationCard(parentEl);
    const textEl = card.querySelector('.gpt-explanation-text');

    _setThinkingState(card, true);

    try {
        const reply = await _callProxy(_conversationHistory);
        _conversationHistory.push({ role: 'assistant', content: reply });
        _renderFormattedText(textEl, reply);
    } catch (err) {
        textEl.innerHTML = _formatErrorHTML(err.message);
    } finally {
        // Clear typing dots if they are still showing
        const typingEl = card.querySelector('.gpt-typing-indicator');
        if (typingEl) typingEl.remove();
        // Scroll chat into view
        const msgContainer = document.getElementById('messagesContainer');
        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    }
}

/**
 * Called by app.js when user types a follow-up message (no image attached).
 * Returns the AI reply text (app.js renders the bubble).
 *
 * @param {string} userMessage
 * @param {HTMLElement} aiContentDiv  the msg-content div for the AI response bubble
 * @returns {Promise<string>}
 */
async function chatWithDermaAI(userMessage, aiContentDiv) {
    if (_isThinking) return 'Please wait, DermaNova AI is still thinking…';

    // Initialize system prompt if this is a fresh session
    if (_conversationHistory.length === 0) {
        _conversationHistory.push({ role: 'system', content: DERMA_SYSTEM_PROMPT });
    }

    _conversationHistory.push({ role: 'user', content: userMessage });

    // Show typing indicator in bubble
    const bubble = aiContentDiv ? aiContentDiv.querySelector('.msg-bubble') : null;
    if (bubble) {
        bubble.innerHTML = _typingDotsHTML();
    }

    try {
        const reply = await _callProxy(_conversationHistory);
        _conversationHistory.push({ role: 'assistant', content: reply });
        if (bubble) _renderFormattedText(bubble, reply);
        return reply;
    } catch (err) {
        const errHTML = _formatErrorHTML(err.message);
        if (bubble) bubble.innerHTML = errHTML;
        return err.message;
    }
}

// ── Private helpers ───────────────────────────────────────────

/**
 * POST conversation history to PHP proxy and return the reply string.
 */
async function _callProxy(messages) {
    _isThinking = true;
    try {
        const res = await fetch('chatgpt_proxy.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        });

        let data;
        try { data = await res.json(); } catch(e) { throw new Error('PHP server error — make sure XAMPP is running'); }

        if (!res.ok || data.error) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data.reply;
    } catch (err) {
        // Re-throw with cleaner message for network failures
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            throw new Error('Cannot connect to server — make sure XAMPP/Apache is running');
        }
        throw err;
    } finally {
        _isThinking = false;
    }
}

/**
 * Creates and appends the GPT explanation card below the result card.
 */
function _createExplanationCard(parentEl) {
    // Remove any existing explanation card first
    const existing = parentEl.querySelector('.gpt-explanation-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.className = 'gpt-explanation-card';
    card.innerHTML = `
      <div class="gpt-explanation-text"></div>
    `;
    // Keep the card above the message action/timestamp row when present
    const metaRow = parentEl.querySelector('.msg-meta');
    if (metaRow) parentEl.insertBefore(card, metaRow);
    else parentEl.appendChild(card);

    // Animate in
    requestAnimationFrame(() => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
    });

    return card;
}

/**
 * Show/hide typing dots inside the card.
 */
function _setThinkingState(card, thinking) {
    const textEl = card.querySelector('.gpt-explanation-text');
    if (thinking) {
        textEl.innerHTML = _typingDotsHTML();
    }
}

function _typingDotsHTML() {
    return `<div class="gpt-typing-indicator">
      <span></span><span></span><span></span>
    </div>`;
}

/**
 * Render GPT markdown-lite text: **bold**, *italic*, numbered lists, bullets.
 */
function _renderFormattedText(el, text) {
    // Sanitize & format
    let html = text
        // Escape HTML entities
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Bold **text**
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic *text*
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Headers ### text
        .replace(/^###\s+(.+)$/gm, '<h4 class="gpt-section-title">$1</h4>')
        .replace(/^##\s+(.+)$/gm, '<h3 class="gpt-section-title">$1</h3>')
        // Numbered list items: 1. text
        .replace(/^\d+\.\s+(.+)$/gm, '<li class="gpt-list-item gpt-numbered">$1</li>')
        // Bullet list items: - text or • text
        .replace(/^[-•]\s+(.+)$/gm, '<li class="gpt-list-item">$1</li>')
        // Wrap <li> groups in <ul>
        .replace(/(<li[\s\S]*?<\/li>(\n|$))+/g, '<ul class="gpt-list">$&</ul>')
        // Paragraphs (blank line separation)
        .replace(/\n{2,}/g, '</p><p class="gpt-para">')
        // Line breaks
        .replace(/\n/g, '<br>');

    // Wrap in paragraph
    html = `<p class="gpt-para">${html}</p>`;

    el.innerHTML = html;
}

// ── Error message formatter ──────────────────────────────────
function _formatErrorHTML(message) {
    const isQuota   = message.toLowerCase().includes('quota') || message.toLowerCase().includes('billing');
    const isNetwork = message.toLowerCase().includes('connect') || message.toLowerCase().includes('xampp');
    const isAuth    = message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('api key');

    if (isQuota) {
        return `<div class="gpt-error-box">
          <div class="gpt-error-title">💳 OpenAI Quota Exceeded</div>
          <div class="gpt-error-body">Your API key has run out of credits. To fix this:</div>
          <ol class="gpt-error-steps">
            <li>Go to <a href="https://platform.openai.com/settings/billing" target="_blank" style="color:#a78bfa">platform.openai.com/settings/billing</a></li>
            <li>Add a payment method</li>
            <li>Purchase $5–$10 of API credits</li>
            <li>Refresh this page and try again</li>
          </ol>
        </div>`;
    }
    if (isAuth) {
        return `<div class="gpt-error-box"><div class="gpt-error-title">🔑 Invalid API Key</div>
          <div class="gpt-error-body">Check <code>openai_config.php</code> and make sure the key is correct.</div></div>`;
    }
    if (isNetwork) {
        return `<div class="gpt-error-box"><div class="gpt-error-title">🌐 Server Unreachable</div>
          <div class="gpt-error-body">Make sure XAMPP Apache is running and you are opening the site via <code>http://localhost/</code></div></div>`;
    }
    return `<div class="gpt-error-box"><div class="gpt-error-title">⚠️ DermaNova AI Error</div>
      <div class="gpt-error-body">${message}</div></div>`;
}

// ── Global copy helper (attached to window for inline onclick) ──
window._copyGptText = function (btn) {
    const card = btn.closest('.gpt-explanation-card');
    const textEl = card.querySelector('.gpt-explanation-text');
    const text = textEl.innerText || textEl.textContent;
    navigator.clipboard.writeText(text).then(() => {
        btn.title = 'Copied!';
        btn.style.color = 'var(--green)';
        setTimeout(() => {
            btn.title = 'Copy explanation';
            btn.style.color = '';
        }, 2000);
    });
};

// ── CSS injection ─────────────────────────────────────────────
(function injectGptStyles() {
    if (document.getElementById('gpt-styles')) return;
    const style = document.createElement('style');
    style.id = 'gpt-styles';
    style.textContent = `
/* ── GPT Explanation Card ───────────────────── */
.gpt-explanation-card {
  margin-top: 14px;
  background: linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.08) 100%);
  border: 1px solid rgba(124,58,237,0.35);
  border-radius: 16px;
  padding: 18px 20px 14px;
  position: relative;
  overflow: hidden;
}
.gpt-explanation-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1.5px;
  background: linear-gradient(135deg, #7c3aed, #06b6d4, #7c3aed);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: gpt-border-spin 4s linear infinite;
  background-size: 200% 200%;
}
@keyframes gpt-border-spin {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.gpt-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.gpt-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gpt-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #a78bfa;
  background: rgba(124,58,237,0.15);
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid rgba(124,58,237,0.3);
}
.gpt-badge svg { width: 13px; height: 13px; }
.gpt-model-tag {
  font-size: 10.5px;
  color: var(--txt-3);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 3px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.gpt-copy-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  color: var(--txt-3);
  display: flex;
  align-items: center;
  transition: color 0.2s, border-color 0.2s;
}
.gpt-copy-btn:hover { color: var(--accent); border-color: var(--accent); }
.gpt-copy-btn svg { width: 14px; height: 14px; }

/* ── Formatted text output ──────────────────── */
.gpt-explanation-text {
  font-size: 14px;
  line-height: 1.75;
  color: var(--txt-1);
}
.gpt-para    { margin: 0 0 10px; }
.gpt-section-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #a78bfa;
  margin: 14px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(124,58,237,0.2);
}
.gpt-list { margin: 6px 0 10px 18px; padding: 0; list-style: none; }
.gpt-list-item {
  position: relative;
  padding-left: 18px;
  margin-bottom: 6px;
  font-size: 13.5px;
  color: var(--txt-2);
}
.gpt-list-item::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: #7c3aed;
  font-size: 11px;
  top: 2px;
}
.gpt-list-item.gpt-numbered::before {
  content: counter(gpt-counter);
  counter-increment: gpt-counter;
  background: rgba(124,58,237,0.15);
  color: #a78bfa;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  top: 1px;
}
.gpt-list { counter-reset: gpt-counter; }
.gpt-disclaimer {
  margin-top: 14px;
  padding: 10px 14px;
  background: rgba(245,158,11,0.1);
  border-left: 3px solid #f59e0b;
  border-radius: 6px;
  font-size: 12.5px;
  color: #b45309;
  line-height: 1.5;
}

/* ── Typing dots animation ──────────────────── */
.gpt-typing-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 0;
}
.gpt-typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7c3aed;
  opacity: 0.4;
  animation: gpt-pulse 1.2s ease-in-out infinite;
}
.gpt-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.gpt-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
.gpt-thinking-label {
  width: auto !important;
  height: auto !important;
  border-radius: 0 !important;
  background: none !important;
  opacity: 1 !important;
  animation: none !important;
  font-size: 12.5px;
  color: var(--txt-3);
  margin-left: 6px;
}
@keyframes gpt-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.9); }
  50%       { opacity: 1;   transform: scale(1.15); }
}

/* ── Follow-up hint ─────────────────────────── */
.gpt-followup-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(124,58,237,0.18);
  font-size: 12px;
  color: var(--txt-3);
  font-style: italic;
}
.gpt-followup-hint svg { width: 13px; height: 13px; color: #7c3aed; flex-shrink: 0; }

/* ── GPT follow-up bubble (in normal chat flow) */
.msg-bubble.gpt-followup-bubble {
  background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.08));
  border: 1px solid rgba(124,58,237,0.25);
  border-radius: 16px 16px 16px 4px;
}
.msg-avatar.ai { background: linear-gradient(135deg, #7c3aed, #06b6d4); }

/* ── Error boxes ─────────────────────────────── */
.gpt-error-box {
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.3);
  border-left: 3px solid #ef4444;
  border-radius: 10px;
  padding: 14px 16px;
}
.gpt-error-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #ef4444;
  margin-bottom: 8px;
}
.gpt-error-body {
  font-size: 13px;
  color: var(--txt-2);
  line-height: 1.5;
  margin-bottom: 8px;
}
.gpt-error-steps {
  margin: 8px 0 0 18px;
  padding: 0;
  font-size: 13px;
  color: var(--txt-2);
  line-height: 1.8;
}
.gpt-error-steps li { margin-bottom: 2px; }
    `;
    document.head.appendChild(style);
})();
