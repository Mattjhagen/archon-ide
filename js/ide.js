/* ============================================
   Archon IDE — Core Logic
   ============================================ */

(function () {
  'use strict';

  // --- State ---
  const state = {
    platform: 'web',
    files: {},
    openFiles: [],
    activeFile: null,
    explorerTree: [],
  };

  // --- Platform mapping ---
  const platformInfo = {
    web: { lang: 'HTML/CSS/JS', ext: '.html' },
    ios: { lang: 'Swift/SwiftUI', ext: '.swift' },
    android: { lang: 'Kotlin/Compose', ext: '.kt' },
    react: { lang: 'React Native', ext: '.tsx' },
    mac: { lang: 'Swift/AppKit', ext: '.swift' },
  };

  // --- DOM refs ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const editorArea = $('#code-editor');
  const explorerTree = $('#explorer-tree');
  const explorerTitle = $('#explorer-title');
  const statusLang = $('#status-lang');
  const statusFileCount = $('#status-file-count');
  const tooltip = $('#tooltip');

  // --- Platform buttons ---
  $$('.platform-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.platform-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.platform = btn.dataset.platform;
      const info = platformInfo[state.platform];
      explorerTitle.textContent = `Explorer — ${btn.textContent.trim()}`;
      statusLang.textContent = `${btn.textContent.trim()} \u00B7 ${info.lang}`;
    });
  });

  // --- AI suggestions ---
  $$('.ai-suggestion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      const input = $('#ai-input');
      if (input) {
        input.value = prompt;
        input.focus();
      }
    });
  });

  // --- Welcome hints ---
  $$('.welcome-hint').forEach((hint) => {
    hint.addEventListener('click', () => {
      const prompt = hint.dataset.hint;
      const input = $('#ai-input');
      if (input) {
        input.value = prompt;
        input.focus();
      }
    });
  });

  // --- Tooltip ---
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) {
      tooltip.classList.remove('visible');
      return;
    }
    tooltip.textContent = target.dataset.tooltip;
    tooltip.classList.add('visible');
    const rect = target.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = rect.bottom + 6 + 'px';
  });

  document.addEventListener('mouseout', (e) => {
    if (!e.target.closest('[data-tooltip]')) {
      tooltip.classList.remove('visible');
    }
  });

  // --- Topbar menu actions ---
  $$('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      switch (action) {
        case 'new-file':
          createNewFile();
          break;
        case 'new-folder':
          createNewFolder();
          break;
        case 'save':
          saveCurrentFile();
          break;
        case 'export':
          exportProject();
          break;
        case 'run':
          runProject();
          break;
        case 'refresh-preview':
          refreshPreview();
          break;
        case 'open-external':
          openExternal();
          break;
      }
    });
  });

  // --- View tabs ---
  $$('.ide-topbar-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.ide-topbar-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const view = tab.dataset.view;
      const editorArea = $('#editor-area');
      const previewArea = $('#preview-area');
      const outputArea = $('#output-area');
      if (view === 'editor') {
        editorArea.style.display = 'flex';
        previewArea.style.display = 'none';
        outputArea.style.display = 'none';
      } else if (view === 'preview') {
        editorArea.style.display = 'none';
        previewArea.style.display = 'flex';
        outputArea.style.display = 'none';
      } else if (view === 'output') {
        editorArea.style.display = 'none';
        previewArea.style.display = 'none';
        outputArea.style.display = 'flex';
      }
    });
  });

  // --- Terminal input ---
  const termInput = $('#term-input');
  if (termInput) {
    termInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = termInput.value.trim();
        if (!cmd) return;
        const body = $('#terminal-body');
        const line = document.createElement('div');
        line.innerHTML = `<span style="color:var(--success)">✓</span> <span style="color:var(--text-muted)">$</span> ${escapeHtml(cmd)}`;
        body.insertBefore(line, body.querySelector('.term-input-line'));
        termInput.value = '';
        body.scrollTop = body.scrollHeight;
      }
    });
  }

  // --- AI send ---
  const aiInput = $('#ai-input');
  const aiSend = $('#ai-send');
  const aiMessages = $('#ai-messages');

  if (aiSend && aiInput) {
    const sendAi = () => {
      const msg = aiInput.value.trim();
      if (!msg) return;
      appendAiMessage('user', msg);
      aiInput.value = '';
      setTimeout(() => {
        appendAiMessage('assistant', 'I\'m working on that... (AI integration pending)');
      }, 600);
    };

    aiSend.addEventListener('click', sendAi);
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAi();
      }
    });
  }

  function appendAiMessage(role, content) {
    if (!aiMessages) return;
    const div = document.createElement('div');
    div.style.cssText = `
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 12px;
      line-height: 1.5;
      max-width: 90%;
      ${role === 'user'
        ? 'align-self: flex-end; background: var(--accent-muted); color: var(--text-primary); border: 1px solid rgba(124,92,252,0.12);'
        : 'align-self: flex-start; background: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border-faint);'
      }
    `;
    div.textContent = content;
    aiMessages.appendChild(div);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  // --- Connector buttons ---
  $$('.connector-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const connector = btn.dataset.connector;
      appendAiMessage('assistant', `Connecting to ${connector}... (OAuth flow pending)`);
    });
  });

  // --- Helpers ---
  function createNewFile() {
    const name = prompt('File name:');
    if (!name) return;
    state.files[name] = '';
    renderExplorer();
  }

  function createNewFolder() {
    const name = prompt('Folder name:');
    if (!name) return;
    state.files[name + '/'] = null;
    renderExplorer();
  }

  function saveCurrentFile() {
    if (state.activeFile && editorArea) {
      state.files[state.activeFile] = editorArea.value;
    }
  }

  function exportProject() {
    alert('Export: JSZip integration pending');
  }

  function runProject() {
    const view = 'preview';
    $$('.ide-topbar-tab').forEach((t) => t.classList.remove('active'));
    const previewTab = $$('.ide-topbar-tab').find((t) => t.dataset.view === view);
    if (previewTab) previewTab.classList.add('active');
    $('#editor-area').style.display = 'none';
    $('#preview-area').style.display = 'flex';
    $('#output-area').style.display = 'none';
  }

  function refreshPreview() {
    const frame = $('#preview-frame');
    if (frame) frame.src = frame.src;
  }

  function openExternal() {
    const frame = $('#preview-frame');
    if (frame && frame.src) window.open(frame.src, '_blank');
  }

  function renderExplorer() {
    if (!explorerTree) return;
    explorerTree.innerHTML = '';
    const entries = Object.keys(state.files);
    statusFileCount.textContent = `${entries.length} file${entries.length !== 1 ? 's' : ''}`;
    entries.forEach((name) => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 3px 12px 3px 20px;
        font-size: 11px;
        color: var(--text-tertiary);
        cursor: pointer;
        transition: all 0.1s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      item.textContent = name;
      item.addEventListener('mouseenter', () => {
        item.style.color = 'var(--text-primary)';
        item.style.background = 'var(--bg-hover)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.color = 'var(--text-tertiary)';
        item.style.background = 'transparent';
      });
      item.addEventListener('click', () => {
        if (name.endsWith('/')) return;
        state.activeFile = name;
        if (editorArea) editorArea.value = state.files[name] ?? '';
        $('#editor-welcome').style.display = 'none';
        editorArea.style.display = 'block';
      });
      explorerTree.appendChild(item);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
    if (mod && e.key === '`') {
      e.preventDefault();
      const bottom = $('#resize-terminal');
      if (bottom) bottom.click();
    }
  });

})();
