// Various helpers
function getSenderEmail() {
  return document.querySelector('tr.acZ span[email]').getAttribute('email');
  // return document.querySelector('img.ajn[jid]').getAttribute('jid');
}

function clickReply() {
  const replies = document.querySelectorAll('button[aria-label=Reply] span[jsname][aria-hidden=true]');
  if (replies.length > 0) replies[replies.length - 1].click();
}

function sanitizeInjectedHtml(html) {
  var input = typeof html === 'string' ? html : '';
  if (typeof DOMPurify === 'undefined' || !DOMPurify.sanitize) {
    // Fail closed if sanitizer is missing.
    return '<div>' + escapeHtml(input) + '</div>';
  }

  var clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'u', 'ul'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['style'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });

  var container = document.createElement('div');
  container.innerHTML = clean;
  Array.from(container.querySelectorAll('a[href]')).forEach(function(link) {
    var href = (link.getAttribute('href') || '').trim();
    if (!/^(https?:|mailto:)/i.test(href)) {
      link.removeAttribute('href');
      return;
    }
    if (/^https?:/i.test(href)) link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer nofollow');
  });
  return container.innerHTML;
}

function setReply(html) {
  document.querySelector('div.editable[id][contenteditable][g_editable]').innerHTML = sanitizeInjectedHtml(html);
}

function insertSignature(html) {
  var editable = document.activeElement && document.activeElement.closest
    ? document.activeElement.closest('div[contenteditable="true"]')
    : null;
  if (!editable) editable = document.querySelector('div.editable[id][contenteditable][g_editable]');
  if (!editable) return;
  editable.focus();
  document.execCommand('insertHTML', false, sanitizeInjectedHtml(html));
}

function setReplyEmail(email) {
  var el = Array.from(document.querySelectorAll('form span')).find(
    o => o.textContent === REPLY_SEND_AS_DISPLAY
  );
  if (el) el.innerHTML = email;
}

// <https://stackoverflow.com/a/17644403>
function copyTextToClipboard(html) {
  var tmpNode = document.createElement('div');
  tmpNode.innerHTML = html;
  document.body.appendChild(tmpNode);

  // Back up previous selection
  var selection = window.getSelection();
  var backupRange;
  if (selection.rangeCount) backupRange = selection.getRangeAt(0).cloneRange();

  // Copy the contents
  var copyFrom = document.createRange();
  copyFrom.selectNodeContents(tmpNode);
  selection.removeAllRanges();
  selection.addRange(copyFrom);
  document.execCommand('copy');

  // Clean-up
  tmpNode.parentNode.removeChild(tmpNode);

  // Restore selection
  selection = window.getSelection();
  selection.removeAllRanges();
  if (backupRange) selection.addRange(backupRange);
}

function confirmEmail(e) {
  var email = getSenderEmail();
  window.open('https://lichess.org/mod/email-confirm?q=' + email);
  clickReply();
  extensionStorage().sync.get([SIGNATURE_STORAGE_KEY], function(data) {
    var html = buildEmailConfirmedHtml(data[SIGNATURE_STORAGE_KEY]);
    setTimeout(function() {
      setReply(html);
      setReplyEmail(REPLY_SEND_AS_EMAIL);
    }, 100);
  });
}

// Entry point for this script
function load() {
  // Insert signature
  Mousetrap.bind('ctrl+shift+e', function(e) {
    e.preventDefault();
    extensionStorage().sync.get([SIGNATURE_STORAGE_KEY], function(data) {
      insertSignature(signatureToHtml(data[SIGNATURE_STORAGE_KEY]));
    });
  });
  // Confirm email
  Mousetrap.bind('ctrl+,', confirmEmail);
  Mousetrap.bind('ctrl+f', confirmEmail);
  // Search user
  Mousetrap.bind('ctrl+y', function(e) {
    var email = getSenderEmail();
    window.open('https://lichess.org/mod/search?q=' + email);
  });
  // Initialize Hermes
  initHermes();
}

/**
 * Heuristic for an open message thread, based only on the location fragment (not Gmail
 * HTML). Typical pattern: #label_or_box/threadId with a long opaque id as the last
 * segment. Short two-segment paths (e.g. #search/term) are mostly excluded by length.
 */
function isGmailThreadViewFromUrl() {
  var h = (location.hash || '').replace(/^#/, '');
  if (!h) return false;
  var parts = h.split('/').map(function (p) {
    try { return decodeURIComponent(p); } catch (e) { return p; }
  });
  if (parts.length < 2) return false;
  var last = (parts[parts.length - 1] || '').trim();
  if (last.length < 8) return false;
  if (!/^[0-9A-Za-z_\-+]+$/.test(last)) return false;
  if (/^(compose|p\d+)$/i.test(last)) return false;
  return true;
}

// Hermes UI: button + dock fixed to bottom of viewport
function initHermes() {
  var hermesHostId = 'lichess-gmail-hermes-host';
  var dockHostId = 'lichess-gmail-hermes-dock';
  var templatesApiUrl = 'https://hermes.lichess.app/api/templates';
  var templatesRefreshMs = 6 * 60 * 60 * 1000; // 6 hours
  if (document.getElementById(hermesHostId)) return;

  // Hermes state
  var state = {
    hermesEnabled: false,
    urlPollId: null,
    templatesRefreshId: null,
    lastSeenUrl: location.href,
    templates: [],
    templatesLoaded: false,
    templatesLoadError: false,
    selectedCategory: 'all',
    categories: []
  };
  var selectedCategoryStorageKey = 'lichess-gmail.hermes.selectedCategory';

  // State persistence and normalization
  try {
    var savedCategory = window.localStorage.getItem(selectedCategoryStorageKey);
    if (savedCategory) state.selectedCategory = normalizeCategory(savedCategory) || 'all';
  } catch (e) {}

  function normalizeCategory(c) {
    if (typeof c !== 'string') return '';
    return c.trim().toLowerCase();
  }

  function formatCategoryLabel(c) {
    if (!c) return 'Uncategorized';
    return c.charAt(0).toUpperCase() + c.slice(1);
  }

  // Data and category management
  function recomputeCategories() {
    var previousCategory = state.selectedCategory;
    var seen = Object.create(null);
    state.templates.forEach(function(t) {
      var k = normalizeCategory(t && t.category);
      if (k) seen[k] = true;
    });
    state.categories = Object.keys(seen).sort(function(a, b) {
      return a.localeCompare(b);
    });
    if (state.selectedCategory !== 'all' && state.categories.indexOf(state.selectedCategory) === -1) {
      state.selectedCategory = 'all';
    }
    if (state.selectedCategory !== previousCategory) persistSelectedCategory();
  }

  function persistSelectedCategory() {
    try {
      window.localStorage.setItem(selectedCategoryStorageKey, state.selectedCategory);
    } catch (e) {}
  }

  function stopUrlPoll() {
    if (state.urlPollId != null) {
      clearInterval(state.urlPollId);
      state.urlPollId = null;
    }
  }

  function onLocationMaybeChanged() {
    if (location.href === state.lastSeenUrl) return;
    state.lastSeenUrl = location.href;
    updateThreadDock();
  }

  function startUrlPoll() {
    if (state.urlPollId != null) return;
    state.urlPollId = setInterval(onLocationMaybeChanged, 900);
  }

  // Reply helpers
  function getReplyEditable() {
    return document.querySelector('div.editable[id][contenteditable][g_editable]');
  }

  function withSignatureIfNeeded(template, done) {
    var body = (template && typeof template.body === 'string') ? template.body : '';
    if (!template || !template.appendSignature) {
      done(body);
      return;
    }
    extensionStorage().sync.get([SIGNATURE_STORAGE_KEY], function(data) {
      var signatureHtml = signatureToHtml(data[SIGNATURE_STORAGE_KEY]);
      done(body + signatureHtml);
    });
  }

  function applyTemplateHtmlToReply(template) {
    withSignatureIfNeeded(template, function(html) {
      var editable = getReplyEditable();
      if (editable) {
        setReply(html);
        return;
      }

      clickReply();
      var attemptsLeft = 40;
      var timer = setInterval(function() {
        var nextEditable = getReplyEditable();
        if (nextEditable) {
          clearInterval(timer);
          setReply(html);
          return;
        }
        attemptsLeft -= 1;
        if (attemptsLeft <= 0) clearInterval(timer);
      }, 100);
    });
  }

  // Dock rendering helpers
  function getDockParts() {
    var dock = document.getElementById(dockHostId);
    if (!dock || !dock.shadowRoot) return null;
    return {
      templatesRow: dock.shadowRoot.querySelector('.templatesRow'),
      controlsRow: dock.shadowRoot.querySelector('.controlsRow')
    };
  }

  function appendUtilityButtons(row) {
    var reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'utility';
    reload.setAttribute('aria-label', 'Reload templates');
    reload.appendChild(document.createTextNode('Reload'));
    reload.addEventListener('click', function() {
      state.templatesLoaded = false;
      state.templatesLoadError = false;
      renderDock();
      fetchTemplatesAndRender();
    });
    row.appendChild(reload);

    var edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'utility';
    edit.setAttribute('aria-label', 'Edit templates');
    edit.appendChild(document.createTextNode('Edit templates'));
    edit.addEventListener('click', function() {
      window.open('https://hermes.lichess.app/admin', '_blank', 'noopener,noreferrer');
    });
    row.appendChild(edit);
  }

  function appendCollapseButton(row) {
    var collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'utility collapse';
    collapse.setAttribute('aria-label', 'Collapse Hermes tools (Ctrl+Shift+G)');
    collapse.appendChild(document.createTextNode('Collapse (Ctrl+Shift+G)'));
    collapse.addEventListener('click', function() {
      setHermesEnabled(false);
    });
    row.appendChild(collapse);
  }

  function appendCategorySelector(row) {
    var wrap = document.createElement('span');
    wrap.className = 'category';

    var label = document.createElement('span');
    label.className = 'categoryLabel';
    label.appendChild(document.createTextNode('Category'));
    wrap.appendChild(label);

    var select = document.createElement('select');
    select.className = 'categorySelect';
    select.setAttribute('aria-label', 'Template category');

    var allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.appendChild(document.createTextNode('All'));
    select.appendChild(allOpt);

    state.categories.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.appendChild(document.createTextNode(formatCategoryLabel(c)));
      select.appendChild(opt);
    });

    select.value = state.selectedCategory;
    select.addEventListener('change', function() {
      state.selectedCategory = select.value;
      persistSelectedCategory();
      renderDock();
    });

    wrap.appendChild(select);
    row.appendChild(wrap);
  }

  function clearNode(n) {
    if (!n) return;
    while (n.firstChild) n.removeChild(n.firstChild);
  }

  // Dock rendering
  function renderDock() {
    var parts = getDockParts();
    if (!parts || !parts.templatesRow || !parts.controlsRow) return;
    clearNode(parts.templatesRow);
    clearNode(parts.controlsRow);

    // Controls on bottom row
    appendCategorySelector(parts.controlsRow);
    appendUtilityButtons(parts.controlsRow);
    appendCollapseButton(parts.controlsRow);

    if (!state.templatesLoaded && !state.templatesLoadError) {
      var loading = document.createElement('span');
      loading.className = 'status';
      loading.appendChild(document.createTextNode('Loading templates...'));
      parts.templatesRow.appendChild(loading);
      return;
    }

    if (state.templatesLoadError) {
      var error = document.createElement('span');
      error.className = 'status';
      error.appendChild(document.createTextNode('Could not load templates'));
      parts.templatesRow.appendChild(error);
      return;
    }

    if (!state.templates.length) {
      var empty = document.createElement('span');
      empty.className = 'status';
      empty.appendChild(document.createTextNode('No templates available'));
      parts.templatesRow.appendChild(empty);
      return;
    }

    var filtered = state.templates.filter(function(t) {
      if (state.selectedCategory === 'all') return true;
      return normalizeCategory(t && t.category) === state.selectedCategory;
    });

    if (!filtered.length) {
      var none = document.createElement('span');
      none.className = 'status';
      none.appendChild(document.createTextNode('No templates in this category'));
      parts.templatesRow.appendChild(none);
      return;
    }

    filtered.forEach(function(template) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'templateChip';
      var name = (template && typeof template.name === 'string' && template.name.trim())
        ? template.name.trim()
        : ('Template ' + String(template && template.id != null ? template.id : ''));
      b.setAttribute('aria-label', name);
      b.setAttribute('title', name);
      b.appendChild(document.createTextNode(name));
      b.addEventListener('click', function() {
        applyTemplateHtmlToReply(template);
      });
      parts.templatesRow.appendChild(b);
    });
  }

  // Template fetching lifecycle
  function fetchTemplatesAndRender() {
    return fetch(templatesApiUrl)
      .then(function(res) {
        if (!res.ok) throw new Error('Bad status ' + res.status);
        return res.json();
      })
      .then(function(payload) {
        var next = payload && Array.isArray(payload.templates) ? payload.templates : [];
        state.templates = next;
        state.templatesLoaded = true;
        state.templatesLoadError = false;
        recomputeCategories();
        renderDock();
      })
      .catch(function() {
        state.templatesLoaded = true;
        state.templatesLoadError = true;
        renderDock();
      });
  }

  function startTemplatesRefreshLoop() {
    if (state.templatesRefreshId != null) return;
    state.templatesRefreshId = setInterval(fetchTemplatesAndRender, templatesRefreshMs);
  }

  // Visibility, toggle, and navigation events
  function updateThreadDock() {
    var dock = document.getElementById(dockHostId);
    if (!dock) return;
    var isThreadView = isGmailThreadViewFromUrl();
    var on = state.hermesEnabled && isThreadView;
    dock.style.display = on ? 'block' : 'none';
    dock.setAttribute('aria-hidden', on ? 'false' : 'true');
    updateHermesLauncherVisibility(isThreadView);
  }

  function updateHermesLauncherVisibility(isThreadView) {
    var h = document.getElementById(hermesHostId);
    if (!h) return;
    var threadView = typeof isThreadView === 'boolean' ? isThreadView : isGmailThreadViewFromUrl();
    var showLauncher = threadView && !state.hermesEnabled;
    h.style.display = showLauncher ? 'block' : 'none';
    h.setAttribute('aria-hidden', showLauncher ? 'false' : 'true');
  }

  function setHermesEnabled(next) {
    state.hermesEnabled = next;
    state.lastSeenUrl = location.href;
    var h = document.getElementById(hermesHostId);
    if (h && h.shadowRoot) {
      var b = h.shadowRoot.querySelector('button');
      if (b) b.setAttribute('aria-pressed', state.hermesEnabled ? 'true' : 'false');
    }
    updateHermesLauncherVisibility();
    if (state.hermesEnabled) startUrlPoll();
    else stopUrlPoll();
    updateThreadDock();
  }

  function onHermesClick() {
    setHermesEnabled(!state.hermesEnabled);
  }

  function toggleHermesEnabledWithShortcut(e) {
    if (e && e.preventDefault) e.preventDefault();
    setHermesEnabled(!state.hermesEnabled);
  }

  function createHermesLauncherButton() {
    var hermesHost = document.createElement('div');
    hermesHost.id = hermesHostId;
    hermesHost.setAttribute('data-lichess-gmail', 'hermes');
    hermesHost.setAttribute('aria-hidden', 'true');
    hermesHost.style.cssText = [
      'box-sizing: border-box',
      'position: fixed',
      'z-index: 2147483647',
      'bottom: 0',
      'right: 0',
      'display: none',
      'margin: 0',
      'padding: 0',
      'border: 0',
      'background: transparent',
      'pointer-events: auto'
    ].join('; ');

    var hRoot = hermesHost.attachShadow({ mode: 'open' });
    var hStyle = document.createElement('style');
    hStyle.textContent = [
      ':host { display: block; }',
      'button {',
      '  font: 12px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
      '  margin: 0 8px 8px 0;',
      '  padding: 6px 12px;',
      '  color: #202124;',
      '  background: #fff;',
      '  border: 1px solid rgba(60,64,67,0.28);',
      '  border-radius: 6px;',
      '  box-shadow: 0 1px 2px rgba(60,64,67,0.15), 0 1px 1px rgba(60,64,67,0.1);',
      '  cursor: pointer;',
      '  user-select: none;',
      '  -webkit-user-select: none;',
      '}',
      'button[aria-pressed="true"] {',
      '  background: #e8f0fe;',
      '  border-color: #1a73e8;',
      '  color: #1967d2;',
      '}'
    ].join('\n');
    var launcherButton = document.createElement('button');
    launcherButton.type = 'button';
    launcherButton.setAttribute('aria-label', 'Hermes (Ctrl+Shift+G)');
    launcherButton.setAttribute('aria-pressed', 'false');
    launcherButton.setAttribute('title', 'Turn Hermes message tools on or off (Ctrl+Shift+G)');
    launcherButton.appendChild(document.createTextNode('Hermes (Ctrl+Shift+G)'));
    launcherButton.addEventListener('click', onHermesClick);

    hRoot.appendChild(hStyle);
    hRoot.appendChild(launcherButton);
    return hermesHost;
  }

  function createHermesDock() {
    var dockHost = document.createElement('div');
    dockHost.id = dockHostId;
    dockHost.setAttribute('data-lichess-gmail', 'hermes-dock');
    dockHost.setAttribute('role', 'region');
    dockHost.setAttribute('aria-label', 'Hermes thread tools');
    dockHost.setAttribute('aria-hidden', 'true');
    dockHost.style.cssText = [
      'box-sizing: border-box',
      'position: fixed',
      'z-index: 2147483646',
      'left: 0',
      'right: 0',
      'bottom: 0',
      'display: none',
      'margin: 0',
      'padding: 0',
      'border: 0',
      'background: transparent',
      'pointer-events: auto'
    ].join('; ');

    var dRoot = dockHost.attachShadow({ mode: 'open' });
    var dStyle = document.createElement('style');
    dStyle.textContent = [
      ':host {',
      '  display: block;',
      '  font: 12px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
      '  color: #202124;',
      '}',
      '.dock {',
      '  box-sizing: border-box;',
      '  width: 100%;',
      '  background: #fff;',
      '  border-top: 1px solid rgba(60,64,67,0.2);',
      '  box-shadow: 0 -1px 4px rgba(60,64,67,0.12);',
      '  padding: 6px 10px calc(6px + env(safe-area-inset-bottom, 0px));',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 6px;',
      '}',
      '.templatesRow {',
      '  display: flex;',
      '  flex-direction: row;',
      '  flex-wrap: wrap;',
      '  justify-content: center;',
      '  align-items: center;',
      '  gap: 6px;',
      '}',
      '.controlsRow {',
      '  display: flex;',
      '  flex-direction: row;',
      '  flex-wrap: wrap;',
      '  justify-content: center;',
      '  align-items: center;',
      '  gap: 6px;',
      '}',
      'button {',
      '  font: inherit;',
      '  line-height: 1.2;',
        '  min-height: 28px;',
        '  padding: 0 10px;',
      '  color: #202124;',
      '  background: #f1f3f4;',
      '  border: 1px solid rgba(60,64,67,0.2);',
        '  border-radius: 6px;',
      '  cursor: default;',
      '  user-select: none;',
      '  -webkit-user-select: none;',
      '}',
      'button.templateChip {',
      '  min-height: 24px;',
      '  padding: 0 10px;',
      '  border-radius: 9999px;',
      '  background: #e8eaed;',
      '}',
      'button.utility {',
      '  background: #fff;',
      '}',
      '.category {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  padding: 0 4px;',
      '}',
      '.categoryLabel {',
      '  color: #5f6368;',
      '  font-size: 12px;',
      '}',
      '.categorySelect {',
      '  font: inherit;',
      '  min-height: 32px;',
      '  padding: 0 10px;',
      '  background: #fff;',
      '  border: 1px solid rgba(60,64,67,0.2);',
      '  border-radius: 4px;',
      '  color: #202124;',
      '}',
      '.status {',
      '  color: #5f6368;',
      '  font-size: 12px;',
      '  padding: 0 4px;',
      '}'
    ].join('\n');
    dRoot.appendChild(dStyle);
    var dock = document.createElement('div');
    dock.className = 'dock';

    var templatesRow = document.createElement('div');
    templatesRow.className = 'templatesRow';
    dock.appendChild(templatesRow);

    var controlsRow = document.createElement('div');
    controlsRow.className = 'controlsRow';
    dock.appendChild(controlsRow);

    dRoot.appendChild(dock);
    return dockHost;
  }

  // DOM mount and startup wiring
  function mount() {
    if (document.getElementById(hermesHostId)) return;

    var hermesHost = createHermesLauncherButton();
    var dockHost = createHermesDock();

    (document.body || document.documentElement).appendChild(hermesHost);
    (document.body || document.documentElement).appendChild(dockHost);

    window.addEventListener('hashchange', onLocationMaybeChanged, false);
    window.addEventListener('popstate', onLocationMaybeChanged, false);

    renderDock();
    fetchTemplatesAndRender();
    startTemplatesRefreshLoop();
    updateThreadDock();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });

  Mousetrap.bind('ctrl+shift+g', toggleHermesEnabledWithShortcut);
}

load();
