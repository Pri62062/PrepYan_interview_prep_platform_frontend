// /* ═══════════════════════════════════════════════════════════════
//    PrepYan — app.js  (FIXED & UNIFIED)
//    Single source of truth for storage, streak, bookmarks, stats
//    Works consistently across dashboard.html, questions.html,
//    bookmarks.html, results.html
// ═══════════════════════════════════════════════════════════════ */

// 'use strict';

// const BASE_URL = 'http://localhost:8080';

// /* ─────────────────────────────────────────────────────────────
//    STORAGE — ALL keys are user-scoped to prevent data bleed
//    between different logged-in accounts on the same browser
// ───────────────────────────────────────────────────────────── */
// const Storage = {
//   /* Returns "prefix_email" or "prefix_guest" */
//   key(prefix) {
//     try {
//       const u = JSON.parse(localStorage.getItem('user') || '{}');
//       return `${prefix}_${u.email || 'guest'}`;
//     } catch {
//       return `${prefix}_guest`;
//     }
//   },

//   /* ── Results: [{id, correct, timestamp, date}] ── */
//   getResults() {
//     try {
//       return JSON.parse(localStorage.getItem(this.key('results'))) || [];
//     } catch { return []; }
//   },
//   saveResults(data) {
//     localStorage.setItem(this.key('results'), JSON.stringify(data));
//   },
//   addResult(id, correct) {
//     const results = this.getResults();
//     results.push({
//       id:        Number(id),
//       correct:   Boolean(correct),
//       timestamp: Date.now(),
//       date:      new Date().toISOString().slice(0, 10) // "YYYY-MM-DD" — required for streak
//     });
//     this.saveResults(results);
//   },

//   /* ── Bookmarks: [1, 3, 7, ...] (array of IDs as numbers) ── */
//   getBookmarks() {
//     try {
//       const raw = localStorage.getItem(this.key('bookmarks'));
//       const arr = JSON.parse(raw) || [];
//       // Normalize: always numbers, deduplicated
//       return [...new Set(arr.map(Number).filter(n => !isNaN(n)))];
//     } catch { return []; }
//   },
//   saveBookmarks(ids) {
//     const clean = [...new Set(ids.map(Number).filter(n => !isNaN(n)))];
//     localStorage.setItem(this.key('bookmarks'), JSON.stringify(clean));
//   },
//   toggleBookmark(id) {
//     id = Number(id);
//     let bm = this.getBookmarks();
//     if (bm.includes(id)) {
//       bm = bm.filter(b => b !== id);
//     } else {
//       bm.push(id);
//     }
//     this.saveBookmarks(bm);
//     return bm.includes(id); // return new state
//   },

//   /* ── AI usage ── */
//   getAICount() {
//     return parseInt(localStorage.getItem(this.key('aiCount')) || '0');
//   },
//   incrementAI() {
//     const n = this.getAICount() + 1;
//     localStorage.setItem(this.key('aiCount'), n);
//     localStorage.setItem(this.key('aiLastTime'), Date.now());
//     return n;
//   },
//   getAILastTime() {
//     return parseInt(localStorage.getItem(this.key('aiLastTime')) || '0');
//   },

//   /* ── Questions cache ── */
//   getQuestions() {
//     try {
//       return JSON.parse(localStorage.getItem('questions')) || [];
//     } catch { return []; }
//   },
//   saveQuestions(qs) {
//     localStorage.setItem('questions', JSON.stringify(qs));
//   }
// };

// /* ─────────────────────────────────────────────────────────────
//    STREAK — fixed algorithm
//    Uses 'date' field (YYYY-MM-DD) stored on each result
// ───────────────────────────────────────────────────────────── */
// function calcStreak() {
//   const results = Storage.getResults();
//   if (!results.length) return 0;

//   // ✅ Convert to local date (fix timezone issue)
//   const toDateStr = (d) => {
//     const date = new Date(d);
//     return date.getFullYear() + "-" +
//       String(date.getMonth() + 1).padStart(2, "0") + "-" +
//       String(date.getDate()).padStart(2, "0");
//   };

//   // ✅ Unique dates (use Set for fast lookup)
//   const dateSet = new Set(
//     results
//       .map(r => r.date || toDateStr(r.timestamp))
//       .filter(Boolean)
//   );

//   if (!dateSet.size) return 0;

//   const today = toDateStr(new Date());

//   const yesterdayDate = new Date();
//   yesterdayDate.setDate(yesterdayDate.getDate() - 1);
//   const yesterday = toDateStr(yesterdayDate);

//   // ✅ Convert Set → sorted array
//   const uniqueDates = [...dateSet].sort().reverse();

//   // ❗ If last activity not today/yesterday → reset
//   if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

//   let streak = 0;

//   // Start from today OR yesterday
//   let checkDate = new Date();
//   if (uniqueDates[0] === yesterday) {
//     checkDate = yesterdayDate;
//   }

//   // ✅ Loop day-by-day
//   while (true) {
//     const dateStr = toDateStr(checkDate);

//     if (dateSet.has(dateStr)) {   // 🔥 FAST lookup
//       streak++;
//       checkDate.setDate(checkDate.getDate() - 1);
//     } else {
//       break;
//     }
//   }

//   return streak;
// }

// /* ─────────────────────────────────────────────────────────────
//    STATS — all computed from Storage, single source of truth
// ───────────────────────────────────────────────────────────── */
// const Stats = {
//   compute(questions) {
//     const results   = Storage.getResults();
//     const bookmarks = Storage.getBookmarks();
//     const total     = questions.length;

//     /* Unique question IDs that were attempted */
//     const attemptedIds = [...new Set(results.map(r => Number(r.id)))];
//     const solvedIds    = [...new Set(
//       results.filter(r => r.correct).map(r => Number(r.id))
//     )];

//     const attempted = attemptedIds.length;
//     const solved    = solvedIds.length;
//     const remaining = Math.max(0, total - solved);
//     const accuracy  = results.length > 0 ? Math.round((results.filter(r => r.correct).length / results.length) * 100) : 0;

//     /* Weekly attempts (last 7 days) */
//     const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
//     const weekly  = results.filter(r => r.timestamp > weekAgo).length;

//     /* Topic progress */
//     const topicMap = {};
//     questions.forEach(q => {
//       if (!topicMap[q.topic]) topicMap[q.topic] = { total: 0, solved: 0 };
//       topicMap[q.topic].total++;
//       if (solvedIds.includes(Number(q.id))) topicMap[q.topic].solved++;
//     });

//     /* Recent activity (last 5) */
//     const recent = [...results]
//       .sort((a, b) => b.timestamp - a.timestamp)
//       .slice(0, 5)
//       .map(r => ({
//         ...r,
//         question: questions.find(q => Number(q.id) === Number(r.id)) || null
//       }));

//     return {
//       total, attempted, solved, remaining, accuracy, weekly,
//       bookmarkCount: bookmarks.length,
//       aiCount:       Storage.getAICount(),
//       aiLastTime:    Storage.getAILastTime(),
//       streak:        calcStreak(),
//       topicMap,
//       recent
//     };
//   }
// };

// /* ─────────────────────────────────────────────────────────────
//    UI UPDATERS — safely update DOM elements if they exist
// ───────────────────────────────────────────────────────────── */
// function setText(id, val) {
//   const el = document.getElementById(id);
//   if (el) el.textContent = val;
// }

// function updateAllStatsUI(questions) {
//   const s = Stats.compute(questions);

//   setText('attemptCount',      s.attempted);
//   setText('solvedCount',       s.solved);
//   setText('remainingCount',    s.remaining);
//   setText('accuracyText',      s.accuracy + '% accuracy');
//   setText('weeklyAttempt',     s.weekly > 0 ? `${s.weekly} this week` : 'No activity this week');
//   setText('bookmarkCount',     s.bookmarkCount);
//   setText('bookmarkBreakdown', s.bookmarkCount > 0 ? `${s.bookmarkCount} question${s.bookmarkCount > 1 ? 's' : ''} saved` : 'No bookmarks yet');
//   setText('aiCount',           s.aiCount);
//   setText('streakCount',       s.streak);
//   setText('streakText',
//     s.streak === 0 ? 'Start practicing today!'
//     : s.streak === 1 ? 'Great start! Keep it up 💪'
//     : `${s.streak} day${s.streak > 1 ? 's' : ''} in a row! 🔥`
//   );

//   /* AI last used */
//   const aiEl = document.getElementById('aiLastUsed');
//   if (aiEl) {
//     if (!s.aiLastTime) {
//       aiEl.textContent = 'No recent activity';
//     } else {
//       const diff = Date.now() - s.aiLastTime;
//       const mins = Math.floor(diff / 60000);
//       aiEl.textContent = mins < 1 ? 'Just now'
//         : mins < 60 ? `Last: ${mins}m ago`
//         : mins < 1440 ? `Last: ${Math.floor(mins / 60)}h ago`
//         : `Last: ${Math.floor(mins / 1440)}d ago`;
//     }
//   }

//   /* Topic progress bars */
//   const progEl = document.getElementById('topicProgress');
//   if (progEl) {
//     const colors = ['var(--accent)', 'var(--green)', 'var(--teal)', 'var(--amber)', 'var(--pink)', 'var(--blue)'];
//     const entries = Object.entries(s.topicMap);
//     if (!entries.length) {
//       progEl.innerHTML = '<p style="font-size:13px;color:var(--ink-3)">Attempt questions to see progress.</p>';
//     } else {
//       progEl.innerHTML = entries.map(([topic, {total, solved}], i) => {
//         const pct = total ? Math.round((solved / total) * 100) : 0;
//         return `<div class="prog-item">
//           <div class="prog-row">
//             <span class="prog-lbl">${escHtml(topic)}</span>
//             <span class="prog-pct">${solved}/${total}</span>
//           </div>
//           <div class="prog-bg">
//             <div class="prog-fill" style="width:${pct}%;background:${colors[i % colors.length]}"></div>
//           </div>
//         </div>`;
//       }).join('');
//     }
//   }

//   /* Recent activity */
//   const actEl = document.getElementById('recentActivity');
//   if (actEl) {
//     if (!s.recent.length) {
//       actEl.innerHTML = '';
//     } else {
//       actEl.innerHTML = `<div class="rail-card fade-up">
//         <div class="rail-title"><i class="bi bi-clock-history" style="color:var(--accent)"></i>Recent Activity</div>
//         ${s.recent.map(r => `
//           <div class="act-item">
//             <div class="act-icon" style="background:${r.correct ? 'var(--green-lt)' : 'var(--red-lt)'}">
//               <i class="bi ${r.correct ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"
//                  style="color:${r.correct ? 'var(--green)' : 'var(--red)'}"></i>
//             </div>
//             <div class="act-text">
//               <div class="act-name">${escHtml(r.question?.title || 'Question #' + r.id)}</div>
//               <div class="act-time">${timeAgo(r.timestamp)}</div>
//             </div>
//             <span class="act-score ${r.correct ? 'score-a' : 'score-b'}">${r.correct ? 'Correct' : 'Wrong'}</span>
//           </div>`).join('')}
//       </div>`;
//     }
//   }
// }

// /* ─────────────────────────────────────────────────────────────
//    SIDEBAR — unified, no conflicts
// ───────────────────────────────────────────────────────────── */
// function updateSidebar(questions) {
//   const results   = Storage.getResults();
//   const bookmarks = Storage.getBookmarks();

//   /* Topics */
//   const topicEl = document.getElementById('topicList');
//   if (topicEl) {
//     const topicMap = {};
//     questions.forEach(q => { topicMap[q.topic || 'Other'] = (topicMap[q.topic || 'Other'] || 0) + 1; });

//     topicEl.innerHTML =
//       `<span class="sb-item active" onclick="sideFilter(this,'all')">
//         <i class="bi bi-grid-fill"></i>All Topics
//         <span class="sb-badge">${questions.length}</span>
//       </span>` +
//       Object.entries(topicMap).map(([t, cnt]) => `
//         <span class="sb-item" onclick="sideFilter(this,'${escHtml(t)}')">
//           <i class="bi bi-code-square"></i>${escHtml(t)}
//           <span class="sb-badge">${cnt}</span>
//         </span>`).join('');
//   }

//   /* Difficulty */
//   const diffEl = document.getElementById('difficultyList');
//   if (diffEl) {
//     const diffMap = { Easy: 0, Medium: 0, Hard: 0 };
//     questions.forEach(q => { if (q.difficulty in diffMap) diffMap[q.difficulty]++; });

//     diffEl.innerHTML = Object.entries(diffMap).map(([d, cnt]) => {
//       const dotColor = d === 'Easy' ? '#6EE7B7' : d === 'Medium' ? '#FCD34D' : '#FCA5A5';
//       return `<span class="sb-item" onclick="sideDiff(this,'${d}')">
//         <i class="bi bi-circle-fill" style="color:${dotColor};font-size:9px"></i>${d}
//         <span class="sb-badge">${cnt}</span>
//       </span>`;
//     }).join('');
//   }

//   /* Activity */
//   const actEl = document.getElementById('activityList');
//   if (actEl) {
//     actEl.innerHTML = `
//       <span class="sb-item" onclick="window.location.href='bookmarks.html'">
//         <i class="bi bi-bookmark-heart"></i>Bookmarks
//         <span class="sb-badge">${bookmarks.length}</span>
//       </span>
//       <span class="sb-item" onclick="window.location.href='results.html'">
//         <i class="bi bi-graph-up-arrow"></i>Results
//         <span class="sb-badge">${results.length}</span>
//       </span>
//       <span class="sb-item">
//         <i class="bi bi-robot"></i>AI Sessions
//         <span class="sb-badge">${Storage.getAICount()}</span>
//       </span>`;
//   }
// }

// /* ─────────────────────────────────────────────────────────────
//    CHIPS — unified
// ───────────────────────────────────────────────────────────── */
// function buildChips(questions) {
//   const container = document.getElementById('chipContainer');
//   if (!container) return;

//   const topics = [...new Set(questions.map(q => q.topic).filter(Boolean))];

//   container.innerHTML =
//     `<span class="chip on" onclick="setChipTopic(this,'all')">All Topics</span>` +
//     topics.map(t => `<span class="chip" onclick="setChipTopic(this,'${escHtml(t)}')">${escHtml(t)}</span>`).join('') +
//     `<span class="chip easy"  onclick="setChipDiff(this,'Easy')">Easy</span>
//      <span class="chip med"   onclick="setChipDiff(this,'Medium')">Medium</span>
//      <span class="chip hard"  onclick="setChipDiff(this,'Hard')">Hard</span>`;
// }

// /* Chip click handlers — kept on window so inline onclick works */
// window.setChipTopic = function(el, topic) {
//   document.querySelectorAll('#chipContainer .chip').forEach(c => c.classList.remove('on'));
//   el.classList.add('on');
//   window._curTopic = topic;
//   if (typeof renderCards === 'function') renderCards();
// };

// window.setChipDiff = function(el, diff) {
//   document.querySelectorAll('#chipContainer .chip').forEach(c => c.classList.remove('on'));
//   el.classList.add('on');
//   window._curDiff = diff;
//   if (typeof renderCards === 'function') renderCards();
// };

// window.sideFilter = function(el, topic) {
//   document.querySelectorAll('#topicList .sb-item').forEach(e => e.classList.remove('active'));
//   el.classList.add('active');
//   window._curTopic = topic;
//   if (typeof renderCards === 'function') renderCards();
// };

// window.sideDiff = function(el, diff) {
//   document.querySelectorAll('#difficultyList .sb-item').forEach(e => e.classList.remove('active'));
//   el.classList.add('active');
//   window._curDiff = diff;
//   if (typeof renderCards === 'function') renderCards();
// };

// /* ─────────────────────────────────────────────────────────────
//    LOAD QUESTIONS — with demo fallback
// ───────────────────────────────────────────────────────────── */
// const DEMO_QUESTIONS = [
//   {id:1,  title:'What is JVM?',                topic:'Java',          difficulty:'Easy',   description:'Explain JVM architecture and its role in Java execution.'},
//   {id:2,  title:'Explain HashMap internals',   topic:'Java',          difficulty:'Medium', description:'How does HashMap work internally in Java?'},
//   {id:3,  title:'What is a JOIN in SQL?',      topic:'SQL',           difficulty:'Easy',   description:'Explain different types of JOINs in SQL with examples.'},
//   {id:4,  title:'Explain Binary Search Tree',  topic:'DSA',           difficulty:'Medium', description:'What is a BST? Explain insert, search, and delete operations.'},
//   {id:5,  title:'What is CAP Theorem?',        topic:'System Design', difficulty:'Hard',   description:'Explain CAP theorem and distributed systems design.'},
//   {id:6,  title:'Explain SQL Indexes',         topic:'SQL',           difficulty:'Medium', description:'How do indexes work in SQL? When should you use them?'},
//   {id:7,  title:'Stack vs Queue',              topic:'DSA',           difficulty:'Easy',   description:'Compare Stack and Queue data structures with use cases.'},
//   {id:8,  title:'Design a URL Shortener',      topic:'System Design', difficulty:'Hard',   description:'Design a scalable URL shortening service like bit.ly.'},
// ];

// async function loadQuestions() {
//   try {
//     const controller = new AbortController();
//     const timer = setTimeout(() => controller.abort(), 6000);
//     const res = await fetch(`${BASE_URL}/api/questions`, { signal: controller.signal });
//     clearTimeout(timer);
//     if (!res.ok) throw new Error(`HTTP ${res.status}`);
//     const data = await res.json();
//     if (!Array.isArray(data) || !data.length) throw new Error('Empty');
//     const qs = data.map(q => ({
//       id:          Number(q.id),
//       title:       q.title       || 'Untitled',
//       topic:       q.topic       || 'General',
//       difficulty:  q.difficulty  || 'Easy',
//       description: q.description || '',
//       answer:      q.answer      || ''
//     }));
//     Storage.saveQuestions(qs);
//     return qs;
//   } catch (err) {
//     console.warn('Backend unreachable, using demo data:', err.message);
//     Storage.saveQuestions(DEMO_QUESTIONS);
//     return DEMO_QUESTIONS;
//   }
// }

// /* ─────────────────────────────────────────────────────────────
//    AI SUBMIT — shared, used by dashboard + questions pages
// ───────────────────────────────────────────────────────────── */
// async function submitAnswer(questionId, answer, onFeedback, onError) {
//   const questions = Storage.getQuestions();
//   const q = questions.find(x => Number(x.id) === Number(questionId));
//   if (!q || !answer?.trim()) return;

//   try {
//     const res = await fetch(`${BASE_URL}/api/ai/ask`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'text/plain' },
//       body:
// `You are an expert interview coach. Evaluate this answer strictly.

// Question: ${q.title}
// Description: ${q.description}
// Candidate's Answer: ${answer}

// Respond in this EXACT format:
// SCORE: [X/10]
// VERDICT: [Correct / Partially Correct / Incorrect]
// FEEDBACK: [2-3 sentences of specific feedback]
// BEST ANSWER: [Model answer in 3-5 sentences]`
//     });

//     if (!res.ok) throw new Error(`API ${res.status}`);
//     const aiText = await res.text();

//     /* Parse verdict */
//     const lower     = aiText.toLowerCase();
//     const isCorrect = lower.includes('correct') && !lower.includes('incorrect') && !lower.includes('partially');

//     /* Save result with date for streak */
//     Storage.addResult(questionId, isCorrect);

//     /* Track AI usage */
//     Storage.incrementAI();

//     onFeedback?.(aiText, isCorrect);
//     return { aiText, isCorrect };

//   } catch (err) {
//     onError?.(err);
//     throw err;
//   }
// }

// /* ─────────────────────────────────────────────────────────────
//    FEEDBACK CARD BUILDER — unified HTML for AI response
// ───────────────────────────────────────────────────────────── */
// function buildFeedbackCard(aiText, isCorrect) {
//   const extract = (label) => {
//     const m = aiText.match(new RegExp(`${label}:\\s*(.+?)(?=\\n[A-Z ]+:|$)`, 'is'));
//     return m ? m[1].trim() : null;
//   };

//   const score   = extract('SCORE')       || '—';
//   const verdict = extract('VERDICT')     || (isCorrect ? 'Correct' : 'Needs Improvement');
//   const fb      = extract('FEEDBACK')    || aiText;
//   const best    = extract('BEST ANSWER') || '';

//   const vLow    = verdict.toLowerCase();
//   const vColor  = vLow.includes('partially') ? 'var(--amber)'
//                 : vLow.includes('incorrect')  ? 'var(--red)'
//                 : 'var(--green)';

//   return `<div style="background:var(--green-lt);border:1.5px solid #6EE7B7;border-radius:14px;padding:18px;margin-top:16px">
//     <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--green);margin-bottom:10px">✦ AI Evaluation</div>
//     <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
//       <span style="font-size:20px;font-weight:700;color:var(--accent);background:var(--accent-lt);border-radius:10px;padding:4px 14px;font-family:var(--mono)">${escHtml(score)}</span>
//       <span style="font-size:13px;font-weight:600;color:${vColor}">${escHtml(verdict)}</span>
//     </div>
//     ${fb ? `<div style="margin-bottom:12px">
//       <div style="font-size:11px;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">Feedback</div>
//       <div style="font-size:13.5px;color:var(--ink-1);line-height:1.7;white-space:pre-line">${escHtml(fb)}</div>
//     </div>` : ''}
//     ${best ? `<div style="background:rgba(5,150,105,.07);border-radius:10px;padding:14px">
//       <div style="font-size:11px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">Model Answer</div>
//       <div style="font-size:13.5px;color:var(--ink-1);line-height:1.7;white-space:pre-line">${escHtml(best)}</div>
//     </div>` : ''}
//   </div>`;
// }

// /* ─────────────────────────────────────────────────────────────
//    USER UI
// ───────────────────────────────────────────────────────────── */
// function updateUserUI() {
//   try {
//     const user = JSON.parse(localStorage.getItem('user') || '{}');
//     const name = user.name || user.username || (user.email ? user.email.split('@')[0] : 'User');
//     const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

//     document.querySelectorAll('#userAvatar,.user-av').forEach(el => el.textContent = initials);
//     document.querySelectorAll('#userNameDisplay,.user-name').forEach(el => el.textContent = name);

//     const welcomeEl = document.getElementById('welcomeText');
//     if (welcomeEl) {
//       const h = new Date().getHours();
//       const greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
//       welcomeEl.textContent = `${greeting}, ${name.split(' ')[0]} 👋`;
//     }

//     const dateEl = document.getElementById('todayDate');
//     if (dateEl) {
//       dateEl.textContent = new Date().toLocaleDateString('en-IN', {
//         weekday: 'long', month: 'short', day: 'numeric'
//       });
//     }
//   } catch {}
// }

// function logout() {
//   localStorage.removeItem('user');
//   window.location.href = 'login.html';
// }

// /* ─────────────────────────────────────────────────────────────
//    HELPERS
// ───────────────────────────────────────────────────────────── */
// function escHtml(str) {
//   if (str === null || str === undefined) return '';
//   return String(str)
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#039;');
// }

// function timeAgo(ts) {
//   if (!ts) return '';
//   const diff = Date.now() - ts;
//   if (diff < 60000)   return 'Just now';
//   if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
//   if (diff < 86400000)return `${Math.floor(diff / 3600000)}h ago`;
//   return `${Math.floor(diff / 86400000)}d ago`;
// }

// /* Expose globally so inline onclick works */
// window.logout = logout;
// window.Storage = Storage;
// window.buildFeedbackCard = buildFeedbackCard;
// window.updateAllStatsUI = updateAllStatsUI;
// window.updateSidebar = updateSidebar;
// window.buildChips = buildChips;
// window.loadQuestions = loadQuestions;
// window.updateUserUI = updateUserUI;
// window.calcStreak = calcStreak;
// window.escHtml = escHtml;
// window.timeAgo = timeAgo;
// window.submitAnswer = submitAnswer;