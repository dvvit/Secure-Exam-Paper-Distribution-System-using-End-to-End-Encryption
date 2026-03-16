/**
 * ui.js - Shared UI utilities for SecureExam
 */

const UI = (() => {

  /* ---------- TOAST NOTIFICATIONS ---------- */
  function toast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const colors = { success: 'var(--accent3)', error: 'var(--danger)', info: 'var(--accent)', warning: 'var(--warning)' };

    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `
      <span style="color:${colors[type]};font-size:1rem;font-weight:700">${icons[type]}</span>
      <span>${message}</span>
    `;
    container.appendChild(t);

    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      t.style.transition = 'all 0.3s';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  /* ---------- MODAL ---------- */
  function showModal(id) {
    document.getElementById(id)?.classList.add('show');
  }

  function hideModal(id) {
    document.getElementById(id)?.classList.remove('show');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
  }

  /* ---------- LOADING STATE ---------- */
  function setLoading(btn, loading, text = '') {
    if (loading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span style="display:inline-block;animation:spin 0.8s linear infinite">⟳</span> ${text || 'Processing...'}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || text;
    }
  }

  /* ---------- FORMAT HELPERS ---------- */
  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  function formatRelative(iso) {
    if (!iso) return '—';
    const ms = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(ms);
    const past = ms < 0;
    if (abs < 60000) return past ? 'just now' : 'in a moment';
    if (abs < 3600000) return `${past ? '' : 'in '}${Math.round(abs / 60000)}m${past ? ' ago' : ''}`;
    if (abs < 86400000) return `${past ? '' : 'in '}${Math.round(abs / 3600000)}h${past ? ' ago' : ''}`;
    return formatDate(iso);
  }

  function formatDuration(minutes) {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }

  function truncateHash(hash, len = 16) {
    if (!hash) return '—';
    return hash.substring(0, len) + '...' + hash.substring(hash.length - 4);
  }

  /* ---------- STATUS BADGE HTML ---------- */
  function statusBadge(status) {
    const map = {
      draft: ['badge-yellow', '◉ Draft'],
      encrypted: ['badge-blue', '🔒 Encrypted'],
      scheduled: ['badge-purple', '⏱ Scheduled'],
      active: ['badge-green', '▶ Active'],
      completed: ['badge-red', '✓ Completed'],
      upcoming: ['badge-yellow', '⏳ Upcoming'],
      ended: ['badge-red', '⏹ Ended']
    };
    const [cls, label] = map[status] || ['badge-yellow', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function phaseBadge(phase) {
    return statusBadge(phase);
  }

  /* ---------- COUNTDOWN TIMER ---------- */
  function startCountdown(targetIso, onTick, onExpire) {
    function tick() {
      const ms = new Date(targetIso).getTime() - Date.now();
      if (ms <= 0) {
        onExpire && onExpire();
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      onTick({ h, m, s, ms });
    }
    tick();
    return setInterval(tick, 1000);
  }

  /* ---------- CONFIRM DIALOG ---------- */
  function confirm(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay show';
      overlay.innerHTML = `
        <div class="modal" style="max-width:380px;text-align:center">
          <div style="font-size:2rem;margin-bottom:1rem">⚠️</div>
          <div class="modal-title" style="justify-content:center">${message}</div>
          <div class="flex gap-md mt-lg" style="justify-content:center">
            <button class="btn btn-outline" id="conf-cancel">Cancel</button>
            <button class="btn btn-primary" id="conf-ok">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#conf-cancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
      overlay.querySelector('#conf-ok').addEventListener('click', () => { overlay.remove(); resolve(true); });
    });
  }

  /* ---------- RENDER NAV BASED ON ROLE ---------- */
  function renderNavForRole(role) {
    const teacherLinks = `
      <a href="teacher.html" class="sidebar-link active"><span class="s-icon">🏠</span> Dashboard</a>
      <div class="sidebar-label">Exams</div>
      <a href="teacher.html#upload" class="sidebar-link" onclick="App.showSection('upload')"><span class="s-icon">📤</span> Upload Exam</a>
      <a href="teacher.html#exams" class="sidebar-link" onclick="App.showSection('exams')"><span class="s-icon">📋</span> Manage Exams</a>
      <a href="teacher.html#audit" class="sidebar-link" onclick="App.showSection('audit')"><span class="s-icon">🔍</span> Audit Log</a>
    `;
    const studentLinks = `
      <a href="student.html" class="sidebar-link active"><span class="s-icon">🏠</span> Dashboard</a>
      <div class="sidebar-label">Exams</div>
      <a href="student.html#exams" class="sidebar-link"><span class="s-icon">📝</span> My Exams</a>
    `;
    return role === 'teacher' ? teacherLinks : studentLinks;
  }

  /* ---------- ANIMATE ELEMENTS IN ---------- */
  function animateIn(selector, stagger = 80) {
    const els = document.querySelectorAll(selector);
    els.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, i * stagger);
    });
  }

  return {
    toast, showModal, hideModal, closeAllModals,
    setLoading, formatDate, formatRelative, formatDuration,
    truncateHash, statusBadge, phaseBadge, startCountdown,
    confirm, renderNavForRole, animateIn
  };
})();

window.UI = UI;
