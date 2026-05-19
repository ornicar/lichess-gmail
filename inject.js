const isGmail = () => /^https:\/\/mail\.google\.com\//i.test(location.href);
const isLinkedIn = () => /^https:\/\/(www\.)?linkedin\.com\//i.test(location.href);

// Various helpers
const getSenderEmail = () =>
  document.querySelector('tr.acZ span[email]').getAttribute('email');
// document.querySelector('img.ajn[jid]').getAttribute('jid');

const clickReply = () => {
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
  Array.from(container.querySelectorAll('a[href]')).forEach((link) => {
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

const setReply = (html) => {
  document.querySelector('div.editable[id][contenteditable][g_editable]').innerHTML = sanitizeInjectedHtml(html);
};

function htmlToPlainText(html) {
  var tmp = document.createElement('div');
  tmp.innerHTML = typeof html === 'string' ? html : '';
  return (tmp.textContent || tmp.innerText || '').replace(/\u00a0/g, ' ');
}

function isContentEditableElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.isContentEditable) return true;
  var ce = el.getAttribute?.('contenteditable');
  return ce != null && ce !== 'false';
}

function insertIntoFocusedField(html) {
  var active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return false;

  var editable = active.closest?.('[contenteditable]:not([contenteditable="false"])');
  if (isContentEditableElement(editable) || isContentEditableElement(active)) {
    var target = editable || active;
    target.focus();
    document.execCommand('insertHTML', false, sanitizeInjectedHtml(html));
    return true;
  }

  if (active.matches?.('textarea, input[type="text"], input[type="search"], input:not([type])')) {
    var text = htmlToPlainText(html);
    var start = active.selectionStart ?? active.value.length;
    var end = active.selectionEnd ?? start;
    active.value = active.value.slice(0, start) + text + active.value.slice(end);
    active.selectionStart = active.selectionEnd = start + text.length;
    active.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return true;
  }

  return false;
}

function preventHermesControlFocusSteal(el) {
  el.addEventListener('mousedown', function(e) {
    e.preventDefault();
  });
}

const insertSignature = (html) => {
  if (isLinkedIn()) {
    insertIntoFocusedField(html);
    return;
  }
  var editable =
    document.activeElement?.closest?.('div[contenteditable="true"]') ||
    document.querySelector('div.editable[id][contenteditable][g_editable]');
  if (!editable) return;
  editable.focus();
  document.execCommand('insertHTML', false, sanitizeInjectedHtml(html));
};

const setReplyEmail = (email) => {
  var el = Array.from(document.querySelectorAll('form span')).find((o) => o.textContent === REPLY_SEND_AS_DISPLAY);
  if (el) el.innerHTML = email;
};

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
  e?.preventDefault?.();
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

function searchSender(e) {
  e?.preventDefault?.();
  var email = getSenderEmail();
  window.open('https://lichess.org/mod/search?q=' + email);
}

const openProfileFromSelection = (e) => {
  e?.preventDefault?.();
  var m = window.getSelection().toString().match(/[a-z0-9][\w-]*[a-z0-9]/i);
  if (m) window.open('https://lichess.org/@/' + m[0] + '?mod');
};

// Entry point for this script
function load() {
  initHermes();

  if (!isGmail()) return;

  // Insert signature
  Mousetrap.bind('ctrl+shift+e', function(e) {
    e.preventDefault();
    extensionStorage().sync.get([SIGNATURE_STORAGE_KEY], function(data) {
      insertSignature(signatureToHtml(data[SIGNATURE_STORAGE_KEY]));
    });
  });
  // Confirm email
  Mousetrap.bind('ctrl+,', confirmEmail);
  // Search for user by email
  Mousetrap.bind('ctrl+y', searchSender);
  Mousetrap.bind('ctrl+f', searchSender);
  // Open profile for selected username
  Mousetrap.bind('ctrl+shift+f', openProfileFromSelection);
}

/**
 * Heuristic for an open message thread, based only on the location fragment (not Gmail
 * HTML). Typical pattern: #label_or_box/threadId with a long opaque id as the last
 * segment. Short two-segment paths (e.g. #search/term) are mostly excluded by length.
 */
function isGmailThreadViewFromUrl() {
  var h = (location.hash || '').replace(/^#/, '');
  if (!h) return false;
  var parts = h.split('/').map((p) => {
    try { return decodeURIComponent(p); } catch (e) { return p; }
  });
  if (parts.length < 2) return false;
  var last = (parts[parts.length - 1] || '').trim();
  return (
    last.length >= 8 &&
    /^[0-9A-Za-z_\-+]+$/.test(last) &&
    !/^(compose|p\d+)$/i.test(last)
  );
}

// Hermes UI: button + dock fixed to bottom of viewport
function initHermes() {
  var hermesHostId = 'lichess-gmail-hermes-host';
  var dockHostId = 'lichess-gmail-hermes-dock';
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
    categories: [],
    shortcutsVisible: false
  };
  var selectedCategoryStorageKey = 'lichess-gmail.hermes.selectedCategory';

  const normalizeCategory = (c) => typeof(c) === 'string' ? c.trim().toLowerCase() : '';
  const formatCategoryLabel = (c) => (!c ? 'Uncategorized' : c.charAt(0).toUpperCase() + c.slice(1));

  function appendHermesStylesheet(shadowRoot) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = extensionRuntime().getURL('styles.css');
    shadowRoot.appendChild(link);
  }

  // State persistence and normalization
  try {
    var savedCategory = window.localStorage.getItem(selectedCategoryStorageKey);
    if (savedCategory) state.selectedCategory = normalizeCategory(savedCategory) || 'all';
  } catch (e) {}

  // Data and category management
  function recomputeCategories() {
    var previousCategory = state.selectedCategory;
    var seen = Object.create(null);
    state.templates.forEach((t) => {
      var k = normalizeCategory(t && t.category);
      if (k) seen[k] = true;
    });
    state.categories = Object.keys(seen).sort((a, b) => a.localeCompare(b));
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
  const getReplyEditable = () =>
    document.querySelector('div.editable[id][contenteditable][g_editable]');

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

  function applyTemplate(template) {
    withSignatureIfNeeded(template, function(html) {
      if (isLinkedIn()) {
        insertIntoFocusedField(html);
        return;
      }

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
      controlsRow: dock.shadowRoot.querySelector('.controlsRow'),
      shortcutsPanel: dock.shadowRoot.getElementById('lichess-gmail-shortcuts-panel')
    };
  }

  function syncShortcutsPanel(parts) {
    if (!parts) return;
    var panel = parts.shortcutsPanel;
    if (panel) {
      state.shortcutsVisible ? panel.removeAttribute('hidden') : panel.setAttribute('hidden', '');
    }
    var btn = parts.controlsRow && parts.controlsRow.querySelector('#lichess-gmail-shortcuts-toggle');
    if (btn) {
      btn.setAttribute('aria-expanded', state.shortcutsVisible ? 'true' : 'false');
      while (btn.firstChild) btn.removeChild(btn.firstChild);
      btn.appendChild(document.createTextNode(state.shortcutsVisible ? 'Hide shortcuts' : 'Shortcuts'));
    }
  }

  function appendShortcutRow(container, keyLabels, description) {
    var row = document.createElement('div');
    row.className = 'shortcutRow';
    var keys = document.createElement('span');
    keys.className = 'shortcutKeys';
    keyLabels.forEach((label, i) => {
      if (i > 0) keys.appendChild(document.createTextNode(' or '));
      var kbd = document.createElement('kbd');
      kbd.appendChild(document.createTextNode(label));
      keys.appendChild(kbd);
    });
    var desc = document.createElement('span');
    desc.className = 'shortcutDesc';
    desc.appendChild(document.createTextNode(description));
    row.appendChild(keys);
    row.appendChild(desc);
    container.appendChild(row);
  }

  function fillShortcutsPanel(panel) {
    if (!panel || panel.getAttribute('data-filled') === '1') return;
    panel.setAttribute('data-filled', '1');
    var title = document.createElement('div');
    title.className = 'shortcutsTitle';
    title.appendChild(document.createTextNode('Keyboard shortcuts'));
    panel.appendChild(title);
    appendShortcutRow(panel, ['Ctrl+Shift+G'], 'Show/hide Hermes dock');
    appendShortcutRow(panel, ['Ctrl+Shift+E'], 'Insert your configured signature');
    appendShortcutRow(panel, ['Ctrl+Y', 'Ctrl+F'], 'Open mod search with sender email');
    appendShortcutRow(panel, ['Ctrl+Shift+F'], 'Open profile for username in selection');
    appendShortcutRow(panel, ['Ctrl+,'], 'Confirm email (legacy)');
    appendShortcutRow(panel, ['Right-click menu'], 'If selected text is an email open mod search, else open profile.');
  }

  function appendUtilityButtons(row) {
    var reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'utility';
    reload.setAttribute('aria-label', 'Reload templates');
    reload.appendChild(document.createTextNode('Reload'));
    preventHermesControlFocusSteal(reload);
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
    preventHermesControlFocusSteal(edit);
    edit.addEventListener('click', function() {
      window.open('https://hermes.lichess.app/admin', '_blank', 'noopener,noreferrer');
    });
    row.appendChild(edit);

    var shortcutsToggle = document.createElement('button');
    shortcutsToggle.type = 'button';
    shortcutsToggle.id = 'lichess-gmail-shortcuts-toggle';
    shortcutsToggle.className = 'utility';
    shortcutsToggle.setAttribute('aria-expanded', 'false');
    shortcutsToggle.setAttribute('aria-controls', 'lichess-gmail-shortcuts-panel');
    shortcutsToggle.setAttribute('aria-label', 'Show or hide keyboard shortcuts');
    shortcutsToggle.appendChild(document.createTextNode('Shortcuts'));
    preventHermesControlFocusSteal(shortcutsToggle);
    shortcutsToggle.addEventListener('click', function() {
      state.shortcutsVisible = !state.shortcutsVisible;
      syncShortcutsPanel(getDockParts());
    });
    row.appendChild(shortcutsToggle);
  }

  function appendCollapseButton(row) {
    var collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'utility collapse';
    collapse.setAttribute('aria-label', 'Collapse Hermes tools (Ctrl+Shift+G)');
    collapse.appendChild(document.createTextNode('Collapse (Ctrl+Shift+G)'));
    preventHermesControlFocusSteal(collapse);
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

    state.categories.forEach((c) => {
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

  const clearNode = (n) => {
    while (n && n.firstChild) n.removeChild(n.firstChild);
  };

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
    syncShortcutsPanel(parts);

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

    var filtered = state.templates.filter(
      (t) =>
        state.selectedCategory === 'all' || normalizeCategory(t && t.category) === state.selectedCategory
    );

    if (!filtered.length) {
      var none = document.createElement('span');
      none.className = 'status';
      none.appendChild(document.createTextNode('No templates in this category'));
      parts.templatesRow.appendChild(none);
      return;
    }

    filtered.forEach((template) => {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'templateChip';
      var name = (template && typeof template.name === 'string' && template.name.trim())
        ? template.name.trim()
        : ('Template ' + String(template && template.id != null ? template.id : ''));
      b.setAttribute('aria-label', name);
      b.setAttribute('title', name);
      b.appendChild(document.createTextNode(name));
      preventHermesControlFocusSteal(b);
      b.addEventListener('click', () => {
        applyTemplate(template);
      });
      parts.templatesRow.appendChild(b);
    });
  }

  // Template fetching lifecycle (background worker bypasses page CSP)
  function fetchTemplatesAndRender() {
    return extensionRuntime()
      .sendMessage({ type: 'hermesFetchTemplates' })
      .then((response) => {
        if (!response || !response.ok) throw new Error((response && response.error) || 'fetch failed');
        var payload = response.payload;
        var next = payload && Array.isArray(payload.templates) ? payload.templates : [];
        state.templates = next;
        state.templatesLoaded = true;
        state.templatesLoadError = false;
        recomputeCategories();
        renderDock();
      })
      .catch(() => {
        state.templatesLoaded = true;
        state.templatesLoadError = true;
        renderDock();
      });
  }

  function startTemplatesRefreshLoop() {
    if (state.templatesRefreshId != null) return;
    state.templatesRefreshId = setInterval(fetchTemplatesAndRender, templatesRefreshMs);
  }

  function hermesContextActive() {
    return isLinkedIn() || isGmailThreadViewFromUrl();
  }

  // Visibility, toggle, and navigation events
  function updateThreadDock() {
    var dock = document.getElementById(dockHostId);
    if (!dock) return;
    var contextActive = hermesContextActive();
    var on = state.hermesEnabled && contextActive;
    dock.style.display = on ? 'block' : 'none';
    dock.setAttribute('aria-hidden', on ? 'false' : 'true');
    updateHermesLauncherVisibility(contextActive);
  }

  function updateHermesLauncherVisibility(contextActive) {
    var h = document.getElementById(hermesHostId);
    if (!h) return;
    var active = typeof contextActive === 'boolean' ? contextActive : hermesContextActive();
    var showLauncher = active && !state.hermesEnabled;
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
    if (state.hermesEnabled && isGmail()) startUrlPoll();
    else stopUrlPoll();
    updateThreadDock();
  }

  function onHermesClick() {
    setHermesEnabled(!state.hermesEnabled);
  }

  function toggleHermesEnabledWithShortcut(e) {
    e?.preventDefault?.();
    setHermesEnabled(!state.hermesEnabled);
  }

  function createHermesLauncherButton() {
    var hermesHost = document.createElement('div');
    hermesHost.id = hermesHostId;
    hermesHost.setAttribute('data-lichess-gmail', 'hermes');
    hermesHost.setAttribute('aria-hidden', 'true');
    hermesHost.style.cssText = [
      'box-sizing: border-box',
      'font: 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
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
    appendHermesStylesheet(hRoot);
    var launcherButton = document.createElement('button');
    launcherButton.type = 'button';
    launcherButton.setAttribute('aria-label', 'Hermes (Ctrl+Shift+G)');
    launcherButton.setAttribute('aria-pressed', 'false');
    launcherButton.setAttribute('title', 'Turn Hermes message tools on or off (Ctrl+Shift+G)');
    launcherButton.appendChild(document.createTextNode('Hermes (Ctrl+Shift+G)'));
    preventHermesControlFocusSteal(launcherButton);
    launcherButton.addEventListener('click', onHermesClick);

    hRoot.appendChild(launcherButton);
    return hermesHost;
  }

  function createHermesDock() {
    var dockHost = document.createElement('div');
    dockHost.id = dockHostId;
    dockHost.setAttribute('data-lichess-gmail', 'hermes-dock');
    dockHost.setAttribute('role', 'region');
    dockHost.setAttribute('aria-label', isLinkedIn() ? 'Hermes message tools' : 'Hermes thread tools');
    dockHost.setAttribute('aria-hidden', 'true');
    dockHost.style.cssText = [
      'box-sizing: border-box',
      'font: 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
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
    appendHermesStylesheet(dRoot);
    var dock = document.createElement('div');
    dock.className = 'dock';

    var templatesRow = document.createElement('div');
    templatesRow.className = 'templatesRow';
    dock.appendChild(templatesRow);

    var controlsRow = document.createElement('div');
    controlsRow.className = 'controlsRow';
    dock.appendChild(controlsRow);

    var shortcutsPanel = document.createElement('div');
    shortcutsPanel.id = 'lichess-gmail-shortcuts-panel';
    shortcutsPanel.className = 'shortcutsPanel';
    shortcutsPanel.setAttribute('role', 'region');
    shortcutsPanel.setAttribute('aria-label', 'Keyboard shortcuts');
    if (!state.shortcutsVisible) shortcutsPanel.setAttribute('hidden', '');
    fillShortcutsPanel(shortcutsPanel);
    dock.appendChild(shortcutsPanel);

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
