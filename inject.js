function load() {
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
  Mousetrap.bind('ctrl+shift+e', function(e) {
    e.preventDefault();
    extensionStorage().sync.get([SIGNATURE_STORAGE_KEY], function(data) {
      insertSignature(signatureToHtml(data[SIGNATURE_STORAGE_KEY]));
    });
  });
  Mousetrap.bind('ctrl+,', confirmEmail);
  Mousetrap.bind('ctrl+f', confirmEmail);
  Mousetrap.bind('ctrl+y', function(e) {
    var email = getSenderEmail();
    window.open('https://lichess.org/mod/search?q=' + email);
  });
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

/**
 * Inject Hermes button + dock. We only touch our own nodes. The dock is fixed to
 * the bottom of the viewport so it survives Gmail layout changes.
 */
function initHermesUi() {
  var hermesHostId = 'lichess-gmail-hermes-host';
  var dockHostId = 'lichess-gmail-hermes-dock';
  var templatesApiUrl = 'https://hermes.lichess.app/api/templates';
  var templatesRefreshMs = 6 * 60 * 60 * 1000; // 6 hours
  if (document.getElementById(hermesHostId)) return;

  var hermesEnabled = false;
  var urlPollId = null;
  var templatesRefreshId = null;
  var lastSeenUrl = location.href;
  var templates = [];
  var templatesLoaded = false;
  var templatesLoadError = false;

  function stopUrlPoll() {
    if (urlPollId != null) {
      clearInterval(urlPollId);
      urlPollId = null;
    }
  }

  function onLocationMaybeChanged() {
    if (location.href === lastSeenUrl) return;
    lastSeenUrl = location.href;
    updateThreadDock();
  }

  function startUrlPoll() {
    if (urlPollId != null) return;
    urlPollId = setInterval(onLocationMaybeChanged, 900);
  }

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

  function getDockRow() {
    var dock = document.getElementById(dockHostId);
    if (!dock || !dock.shadowRoot) return null;
    return dock.shadowRoot.querySelector('.row');
  }

  function appendUtilityButtons(row) {
    var reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'utility';
    reload.setAttribute('aria-label', 'Reload templates');
    reload.appendChild(document.createTextNode('Reload'));
    reload.addEventListener('click', function() {
      templatesLoaded = false;
      templatesLoadError = false;
      renderTemplateButtons();
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
    collapse.setAttribute('aria-label', 'Collapse Hermes tools (Ctrl+Shift+Q)');
    collapse.appendChild(document.createTextNode('Collapse (Ctrl+Shift+Q)'));
    collapse.addEventListener('click', function() {
      setHermesEnabled(false);
    });
    row.appendChild(collapse);
  }

  function renderTemplateButtons() {
    var row = getDockRow();
    if (!row) return;
    while (row.firstChild) row.removeChild(row.firstChild);

    if (!templatesLoaded && !templatesLoadError) {
      var loading = document.createElement('span');
      loading.className = 'status';
      loading.appendChild(document.createTextNode('Loading templates...'));
      row.appendChild(loading);
      appendUtilityButtons(row);
      appendCollapseButton(row);
      return;
    }

    if (templatesLoadError) {
      var error = document.createElement('span');
      error.className = 'status';
      error.appendChild(document.createTextNode('Could not load templates'));
      row.appendChild(error);
      appendUtilityButtons(row);
      appendCollapseButton(row);
      return;
    }

    if (!templates.length) {
      var empty = document.createElement('span');
      empty.className = 'status';
      empty.appendChild(document.createTextNode('No templates available'));
      row.appendChild(empty);
      appendUtilityButtons(row);
      appendCollapseButton(row);
      return;
    }

    templates.forEach(function(template) {
      var b = document.createElement('button');
      b.type = 'button';
      var name = (template && typeof template.name === 'string' && template.name.trim())
        ? template.name.trim()
        : ('Template ' + String(template && template.id != null ? template.id : ''));
      b.setAttribute('aria-label', name);
      b.appendChild(document.createTextNode(name));
      b.addEventListener('click', function() {
        applyTemplateHtmlToReply(template);
      });
      row.appendChild(b);
    });

    appendUtilityButtons(row);
    appendCollapseButton(row);
  }

  function fetchTemplatesAndRender() {
    return fetch(templatesApiUrl)
      .then(function(res) {
        if (!res.ok) throw new Error('Bad status ' + res.status);
        return res.json();
      })
      .then(function(payload) {
        var next = payload && Array.isArray(payload.templates) ? payload.templates : [];
        templates = next;
        templatesLoaded = true;
        templatesLoadError = false;
        renderTemplateButtons();
      })
      .catch(function() {
        templatesLoaded = true;
        templatesLoadError = true;
        renderTemplateButtons();
      });
  }

  function startTemplatesRefreshLoop() {
    if (templatesRefreshId != null) return;
    templatesRefreshId = setInterval(fetchTemplatesAndRender, templatesRefreshMs);
  }

  function updateThreadDock() {
    var dock = document.getElementById(dockHostId);
    if (!dock) return;
    var isThreadView = isGmailThreadViewFromUrl();
    var on = hermesEnabled && isThreadView;
    dock.style.display = on ? 'block' : 'none';
    dock.setAttribute('aria-hidden', on ? 'false' : 'true');
    updateHermesLauncherVisibility(isThreadView);
  }

  function updateHermesLauncherVisibility(isThreadView) {
    var h = document.getElementById(hermesHostId);
    if (!h) return;
    var threadView = typeof isThreadView === 'boolean' ? isThreadView : isGmailThreadViewFromUrl();
    var showLauncher = threadView && !hermesEnabled;
    h.style.display = showLauncher ? 'block' : 'none';
    h.setAttribute('aria-hidden', showLauncher ? 'false' : 'true');
  }

  function setHermesEnabled(next) {
    hermesEnabled = next;
    lastSeenUrl = location.href;
    var h = document.getElementById(hermesHostId);
    if (h && h.shadowRoot) {
      var b = h.shadowRoot.querySelector('button');
      if (b) b.setAttribute('aria-pressed', hermesEnabled ? 'true' : 'false');
    }
    updateHermesLauncherVisibility();
    if (hermesEnabled) startUrlPoll();
    else stopUrlPoll();
    updateThreadDock();
  }

  function onHermesClick() {
    setHermesEnabled(!hermesEnabled);
  }

  function toggleHermesEnabledWithShortcut(e) {
    if (e && e.preventDefault) e.preventDefault();
    setHermesEnabled(!hermesEnabled);
  }

  function mount() {
    if (document.getElementById(hermesHostId)) return;

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
    var hermesBtn = document.createElement('button');
    hermesBtn.type = 'button';
    hermesBtn.setAttribute('aria-label', 'Hermes (Ctrl+Shift+Q)');
    hermesBtn.setAttribute('aria-pressed', 'false');
    hermesBtn.setAttribute('title', 'Turn Hermes message tools on or off (Ctrl+Shift+Q)');
    hermesBtn.appendChild(document.createTextNode('Hermes (Ctrl+Shift+Q)'));
    hermesBtn.addEventListener('click', onHermesClick);

    hRoot.appendChild(hStyle);
    hRoot.appendChild(hermesBtn);

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
      '.row {',
      '  display: flex;',
      '  flex-direction: row;',
      '  flex-wrap: wrap;',
      '  justify-content: center;',
      '  align-items: center;',
      '  gap: 8px;',
      '  box-sizing: border-box;',
      '  width: 100%;',
      '  padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));',
      '  background: #fff;',
      '  border-top: 1px solid rgba(60,64,67,0.2);',
      '  box-shadow: 0 -1px 4px rgba(60,64,67,0.12);',
      '}',
      'button {',
      '  font: inherit;',
      '  line-height: 1.2;',
      '  min-height: 32px;',
      '  padding: 0 12px;',
      '  color: #202124;',
      '  background: #f1f3f4;',
      '  border: 1px solid rgba(60,64,67,0.2);',
      '  border-radius: 4px;',
      '  cursor: default;',
      '  user-select: none;',
      '  -webkit-user-select: none;',
      '}',
      'button.utility {',
      '  background: #fff;',
      '}',
      '.status {',
      '  color: #5f6368;',
      '  font-size: 12px;',
      '  padding: 0 4px;',
      '}'
    ].join('\n');
    var row = document.createElement('div');
    row.className = 'row';
    var loading = document.createElement('span');
    loading.className = 'status';
    loading.appendChild(document.createTextNode('Loading templates...'));
    row.appendChild(loading);

    dRoot.appendChild(dStyle);
    dRoot.appendChild(row);

    (document.body || document.documentElement).appendChild(hermesHost);
    (document.body || document.documentElement).appendChild(dockHost);

    window.addEventListener('hashchange', onLocationMaybeChanged, false);
    window.addEventListener('popstate', onLocationMaybeChanged, false);

    renderTemplateButtons();
    fetchTemplatesAndRender();
    startTemplatesRefreshLoop();
    updateThreadDock();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });

  Mousetrap.bind('ctrl+shift+q', toggleHermesEnabledWithShortcut);
}

load();
initHermesUi();

function getSenderEmail() {
  return document.querySelector('tr.acZ span[email]').getAttribute('email');
  // return document.querySelector('img.ajn[jid]').getAttribute('jid');
}

function clickReply() {
  const replies = document.querySelectorAll('button[aria-label=Reply] span[jsname][aria-hidden=true]');
  if (replies.length > 0) replies[replies.length - 1].click();
}

function setReply(html) {
  document.querySelector('div.editable[id][contenteditable][g_editable]').innerHTML = html;
}

function insertSignature(html) {
  var editable = document.activeElement && document.activeElement.closest
    ? document.activeElement.closest('div[contenteditable="true"]')
    : null;
  if (!editable) editable = document.querySelector('div.editable[id][contenteditable][g_editable]');
  if (!editable) return;
  editable.focus();
  document.execCommand('insertHTML', false, html);
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
