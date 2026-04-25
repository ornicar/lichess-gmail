// browser.extension.sendMessage({}, function(response) {
//   var readyStateCheckInterval = setInterval(function() {
//     if (document.readyState === "complete") {
//       clearInterval(readyStateCheckInterval);
//       load();
//     }
//   }, 100);
// });

function load() {
  function confirmEmail(e) {
    var email = getSenderEmail();
    openUrl('https://lichess.org/mod/email-confirm?q=' + email);
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
    openUrl('https://lichess.org/mod/search?q=' + email);
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
 * Injected “Hermes” top button + thread dock. We only touch our own host nodes, use
 * shadow roots, and do not look for a “thread root” in the page. The dock is fixed to
 * the bottom of the viewport (not inline after the last message) so it survives Gmail
 * layout changes; visually it’s still a bottom strip in the message context.
 */
function initHermesUi() {
  var hermesHostId = 'lichess-gmail-hermes-host';
  var dockHostId = 'lichess-gmail-hermes-dock';
  if (document.getElementById(hermesHostId)) return;

  var hermesEnabled = false;
  var urlPollId = null;
  var lastSeenUrl = location.href;

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

  function updateThreadDock() {
    var dock = document.getElementById(dockHostId);
    if (!dock) return;
    var on = hermesEnabled && isGmailThreadViewFromUrl();
    dock.style.display = on ? 'block' : 'none';
    dock.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function setHermesEnabled(next) {
    hermesEnabled = next;
    lastSeenUrl = location.href;
    var h = document.getElementById(hermesHostId);
    if (h && h.shadowRoot) {
      var b = h.shadowRoot.querySelector('button');
      if (b) b.setAttribute('aria-pressed', hermesEnabled ? 'true' : 'false');
      h.style.display = hermesEnabled ? 'none' : 'block';
      h.setAttribute('aria-hidden', hermesEnabled ? 'true' : 'false');
    }
    if (hermesEnabled) startUrlPoll();
    else stopUrlPoll();
    updateThreadDock();
  }

  function onHermesClick() {
    setHermesEnabled(!hermesEnabled);
  }

  function mount() {
    if (document.getElementById(hermesHostId)) return;

    var hermesHost = document.createElement('div');
    hermesHost.id = hermesHostId;
    hermesHost.setAttribute('data-lichess-gmail', 'hermes');
    hermesHost.style.cssText = [
      'box-sizing: border-box',
      'position: fixed',
      'z-index: 2147483647',
      'bottom: 0',
      'right: 0',
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
    hermesBtn.setAttribute('aria-label', 'Hermes');
    hermesBtn.setAttribute('aria-pressed', 'false');
    hermesBtn.setAttribute('title', 'Turn Hermes message tools on or off');
    hermesBtn.appendChild(document.createTextNode('Hermes'));
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
      '}'
    ].join('\n');
    var row = document.createElement('div');
    row.className = 'row';
    for (var i = 0; i < 3; i += 1) {
      var mb = document.createElement('button');
      mb.type = 'button';
      mb.setAttribute('aria-label', 'Mock ' + (i + 1));
      mb.appendChild(document.createTextNode('Mock ' + (i + 1)));
      row.appendChild(mb);
    }

    dRoot.appendChild(dStyle);
    dRoot.appendChild(row);

    (document.body || document.documentElement).appendChild(hermesHost);
    (document.body || document.documentElement).appendChild(dockHost);

    window.addEventListener('hashchange', onLocationMaybeChanged, false);
    window.addEventListener('popstate', onLocationMaybeChanged, false);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}

load();
initHermesUi();

function openUrl(url) {
  // console.log('Opening ' + url);
  window.open(url);
}

function getSenderEmail() {
  return document.querySelector('tr.acZ span[email]').getAttribute('email');
  // return document.querySelector('img.ajn[jid]').getAttribute('jid');
}

function clickReply() {
  document.querySelector('button[aria-label=Reply] span[jsname][aria-hidden=true]').click();
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
