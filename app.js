// DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleBtn = null; // Removed
const menuBtn = document.getElementById('menuBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatOptionsBtn = document.getElementById('chatOptionsBtn');
const chatOptionsMenu = document.getElementById('chatOptionsMenu');
const plusBtn = document.getElementById('plusBtn');
const plusMenu = document.getElementById('plusMenu');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendMsgBtn');
const messagesDiv = document.getElementById('messagesContainer');
const chatArea = document.getElementById('chatArea');
const welcomeScreen = document.getElementById('welcomeScreen');
const attachPreview = document.getElementById('attachPreview');
const fileUploadInput = document.getElementById('fileUploadInput');
const cameraModal = document.getElementById('cameraModal');
const closeCameraModalBtn = document.getElementById('closeCameraModalBtn');
const cancelCameraBtn = document.getElementById('cancelCameraBtn');
const capturePhotoBtn = document.getElementById('capturePhotoBtn');
const logoutBtn = document.getElementById('logoutBtn');

let cameraStream = null;
let currentAttachments = [];
let conversations = JSON.parse(localStorage.getItem('oncodiag_chats') || '[]');
let activeChatIndex = -1;
let currentUser = JSON.parse(localStorage.getItem('oncodiag_user') || 'null');

// Auth guard — check PHP session first, fallback to localStorage
async function checkAuth() {
  try {
    const res = await fetch('check_session.php');
    const data = await res.json();
    if (data.logged_in) {
      // Session valid — update localStorage with fresh session data
      currentUser = data.user;
      localStorage.setItem('oncodiag_user', JSON.stringify(currentUser));
      updateUserDisplay();
    } else {
      // No server session — redirect to login
      localStorage.removeItem('oncodiag_user');
      window.location.href = 'login.html';
    }
  } catch (e) {
    // XAMPP not running or fetch failed — fallback to localStorage check
    if (!currentUser) {
      window.location.href = 'login.html';
    } else {
      updateUserDisplay();
    }
  }
}

function updateUserDisplay() {
  const nameEls   = document.querySelectorAll('.user-name');
  const emailEls  = document.querySelectorAll('.user-email');
  const avatarEls = document.querySelectorAll('.user-avatar');
  nameEls.forEach(el => el.innerText = currentUser.name || 'User');
  emailEls.forEach(el => el.innerText = currentUser.email || '');
  avatarEls.forEach(el => el.innerText = (currentUser.name || 'U').charAt(0).toUpperCase());
}

checkAuth();

// Sidebar toggle (collapsed and mobile)
const sidebarOverlay = document.getElementById('sidebarOverlay');

function setSidebarState(collapsed) {
  if (window.innerWidth <= 768) {
    if (collapsed) {
      sidebar.classList.remove('mobile-open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    } else {
      sidebar.classList.add('mobile-open');
      if (sidebarOverlay) sidebarOverlay.classList.add('show');
    }
  } else {
    if (collapsed) sidebar.classList.add('collapsed');
    else sidebar.classList.remove('collapsed');
    localStorage.setItem('sidebarCollapsed', collapsed);
  }
}

menuBtn.addEventListener('click', () => {
  if (window.innerWidth <= 768) {
    setSidebarState(sidebar.classList.contains('mobile-open'));
  } else {
    setSidebarState(!sidebar.classList.contains('collapsed'));
  }
});

if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', () => setSidebarState(true));
}

// Ensure proper state on resize
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    sidebar.classList.remove('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
  } else {
    sidebar.classList.remove('collapsed');
  }
});

if (localStorage.getItem('sidebarCollapsed') === 'true' && window.innerWidth > 768) {
  setSidebarState(true);
}

// Plus menu toggle
function closePlusMenu() { plusMenu.classList.remove('open'); }
plusBtn.addEventListener('click', (e) => { e.stopPropagation(); plusMenu.classList.toggle('open'); });
document.addEventListener('click', (e) => { if (!plusBtn.contains(e.target) && !plusMenu.contains(e.target)) closePlusMenu(); });

// Nav menu functions
const dashboardModal = document.getElementById('dashboardModal');
const settingsModal = document.getElementById('settingsModal');

// Compute live analytics from the saved conversation history
function computeDashboardStats() {
  let totalScans = 0;      // messages that carry a real ML analysis
  let highRisk = 0;        // malignant verdicts
  let benign = 0;          // benign verdicts
  let confSum = 0;         // sum of model confidence (0–1)
  let probSum = 0;         // sum of malignancy probability (0–1)

  conversations.forEach(chat => {
    (chat.messages || []).forEach(msg => {
      const a = msg.analysis;
      if (!a || typeof a.prob !== 'number' || isNaN(a.prob)) return;
      totalScans++;
      const prob = a.prob;
      probSum += prob;
      // Verdict: prefer the model's boolean, fall back to a 0.65 cutoff
      const isMalignant = typeof a.malignant === 'boolean' ? a.malignant : prob > 0.65;
      if (isMalignant) highRisk++; else benign++;
      // Confidence = how sure the model is about its chosen verdict
      confSum += isMalignant ? prob : (1 - prob);
    });
  });

  return {
    totalScans,
    highRisk,
    benign,
    totalChats: conversations.length,
    avgConfidence: totalScans ? (confSum / totalScans) * 100 : null,
    avgMalignancy: totalScans ? (probSum / totalScans) * 100 : null
  };
}

function updateDashboardStats() {
  const s = computeDashboardStats();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  set('dashTotalScans', s.totalScans);
  set('dashHighRisk', s.highRisk);
  set('dashTotalChats', s.totalChats);
  set('dashBenign', s.benign);
  set('dashAvgConfidence', s.avgConfidence === null ? '—' : s.avgConfidence.toFixed(1) + '%');
  set('dashAvgMalignancy', s.avgMalignancy === null ? '—' : s.avgMalignancy.toFixed(1) + '%');

  const note = document.getElementById('dashEmptyNote');
  if (note) {
    note.innerText = s.totalScans === 0
      ? 'No scans yet. Upload a skin-lesion image from the chat to start building your analytics.'
      : `Calculated live from ${s.totalScans} scan${s.totalScans === 1 ? '' : 's'} across ${s.totalChats} conversation${s.totalChats === 1 ? '' : 's'}.`;
  }

  // Fetch live feedback count from user_feedback table
  fetch('get_feedback.php')
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        const fbEl = document.getElementById('dashFeedbackCount');
        if (fbEl) fbEl.innerText = data.total || '0';
      }
    }).catch(() => {});
}

document.getElementById('navDashboardBtn')?.addEventListener('click', () => { updateDashboardStats(); dashboardModal.style.display = 'flex'; });
document.getElementById('closeDashboardBtn')?.addEventListener('click', () => { dashboardModal.style.display = 'none'; });

// ── Search Chats modal (opened by the "Search chats" nav item) ──
const searchModal      = document.getElementById('searchModal');
const chatSearchInput  = document.getElementById('chatSearchInput');
const chatSearchClear  = document.getElementById('chatSearchClear');
const searchResults    = document.getElementById('searchResults');

// Escape text before injecting into innerHTML
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
// Highlight the matched term inside an already-escaped string
function highlight(text, term) {
  const safe = escapeHtml(text);
  if (!term) return safe;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
}

// Find the first message whose text contains the term (for a result snippet)
function findSnippet(chat, term) {
  const msgs = chat.messages || [];
  if (term) {
    const hit = msgs.find(m => (m.text || '').toLowerCase().includes(term));
    if (hit) return hit.text;
  }
  // No message match (matched on title, or no term) — show the first message
  return msgs.length ? msgs[0].text : 'No messages yet';
}

function renderSearchResults() {
  if (!searchResults) return;
  const raw  = (chatSearchInput?.value || '').trim();
  const term = raw.toLowerCase();
  searchResults.innerHTML = '';

  // All chats when empty; otherwise only matches (title OR any message text)
  const matches = [];
  conversations.forEach((chat, idx) => {
    if (chatMatchesFilter(chat, term)) matches.push({ chat, idx });
  });

  if (matches.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.innerText = term ? `No chats match “${raw}”` : 'No chats yet.';
    searchResults.appendChild(empty);
    return;
  }

  matches.forEach(({ chat, idx }) => {
    const item = document.createElement('button');
    item.className = 'search-result';
    item.innerHTML =
      `<span class="search-result-title">${highlight(chat.title || 'Untitled chat', term)}</span>` +
      `<span class="search-result-snippet">${highlight(findSnippet(chat, term), term)}</span>`;
    // Clicking a result opens that conversation
    item.addEventListener('click', () => {
      loadChat(idx);
      closeSearchModal();
      if (window.innerWidth <= 768) setSidebarState(true);
    });
    searchResults.appendChild(item);
  });
}

function openSearchModal() {
  if (!searchModal) return;
  if (chatSearchInput) chatSearchInput.value = '';
  renderSearchResults();           // show ALL chats initially
  searchModal.style.display = 'flex';
  setTimeout(() => chatSearchInput?.focus(), 50);
}
function closeSearchModal() {
  if (searchModal) searchModal.style.display = 'none';
}

document.getElementById('navSearchBtn')?.addEventListener('click', openSearchModal);
document.getElementById('closeSearchBtn')?.addEventListener('click', closeSearchModal);
searchModal?.addEventListener('click', (e) => { if (e.target === searchModal) closeSearchModal(); });
chatSearchInput?.addEventListener('input', renderSearchResults);
chatSearchInput?.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSearchModal(); });
chatSearchClear?.addEventListener('click', () => {
  if (chatSearchInput) chatSearchInput.value = '';
  renderSearchResults();
  chatSearchInput?.focus();
});

// ── Appearance preferences (theme + message text size), persisted ──
function applyTheme(theme) {
  document.body.classList.toggle('dark-theme', theme === 'dark');
}
function applyFontSize(size) {
  document.body.classList.remove('font-sm', 'font-md', 'font-lg');
  document.body.classList.add('font-' + (size || 'md'));
}
function loadPreferences() {
  const theme = localStorage.getItem('derma_theme') || 'light';
  const font  = localStorage.getItem('derma_fontsize') || 'md';
  applyTheme(theme);
  applyFontSize(font);
  const ts = document.getElementById('themeSelect');    if (ts) ts.value = theme;
  const fs = document.getElementById('fontSizeSelect'); if (fs) fs.value = font;
}
loadPreferences();

document.getElementById('navSettingsBtn')?.addEventListener('click', () => {
  loadPreferences();   // sync selects to saved values whenever the modal opens
  settingsModal.style.display = 'flex';
});
document.getElementById('closeSettingsBtn')?.addEventListener('click', () => { settingsModal.style.display = 'none'; });
document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
  const theme = document.getElementById('themeSelect')?.value || 'light';
  const font  = document.getElementById('fontSizeSelect')?.value || 'md';
  applyTheme(theme);
  applyFontSize(font);
  localStorage.setItem('derma_theme', theme);
  localStorage.setItem('derma_fontsize', font);
  settingsModal.style.display = 'none';
  showToast('Settings saved.', 'success');
});

// Chat options menu
if (chatOptionsBtn) {
  chatOptionsBtn.addEventListener('click', (e) => { e.stopPropagation(); chatOptionsMenu.classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (!chatOptionsBtn.contains(e.target) && !chatOptionsMenu.contains(e.target)) chatOptionsMenu.classList.remove('open'); });

  document.getElementById('optShare')?.addEventListener('click', () => { openShareModal(); chatOptionsMenu.classList.remove('open'); });
  document.getElementById('optPin')?.addEventListener('click', () => { alert('Chat pinned!'); chatOptionsMenu.classList.remove('open'); });
  document.getElementById('optHelp')?.addEventListener('click', () => { openHelpModal(); chatOptionsMenu.classList.remove('open'); });
  document.getElementById('optDelete')?.addEventListener('click', () => {
    if (conversations[activeChatIndex]) { conversations[activeChatIndex].messages = []; renderMessages([]); saveConversations(); }
    chatOptionsMenu.classList.remove('open');
  });
}

// ========= SHARE MODAL =========
const shareModal = document.getElementById('shareModal');

// Build a plain-text transcript of the active chat for sharing
function buildShareText() {
  const chat = conversations[activeChatIndex];
  const title = (chat && chat.title) || 'DermaNova AI chat';
  let body = `DermaNova AI — ${title}\n\n`;
  if (chat && chat.messages && chat.messages.length) {
    chat.messages.forEach(m => {
      const who = m.sender === 'user' ? 'Me' : 'DermaNova AI';
      body += `${who}: ${m.text}\n`;
    });
  } else {
    body += '(No messages yet.)\n';
  }
  body += `\nShared from DermaNova AI`;
  return { title, body };
}

function openShareModal() {
  if (shareModal) shareModal.style.display = 'flex';
}
function closeShareModal() {
  if (shareModal) shareModal.style.display = 'none';
}

document.getElementById('closeShareBtn')?.addEventListener('click', closeShareModal);
shareModal?.addEventListener('click', (e) => { if (e.target === shareModal) closeShareModal(); });

document.getElementById('shareGmail')?.addEventListener('click', () => {
  const { title, body } = buildShareText();
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`, '_blank');
  closeShareModal();
});
document.getElementById('shareWhatsapp')?.addEventListener('click', () => {
  const { body } = buildShareText();
  window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, '_blank');
  closeShareModal();
});
document.getElementById('shareEmail')?.addEventListener('click', () => {
  const { title, body } = buildShareText();
  window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  closeShareModal();
});
document.getElementById('shareTelegram')?.addEventListener('click', () => {
  const { body } = buildShareText();
  window.open(`https://t.me/share/url?url=${encodeURIComponent('https://dermanova.ai')}&text=${encodeURIComponent(body)}`, '_blank');
  closeShareModal();
});
document.getElementById('shareCopy')?.addEventListener('click', async () => {
  const { body } = buildShareText();
  try {
    await navigator.clipboard.writeText(body);
    alert('Chat copied to clipboard!');
  } catch (e) {
    // Fallback for browsers/contexts without clipboard API
    const ta = document.createElement('textarea');
    ta.value = body; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); alert('Chat copied to clipboard!'); }
    catch (e2) { alert('Could not copy automatically. Please copy manually.'); }
    document.body.removeChild(ta);
  }
  closeShareModal();
});
document.getElementById('shareNative')?.addEventListener('click', async () => {
  const { title, body } = buildShareText();
  if (navigator.share) {
    try { await navigator.share({ title, text: body }); } catch (e) { /* user cancelled */ }
  } else {
    alert('Your browser does not support the native share sheet. Try one of the other options.');
  }
  closeShareModal();
});

// ========= HELP MODAL =========
const helpModal = document.getElementById('helpModal');
function openHelpModal() {
  document.getElementById('userDropdown')?.classList.remove('open');
  if (helpModal) helpModal.style.display = 'flex';
}
function closeHelpModal() {
  if (helpModal) helpModal.style.display = 'none';
}
document.getElementById('closeHelpBtn')?.addEventListener('click', closeHelpModal);
helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) closeHelpModal(); });
document.getElementById('helpBtn')?.addEventListener('click', (e) => { e.stopPropagation(); openHelpModal(); });

// File upload
document.getElementById('uploadFileOption').addEventListener('click', () => { fileUploadInput.click(); closePlusMenu(); });
document.getElementById('takePhotoOption').addEventListener('click', () => { openCameraModal(); closePlusMenu(); });
fileUploadInput.addEventListener('change', (e) => {
  Array.from(e.target.files).forEach(file => addAttachment(file));
  fileUploadInput.value = '';
});

// Lightweight toast for image-quality feedback (no external CSS needed)
function showToast(message, type = 'error') {
  const colors = type === 'error'
    ? { bg: '#fdecea', fg: '#b42318', bd: '#f5c2bd' }
    : { bg: '#eaf7ef', fg: '#1a7a4a', bd: '#bfe6cd' };
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText =
    `position:fixed; left:50%; top:22px; transform:translateX(-50%) translateY(-8px);
     max-width:min(440px,92vw); z-index:9999; padding:13px 18px; border-radius:14px;
     font-family:'Inter',sans-serif; font-size:13.5px; font-weight:500; line-height:1.45;
     background:${colors.bg}; color:${colors.fg}; border:1px solid ${colors.bd};
     box-shadow:0 10px 30px rgba(16,42,77,0.14); opacity:0; transition:opacity .25s, transform .25s; text-align:center;`;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(-8px)';
    setTimeout(() => t.remove(), 300);
  }, 4200);
}

// Reject photos that are too blurry / out of focus or taken from too far away.
// Returns a Promise resolving to { ok:boolean, reason:string }.
function analyzeImageQuality(dataURL) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      // Reject only very low-resolution images outright
      if (img.width < 64 || img.height < 64) {
        return resolve({ ok: false, reason: 'This image is too small / low-resolution. Please upload a clearer, higher-resolution photo.' });
      }

      // Downscale to a fixed analysis size for consistent, fast scoring
      const A = 320;
      const scale = Math.min(1, A / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);

      let data;
      try { data = ctx.getImageData(0, 0, w, h).data; }
      catch (e) { return resolve({ ok: true, reason: '' }); } // can't analyze (e.g. CORS) → don't block

      // Grayscale luminance buffer
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // Laplacian focus measure (variance) + edge density over the interior
      let sum = 0, sumSq = 0, count = 0, edges = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const lap = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
          sum += lap; sumSq += lap * lap; count++;
          if (Math.abs(lap) > 18) edges++;
        }
      }
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;   // focus score — low = blurry
      const edgeDensity = edges / count;              // detail score — low = far/empty

      // Lenient: only reject clearly unusable photos (esp. camera captures pass easily)
      const BLUR_MIN = 16;      // Laplacian variance below this → out of focus
      const FAR_MIN  = 0.004;   // edge density below this → subject too distant

      if (variance < BLUR_MIN) {
        return resolve({ ok: false, reason: 'The image looks blurry or out of focus. Please hold the camera steady and upload a sharper photo.' });
      }
      if (edgeDensity < FAR_MIN) {
        return resolve({ ok: false, reason: 'The subject appears too far away or lacks detail. Please move closer so the lesion fills the frame, then try again.' });
      }
      resolve({ ok: true, reason: '' });
    };
    img.onerror = () => resolve({ ok: true, reason: '' }); // can't load → don't block
    img.src = dataURL;
  });
}

function addAttachment(file) {
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const fullURL = ev.target.result;

      // Quality gate: refuse blurry / too-distant images before they reach the model
      const quality = await analyzeImageQuality(fullURL);
      if (!quality.ok) {
        showToast(quality.reason, 'error');
        return;
      }

      // Push immediately with the full image for on-screen display…
      const att = { type: 'image', file, dataURL: fullURL, thumb: null, name: file.name };
      currentAttachments.push(att);
      renderAttachments();
      updateButtonStyles();
      // …then generate a small thumbnail used for localStorage persistence
      makeThumb(fullURL, 160).then(thumb => { att.thumb = thumb; });
    };
    reader.readAsDataURL(file);
  } else {
    currentAttachments.push({ type: 'doc', file, name: file.name });
    renderAttachments();
    updateButtonStyles();
  }
}

// Downscale a dataURL to a small JPEG thumbnail (keeps localStorage tiny)
function makeThumb(dataURL, max) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      try { resolve(c.toDataURL('image/jpeg', 0.6)); } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

function renderAttachments() {
  attachPreview.innerHTML = '';
  currentAttachments.forEach((att, idx) => {
    const div = document.createElement('div');
    div.className = 'attach-thumb';
    if (att.dataURL) {
      const img = document.createElement('img');
      img.src = att.dataURL;
      div.appendChild(img);
    } else {
      div.innerText = '📄';
      div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'center';
      div.style.fontSize = '26px';
    }
    const removeBtn = document.createElement('button');
    removeBtn.innerText = '✕';
    removeBtn.className = 'remove-attach';
    removeBtn.onclick = () => { currentAttachments.splice(idx, 1); renderAttachments(); updateButtonStyles(); };
    div.appendChild(removeBtn);
    attachPreview.appendChild(div);
  });
}

// Camera functions
async function openCameraModal() {
  cameraModal.style.display = 'flex';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraStream = stream;
    document.getElementById('cameraStream').srcObject = stream;
  } catch (err) { alert('Camera not available'); closeCameraModal(); }
}
function closeCameraModal() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  cameraModal.style.display = 'none';
}
capturePhotoBtn.addEventListener('click', () => {
  const video = document.getElementById('cameraStream');
  const canvas = document.getElementById('cameraCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (blob) {
      const file = new File([blob], 'camera_photo.jpg', { type: 'image/jpeg' });
      addAttachment(file);
    }
    closeCameraModal();
  }, 'image/jpeg');
});
closeCameraModalBtn.addEventListener('click', closeCameraModal);
cancelCameraBtn.addEventListener('click', closeCameraModal);

// Animated button: change color when input has text OR attachments
function updateButtonStyles() {
  const hasContent = chatInput.value.trim().length > 0 || currentAttachments.length > 0;
  if (hasContent) {
    sendBtn.classList.add('active');
    plusBtn.classList.add('active');
  } else {
    sendBtn.classList.remove('active');
    plusBtn.classList.remove('active');
  }
}
chatInput.addEventListener('input', updateButtonStyles);

// Chat history functions

// Does a chat match the search term? Searches the title AND every message's text.
function chatMatchesFilter(chat, term) {
  if (!term) return true;
  if ((chat.title || '').toLowerCase().includes(term)) return true;
  return (chat.messages || []).some(m => (m.text || '').toLowerCase().includes(term));
}

function updateHistoryUI() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;
  historyList.innerHTML = '';
  // conversations is unshifted, so index 0 is newest
  conversations.forEach((chat, idx) => {
    const div = document.createElement('div');
    div.className = `hist-item ${activeChatIndex === idx ? 'active' : ''}`;
    div.innerHTML = `<span class="hist-text">${chat.title}</span><button class="hist-del" data-idx="${idx}">✕</button>`;
    div.onclick = (e) => { if (!e.target.classList.contains('hist-del')) loadChat(idx); };
    div.querySelector('.hist-del').onclick = (e) => { e.stopPropagation(); deleteChat(idx); };
    historyList.appendChild(div);
  });
}

// Build a storage-safe copy: replace heavy full-res images with tiny thumbnails
function _slimForStorage() {
  return conversations.map(c => ({
    ...c,
    messages: (c.messages || []).map(m => ({
      ...m,
      attachments: (m.attachments || []).map(a => ({
        name: a.name,
        // persist only the small thumbnail (or nothing) — never the full base64 image
        dataURL: a.thumb || undefined
      }))
    }))
  }));
}

function saveConversations() {
  try {
    localStorage.setItem('oncodiag_chats', JSON.stringify(_slimForStorage()));
  } catch (e) {
    // Quota still exceeded (very long history) — drop oldest chats until it fits
    const slim = _slimForStorage();
    while (slim.length > 1) {
      slim.pop(); // newest is at index 0, so this removes the oldest
      try { localStorage.setItem('oncodiag_chats', JSON.stringify(slim)); break; }
      catch (e2) { /* keep trimming */ }
    }
  }
  updateHistoryUI();
}

function loadChat(index) {
  activeChatIndex = index;
  const chat = conversations[index];
  renderMessages(chat.messages);
  document.getElementById('topbarTitle').innerText = chat.title;
  updateHistoryUI();
}

function deleteChat(index) {
  conversations.splice(index, 1);
  if (conversations.length === 0) {
    newChatSession();
  } else {
    activeChatIndex = 0;
    loadChat(0);
  }
  saveConversations();
}

function newChatSession(title = null) {
  const newChat = {
    id: Date.now(),
    title: title || `Case ${new Date().toLocaleTimeString()}`,
    messages: []
  };
  conversations.unshift(newChat);
  activeChatIndex = 0;
  renderMessages([]);
  saveConversations();
  document.getElementById('topbarTitle').innerText = newChat.title;
  welcomeScreen.style.display = 'flex';
  messagesDiv.style.display = 'none';
  currentAttachments = [];
  renderAttachments();
  chatInput.value = '';
  updateButtonStyles();
  // Reset GPT conversation context for fresh session
  if (typeof resetConversation === 'function') resetConversation();
}

function renderMessages(messages) {
  messagesDiv.innerHTML = '';
  if (!messages.length) {
    welcomeScreen.style.display = 'flex';
    messagesDiv.style.display = 'none';
  } else {
    welcomeScreen.style.display = 'none';
    messagesDiv.style.display = 'flex';
    messages.forEach((msg, i) => addMessageToUI(msg, i));
    // Always scroll to the latest message
    setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; updateScrollBtn(); }, 50);
  }
}

// Format a timestamp (ms) as a short local time, e.g. "10:30 AM"
function formatTime(ms) {
  try { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return ''; }
}

// Copy the text of an AI message (bubble + any GPT explanation)
function copyMessageText(contentDiv, btn) {
  const parts = [];
  const b = contentDiv.querySelector('.msg-bubble'); if (b) parts.push(b.innerText);
  const g = contentDiv.querySelector('.gpt-explanation-text'); if (g) parts.push(g.innerText);
  const out = parts.join('\n\n').trim();
  navigator.clipboard.writeText(out).then(() => {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 1500);
  }).catch(() => showToast('Could not copy to clipboard.', 'error'));
}

// Build the copy/feedback + timestamp row under a message (re-usable after streaming)
function appendMessageMeta(contentDiv, msg) {
  const existing = contentDiv.querySelector('.msg-meta');
  if (existing) existing.remove();

  const sender   = msg.sender;
  const text     = msg.text || '';
  const analysis = msg.analysis || null;
  // Skip actions on transient "thinking" bubbles (processing steps end with "…")
  const isTransient = sender === 'ai' && !analysis && (text === '…' || /…\s*$/.test(text));

  const meta = document.createElement('div');
  meta.className = 'msg-meta';

  if (sender === 'ai' && !isTransient) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-act copy';
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.onclick = () => copyMessageText(contentDiv, copyBtn);

    const upBtn = document.createElement('button');
    upBtn.className = 'msg-act up' + (msg.feedback === 'up' ? ' active' : '');
    upBtn.title = 'Good response';
    upBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';

    const downBtn = document.createElement('button');
    downBtn.className = 'msg-act down' + (msg.feedback === 'down' ? ' active' : '');
    downBtn.title = 'Bad response';
    downBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';

    const setFeedback = async (val) => {
      const newRating = (msg.feedback === val) ? null : val;
      msg.feedback = newRating;
      upBtn.classList.toggle('active', msg.feedback === 'up');
      downBtn.classList.toggle('active', msg.feedback === 'down');
      saveConversations();

      if (newRating) {
        // Show notification toast explaining how feedback helps the model learn
        const toastMsg = newRating === 'up'
          ? '👍 Feedback recorded! Your rating helps fine-tune and improve DermaNova AI diagnostic models.'
          : '👎 Feedback recorded! Your input helps train and refine future DermaNova AI model updates.';
        showToast(toastMsg, 'success');

        // Persist feedback to MySQL database for model retraining
        try {
          const formData = new FormData();
          formData.append('rating', newRating);
          formData.append('message_text', msg.text || '');
          const chat = conversations[activeChatIndex];
          formData.append('chat_title', (chat && chat.title) || '');
          fetch('save_feedback.php', { method: 'POST', body: formData });
        } catch(e) { /* ignore network error */ }
      }
    };
    upBtn.onclick   = () => setFeedback('up');
    downBtn.onclick = () => setFeedback('down');

    meta.append(copyBtn, upBtn, downBtn);
  }

  if (msg.time) {
    const t = document.createElement('span');
    t.className = 'msg-time';
    t.textContent = formatTime(msg.time);
    meta.appendChild(t);
  }
  if (meta.children.length) contentDiv.appendChild(meta);
}

function addMessageToUI(msg, index) {
  const text        = msg.text;
  const sender      = msg.sender;
  const attachments = msg.attachments || [];
  const analysis    = msg.analysis || null;

  const row = document.createElement('div');
  row.className = `msg-row ${sender}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'msg-content';
  const bubble = document.createElement('div');
  bubble.className = `msg-bubble${sender === 'ai' && !analysis ? ' gpt-followup-bubble' : ''}`;
  bubble.innerText = text;
  contentDiv.appendChild(bubble);
  if (attachments && attachments.length) {
    const gallery = document.createElement('div');
    gallery.style.display = 'flex'; gallery.style.gap = '10px'; gallery.style.marginTop = '10px';
    attachments.forEach(att => {
      if (att.dataURL) {
        const img = document.createElement('img');
        img.src = att.dataURL; img.style.width = '70px'; img.style.height = '70px'; img.style.objectFit = 'cover';
        img.style.borderRadius = '14px';
        gallery.appendChild(img);
      }
    });
    contentDiv.appendChild(gallery);
  }
  if (analysis) {
    let riskColor, riskLabel;
    if (typeof analysis.malignant === 'boolean') {
      // Real model: colour by the binary verdict, not arbitrary cutoffs
      riskColor = analysis.malignant ? 'var(--red)' : 'var(--green)';
      riskLabel = analysis.malignant ? 'Malignant' : 'Benign';
    } else {
      riskColor = analysis.prob > 0.65 ? 'var(--red)' : analysis.prob > 0.4 ? '#f59e0b' : 'var(--green)';
      riskLabel = analysis.prob > 0.65 ? 'High Risk' : analysis.prob > 0.4 ? 'Moderate Risk' : 'Low Risk';
    }
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:10px;">
        <div style="font-size:28px; font-weight:800; color:${riskColor};">${Math.round(analysis.prob * 100)}%</div>
        <div style="font-size:13px; font-weight:600; color:${riskColor}; background:${riskColor}22; padding:3px 10px; border-radius:20px;">${riskLabel}</div>
        ${analysis.imageCount > 1 ? `<div style="font-size:12px; font-weight:600; color:var(--txt-3); margin-left:auto;">avg · ${analysis.imageCount} images</div>` : ''}
      </div>
      <div style="height:6px; background:var(--border); border-radius:3px; overflow:hidden; margin-bottom:12px;">
        <div style="width:${analysis.prob * 100}%; height:100%; background:linear-gradient(90deg, ${riskColor}, ${riskColor}99); border-radius:3px; transition:width 0.8s ease;"></div>
      </div>
      <div style="font-size:13px; color:var(--txt-2); line-height:1.5;">${analysis.label ? '<strong>' + analysis.label + '</strong> — ' : ''}${analysis.summary}</div>`;
    contentDiv.appendChild(card);
  }

  appendMessageMeta(contentDiv, msg);

  row.appendChild(contentDiv);
  messagesDiv.appendChild(row);
  chatArea.scrollTop = chatArea.scrollHeight;
  // Return contentDiv so callers can append GPT explanation card
  return contentDiv;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text && currentAttachments.length === 0) return;
  if (conversations.length === 0 || activeChatIndex === -1) newChatSession();
  const chat = conversations[activeChatIndex];
  const userAttachments = currentAttachments.map(a => ({ dataURL: a.dataURL, thumb: a.thumb, name: a.name }));
  const userMsg = { text: text || 'Attached file(s)', sender: 'user', attachments: userAttachments, time: Date.now() };
  chat.messages.push(userMsg);
  renderMessages(chat.messages);
  
  // Disable input while thinking
  chatInput.disabled = true;
  sendBtn.disabled = true;
  chatInput.placeholder = 'Processing...';
  chatInput.value = '';
  chatInput.style.height = 'auto';
  const sentAttachments = [...currentAttachments];
  currentAttachments = [];
  renderAttachments();
  updateButtonStyles();

  const hasImages = sentAttachments.some(a => a.type === 'image');
  const gptAvailable = typeof generateDermaExplanation === 'function';

  // ── Branch A: Image uploaded → real ML prediction → GPT explanation ──
  if (hasImages) {
    // Live processing steps shown while the Python model runs (mirrors clean.py pipeline)
    const PROC_STEPS = [
      'Receiving image…',
      'Cleaning image — removing hair & ruler marks…',
      'Reducing glare & denoising…',
      'Enhancing contrast (CLAHE) & sharpening…',
      'Running EfficientNetV2 model…',
      'Computing malignancy probability…'
    ];

    // Show first step as the AI "thinking" bubble
    const mlThinkingMsg = { text: PROC_STEPS[0], sender: 'ai', attachments: [], analysis: null };
    chat.messages.push(mlThinkingMsg);
    renderMessages(chat.messages);

    // Animate through the steps while we wait for the server
    let _stepIdx = 0;
    const _lastBubble = () => {
      const b = messagesDiv.querySelectorAll('.msg-row.ai .msg-bubble');
      return b.length ? b[b.length - 1] : null;
    };
    const stepTimer = setInterval(() => {
      _stepIdx = Math.min(_stepIdx + 1, PROC_STEPS.length - 1);
      const bub = _lastBubble();
      if (bub) bub.innerText = PROC_STEPS[_stepIdx];
      if (chat.messages.length) chat.messages[chat.messages.length - 1].text = PROC_STEPS[_stepIdx];
    }, 850);

    // Every uploaded image is analyzed — not just the first one
    const imageAtts = sentAttachments.filter(a => a.type === 'image');

    // Update the live "thinking" bubble + the stored message text together
    const setThinking = (txt) => {
      const bub = _lastBubble();
      if (bub) bub.innerText = txt;
      if (chat.messages.length) chat.messages[chat.messages.length - 1].text = txt;
    };

    // Minimum time the processing animation stays on screen, so the result
    // doesn't pop in instantly and the pipeline steps are actually readable.
    const PROC_MIN_MS = 2600;
    const procStart = Date.now();

    try {
      // 1. Predict on EACH image via the PHP proxy, collecting every result
      const results = [];
      for (let i = 0; i < imageAtts.length; i++) {
        const imageAtt = imageAtts[i];

        // With multiple images, take over the bubble to show per-image progress
        if (imageAtts.length > 1) {
          clearInterval(stepTimer);
          setThinking(`Analyzing image ${i + 1} of ${imageAtts.length}…`);
        }

        const formData = new FormData();
        formData.append('image', imageAtt.file, imageAtt.name || `lesion_${i + 1}.jpg`);

        const res = await fetch('predict.php', { method: 'POST', body: formData });
        let data;
        try { data = await res.json(); }
        catch (e) { throw new Error('Prediction server error — is the Python API (app.py) running on port 5000?'); }
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

        results.push({
          prob:      Number(data.probability_malignant),
          malignant: data.prediction === 'Malignant',
          label:     data.prediction,
          thr:       Number(data.threshold_used),
          name:      imageAtt.name || `image ${i + 1}`
        });
      }
      clearInterval(stepTimer);   // all predictions done — stop the step animation

      // Hold the animation for a short, consistent moment before revealing the result
      const elapsed = Date.now() - procStart;
      if (elapsed < PROC_MIN_MS) {
        setThinking('Finalizing results…');
        await new Promise(r => setTimeout(r, PROC_MIN_MS - elapsed));
      }

      // 2. Aggregate across all images — average malignancy probability
      const n         = results.length;
      const prob      = results.reduce((s, r) => s + r.prob, 0) / n;   // mean probability
      const thr       = results[n - 1].thr;                           // threshold (same for every call)
      const malignant = prob >= thr;                                  // verdict on the aggregate
      const label     = malignant ? 'Malignant' : 'Benign';
      const flagged   = results.filter(r => r.malignant).length;      // individual malignant images

      let summary;
      if (n === 1) {
        summary = malignant
          ? `Model flags this lesion as malignant (probability ${(prob * 100).toFixed(1)}% ≥ threshold ${(thr * 100).toFixed(0)}%). Dermatoscopy and biopsy recommended.`
          : `Model classifies this lesion as benign (probability ${(prob * 100).toFixed(1)}% < threshold ${(thr * 100).toFixed(0)}%). Routine follow-up advised.`;
      } else {
        const perImg = results.map((r, i) => `#${i + 1}: ${(r.prob * 100).toFixed(1)}% (${r.label})`).join(', ');
        summary = `Aggregate of ${n} images — average malignancy probability ${(prob * 100).toFixed(1)}% ` +
          `(${malignant ? '≥' : '<'} threshold ${(thr * 100).toFixed(0)}%); ${flagged} of ${n} image${flagged === 1 ? '' : 's'} individually flagged malignant. ` +
          (malignant ? 'Dermatoscopy and biopsy recommended. ' : 'Routine follow-up advised. ') +
          `Per-image: ${perImg}.`;
      }

      const analysis = {
        prob, label, summary, malignant, threshold: thr,
        imageCount: n,
        perImage: results.map(r => ({ prob: r.prob, label: r.label, name: r.name }))
      };
      const mlResponse = n > 1
        ? `ML model analysis complete — aggregate ${label} across ${n} images (${(prob * 100).toFixed(1)}% avg malignant probability)`
        : `ML model analysis complete — ${label} (${(prob * 100).toFixed(1)}% malignant probability)`;

      chat.messages[chat.messages.length - 1] = { text: mlResponse, sender: 'ai', attachments: [], analysis, time: Date.now() };
      renderMessages(chat.messages);
      saveConversations();

      // 3. GPT explains the real (aggregate) result
      if (gptAvailable) {
        const allContentDivs = messagesDiv.querySelectorAll('.msg-row.ai .msg-content');
        const lastAiContent  = allContentDivs[allContentDivs.length - 1];
        if (lastAiContent) {
          await generateDermaExplanation(
            { label, prob, malignant, threshold: thr, imageCount: n, userText: text },
            lastAiContent
          );
        }
      }
    } catch (err) {
      clearInterval(stepTimer);   // stop the step animation on error too
      chat.messages[chat.messages.length - 1] = {
        text: err.message,
        sender: 'ai', attachments: [], analysis: null, time: Date.now()
      };
      renderMessages(chat.messages);
      saveConversations();
    }

    // Re-enable input
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.placeholder = 'Ask DermaNova AI...';
    chatInput.focus();

  // ── Branch B: Text only → conversational GPT follow-up ──
  } else if (gptAvailable) {
    // Show placeholder bubble while GPT thinks
    const placeholderMsg = { text: '…', sender: 'ai', attachments: [], analysis: null };
    chat.messages.push(placeholderMsg);
    renderMessages(chat.messages);

    const allContentDivs = messagesDiv.querySelectorAll('.msg-row.ai .msg-content');
    const lastAiContent  = allContentDivs[allContentDivs.length - 1];

    // chatWithDermaAI renders text directly into the bubble
    const reply = await chatWithDermaAI(text, lastAiContent);

    // Update stored message with real reply + add copy/feedback actions
    const aiMsgRef = chat.messages[chat.messages.length - 1];
    aiMsgRef.text = reply;
    aiMsgRef.time = Date.now();
    if (lastAiContent) appendMessageMeta(lastAiContent, aiMsgRef);
    saveConversations();

    // Re-enable input
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.placeholder = 'Ask DermaNova AI...';
    chatInput.focus();

  // ── Branch C: GPT not loaded — static fallback ──
  } else {
    const responseText = text
      ? 'Please attach a medical image so DermaNova AI can analyze it.'
      : 'Please attach medical images or describe specific symptoms.';
    const aiMsg = { text: responseText, sender: 'ai', attachments: [], analysis: null, time: Date.now() };
    chat.messages.push(aiMsg);
    renderMessages(chat.messages);
    saveConversations();
  }

  // Auto-title the chat after first exchange
  if (chat.messages.length === 2 && chat.title.startsWith('Case')) {
    chat.title = hasImages
      ? `Scan_${Math.floor(Math.random() * 9000 + 1000)}`
      : text.slice(0, 30) + (text.length > 30 ? '…' : '');
    saveConversations();
    document.getElementById('topbarTitle').innerText = chat.title;
  }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
newChatBtn.addEventListener('click', () => newChatSession());
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('oncodiag_user');
  window.location.href = 'logout.php'; // Destroys PHP session + redirects to login
});

// Auto-resize textarea
chatInput.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 140) + 'px';
  updateButtonStyles();
});
chatInput.style.height = '56px';

// User Dropdown toggle
const userCard = document.getElementById('userCard');
const userDropdown = document.getElementById('userDropdown');

if (userCard && userDropdown) {
  document.addEventListener('click', (e) => {
    if (!userCard.contains(e.target)) userDropdown.classList.remove('open');
  });
}

// Initial load
if (conversations.length === 0) newChatSession();
else loadChat(0);
updateButtonStyles();

// ========= PROFILE MODAL =========
const profileModal     = document.getElementById('profileModal');
const closeProfileBtn  = document.getElementById('closeProfileBtn');
const cancelProfileBtn = document.getElementById('cancelProfileBtn');
const saveProfileBtn   = document.getElementById('saveProfileBtn');
const profileNameInput = document.getElementById('profileNameInput');
const profileEmailInput= document.getElementById('profileEmailInput');
const profileMsg       = document.getElementById('profileMsg');

function openProfileModal() {
  // Pre-fill with current user data
  profileNameInput.value  = currentUser?.name  || '';
  profileEmailInput.value = currentUser?.email || '';
  document.getElementById('profileAvatarLg').innerText   = (currentUser?.name || 'U').charAt(0).toUpperCase();
  document.getElementById('profileAvatarName').innerText = currentUser?.name || 'User';
  profileMsg.style.display = 'none';
  profileMsg.className = 'profile-msg';
  profileModal.style.display = 'flex';
  // Close dropdown
  document.getElementById('userDropdown')?.classList.remove('open');
}

function closeProfileModal() {
  profileModal.style.display = 'none';
}

closeProfileBtn?.addEventListener('click', closeProfileModal);
cancelProfileBtn?.addEventListener('click', closeProfileModal);
profileModal?.addEventListener('click', (e) => { if (e.target === profileModal) closeProfileModal(); });

// Open on Profile button click in dropdown
document.querySelector('.ud-item:not(.text-red)')?.addEventListener('click', openProfileModal);

// Save profile
saveProfileBtn?.addEventListener('click', async () => {
  const newName  = profileNameInput.value.trim();
  const newEmail = profileEmailInput.value.trim();

  if (!newName || !newEmail) {
    showProfileMsg('error', '⚠️ Both fields are required.');
    return;
  }

  saveProfileBtn.disabled = true;
  saveProfileBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:8px;vertical-align:middle;"></span>Saving...';

  try {
    const formData = new FormData();
    formData.append('name', newName);
    formData.append('email', newEmail);

    const res  = await fetch('update_profile.php', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      currentUser = { ...currentUser, ...data.user };
      localStorage.setItem('oncodiag_user', JSON.stringify(currentUser));
      updateUserDisplay();
      document.getElementById('profileAvatarLg').innerText   = newName.charAt(0).toUpperCase();
      document.getElementById('profileAvatarName').innerText = newName;
      showProfileMsg('success', '✅ Profile updated successfully!');
      setTimeout(closeProfileModal, 1200);
    } else {
      showProfileMsg('error', '❌ ' + data.message);
    }
  } catch (err) {
    showProfileMsg('error', '❌ Network error. Make sure XAMPP is running.');
  }

  saveProfileBtn.disabled = false;
  saveProfileBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save Changes';
});

function showProfileMsg(type, text) {
  profileMsg.className = 'profile-msg ' + type;
  profileMsg.innerText = text;
  profileMsg.style.display = 'block';
}

// ========= SUGGESTED PROMPT STARTERS (welcome screen) =========
document.getElementById('promptStarters')?.addEventListener('click', (e) => {
  const chip = e.target.closest('.starter-chip');
  if (!chip) return;
  const prompt = chip.dataset.prompt || chip.innerText;
  chatInput.value = prompt;
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
  updateButtonStyles();
  chatInput.focus();
});

// ========= SCROLL-TO-BOTTOM BUTTON =========
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
function updateScrollBtn() {
  if (!scrollBottomBtn) return;
  const distance = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
  scrollBottomBtn.classList.toggle('show', distance > 240);
}
chatArea.addEventListener('scroll', updateScrollBtn);
scrollBottomBtn?.addEventListener('click', () => {
  chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
});

// ========= VOICE INPUT (disabled) =========
(function initVoiceInput() {
  const micBtn = document.getElementById('micBtn');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!micBtn || !SR) return;

  micBtn.style.display = 'flex';
  const recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  let listening = false;
  let baseText = '';

  micBtn.addEventListener('click', () => {
    if (listening) { recognition.stop(); return; }
    baseText = chatInput.value ? chatInput.value.trimEnd() + ' ' : '';
    try { recognition.start(); } catch (e) { /* already starting */ }
  });

  recognition.onstart = () => { listening = true; micBtn.classList.add('listening'); micBtn.title = 'Stop listening'; };
  recognition.onend   = () => { listening = false; micBtn.classList.remove('listening'); micBtn.title = 'Voice input'; };
  recognition.onerror = () => { listening = false; micBtn.classList.remove('listening'); };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    chatInput.value = baseText + transcript;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
    updateButtonStyles();
  };
})();