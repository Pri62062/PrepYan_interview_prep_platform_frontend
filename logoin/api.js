/* =============================================
   PrepYan — api.js
   Production API client — handles Render cold start
   Replace your existing app.js / api calls with this
   ============================================= */

/* 🔧 APNA RENDER URL YAHAN DAALO */
const BACKEND = 'https://interview-prep-7s2n.onrender.com';
const API     = `${BACKEND}/api`;

/* ══════════════════════════════════════════
   COLD START HANDLER
   Render free tier 15 min baad so jaata hai.
   Pehli request pe 50-90 sec lag sakti hai.
   Yeh code:
   1. Page load pe backend ping karta hai
   2. Ek purple banner dikhata hai agar slow
   3. Button deta hai retry ke liye
   ══════════════════════════════════════════ */
const ColdStart = {
  banner: null,
  timer:  null,
  done:   false,

  init() {
    // Banner inject karo
    this.banner = document.createElement('div');
    this.banner.id = 'coldStartBanner';
    this.banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
      'background:#4f46e5', 'color:white', 'font-size:13px', 'font-weight:600',
      'padding:10px 20px', 'text-align:center', 'display:none',
      "font-family:'DM Sans',system-ui,sans-serif", 'letter-spacing:.1px',
      'box-shadow:0 2px 8px rgba(0,0,0,.2)'
    ].join(';');

    this.banner.innerHTML = `
      ⏳ Server is starting up — this takes ~30 seconds on first load…
      <button onclick="ColdStart.retry()" style="
        margin-left:12px; padding:4px 12px; background:white; color:#4f46e5;
        border:none; border-radius:5px; font-size:12px; font-weight:700; cursor:pointer;
      ">Retry now</button>
    `;
    document.body.appendChild(this.banner);

    // 3 seconds ke baad banner dikhao
    this.timer = setTimeout(() => {
      if (!this.done) this.banner.style.display = 'block';
    }, 3000);

    // Ping backend
    this.ping();
  },

  async ping() {
    try {
      const r = await fetch(`${API}/health`, {
        signal: AbortSignal.timeout(90000)
      });
      if (r.ok) this.hide();
    } catch(e) {
      // Backend still sleeping — banner already visible
      console.warn('Backend not ready yet:', e.message);
    }
  },

  hide() {
    this.done = true;
    clearTimeout(this.timer);
    if (this.banner) this.banner.style.display = 'none';
  },

  retry() {
    this.banner.innerHTML = `⏳ Retrying…`;
    this.ping().then(() => {
      if (!this.done) {
        this.banner.innerHTML = `
          ⏳ Still starting up — please wait ~30 more seconds…
          <button onclick="location.reload()" style="margin-left:12px;padding:4px 12px;background:white;color:#4f46e5;border:none;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer">Reload page</button>
        `;
      }
    });
  }
};

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => ColdStart.init());

/* ══════════════════════════════════════════
   HTTP CLIENT
   ══════════════════════════════════════════ */
const http = {
  _headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token') ||
                  localStorage.getItem('admin_token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },

  async request(method, path, body = null, timeoutMs = 90000) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const opts = {
        method,
        headers: this._headers(),
        signal:  controller.signal,
      };
      if (body) opts.body = JSON.stringify(body);

      const res = await fetch(`${API}${path}`, opts);
      clearTimeout(timeoutId);

      // 401 → logout
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('admin_token');
        window.location.href = 'login.html';
        return null;
      }

      // 502/503 → backend still starting
      if (res.status === 502 || res.status === 503) {
        throw new Error('Server is starting up. Please wait 30 seconds and try again.');
      }

      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      if (res.status === 204) return null;
      return res.json();

    } catch(e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('Request timed out. Server may be starting — please try again in 30 seconds.');
      }
      if (e.name === 'TypeError') {
        throw new Error('Cannot reach server. Check internet or wait for backend to start.');
      }
      throw e;
    }
  },

  get:    (path)       => http.request('GET',    path),
  post:   (path, body) => http.request('POST',   path, body),
  put:    (path, body) => http.request('PUT',    path, body),
  delete: (path)       => http.request('DELETE', path),

  // AI calls need longer timeout — 90 seconds
  ai: (path, body) => http.request('POST', path, body, 90000),
};

/* ══════════════════════════════════════════
   QUESTION API
   ══════════════════════════════════════════ */
const QuestionAPI = {
  // GET /api/questions
  getAll: () => http.get('/questions'),

  // GET /api/questions/{id}
  getById: (id) => http.get(`/questions/${id}`),

  // GET /api/questions/filter?topic=Java&difficulty=Easy
  filter: (topic, difficulty) => {
    const params = new URLSearchParams();
    if (topic)      params.set('topic',      topic);
    if (difficulty) params.set('difficulty', difficulty);
    return http.get(`/questions/filter?${params.toString()}`);
  },

  // POST /api/questions (admin)
  add: (question) => http.post('/questions', question),

  // PUT /api/questions/{id} (admin)
  update: (id, question) => http.put(`/questions/${id}`, question),

  // DELETE /api/questions/{id} (admin)
  delete: (id) => http.delete(`/questions/${id}`),
};

/* ══════════════════════════════════════════
   AI API
   ══════════════════════════════════════════ */
const AiAPI = {
  // POST /api/ai/ask — body: plain string
  ask: (message) => http.ai('/ai/ask', message),

  // POST /api/ai/code-review — body: plain string
  codeReview: (code) => http.ai('/ai/code-review', code),

  // POST /api/ai/explain — body: plain string
  explain: (topic) => http.ai('/ai/explain', topic),

  // POST /api/ai/feedback — body: { question, answer }
  feedback: (question, answer) => http.ai('/ai/feedback', { question, answer }),
};

/* ══════════════════════════════════════════
   AUTH API
   ══════════════════════════════════════════ */
const AuthAPI = {
  // POST /api/auth/login
  login: async (email, password) => {
    const data = await http.request('POST', '/auth/login', { email, password });
    if (data?.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user',  JSON.stringify(data.user || data));
    }
    return data;
  },

  // POST /api/auth/register
  register: (name, email, password, role = 'USER') =>
    http.post('/auth/register', { name, email, password, role }),

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = 'index.html';
  },

  getUser:     () => JSON.parse(localStorage.getItem('user') || '{}'),
  getToken:    () => localStorage.getItem('token'),
  isLoggedIn:  () => !!localStorage.getItem('token'),
};

/* ══════════════════════════════════════════
   TOAST NOTIFICATIONS
   ══════════════════════════════════════════ */
const Toast = {
  _container: null,
  _get() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9998;display:flex;flex-direction:column;gap:8px';
      document.body.appendChild(this._container);
    }
    return this._container;
  },
  show(msg, type = '', dur = 4000) {
    const colors = { success:'#059669', error:'#dc2626', '':'#1c1917' };
    const el = document.createElement('div');
    el.style.cssText = `background:${colors[type]||colors['']};color:white;padding:11px 16px;border-radius:10px;font-size:13px;font-weight:500;max-width:340px;box-shadow:0 4px 16px rgba(0,0,0,.15);animation:toastIn .2s ease;font-family:'DM Sans',sans-serif`;
    el.textContent = msg;
    this._get().appendChild(el);
    setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .2s'; setTimeout(()=>el.remove(), 200); }, dur);
  },
  success: (m) => Toast.show(m, 'success'),
  error:   (m) => Toast.show(m, 'error'),
};

// Toast animation
const _ts = document.createElement('style');
_ts.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}';
document.head.appendChild(_ts);

/* ══════════════════════════════════════════
   LOADING HELPERS (for tables)
   ══════════════════════════════════════════ */
function showTableLoading(tbodyId, cols) {
  const el = document.getElementById(tbodyId);
  if (!el) return;
  el.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:40px;color:#a8a29e;font-size:13px">
    <div style="width:20px;height:20px;border:2px solid #e5e1db;border-top-color:#4f46e5;border-radius:50%;animation:spin .6s linear infinite;margin:0 auto 10px"></div>
    Loading…
  </td></tr>`;
}

function showTableEmpty(tbodyId, cols, msg = 'No data found') {
  const el = document.getElementById(tbodyId);
  if (!el) return;
  el.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:48px;color:#a8a29e;font-size:13px">
    <div style="font-size:32px;margin-bottom:8px">📭</div>${msg}
  </td></tr>`;
}

const _ss = document.createElement('style');
_ss.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(_ss);