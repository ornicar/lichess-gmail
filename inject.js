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
 * Injected “Hermes” button: we only touch our own node (no Gmail DOM selectors) and
 * use a shadow root so Gmail’s stylesheets can’t clobber the button. Fixed top–center
 * of the viewport so it stays put while mail UI scrolls.
 */
function injectHermesButton() {
  var id = 'lichess-gmail-hermes-host';
  if (document.getElementById(id)) return;

  function mount() {
    if (document.getElementById(id)) return;
    var host = document.createElement('div');
    host.id = id;
    host.setAttribute('data-lichess-gmail', 'hermes');
    host.style.cssText = [
      'box-sizing: border-box',
      'position: fixed',
      'z-index: 2147483647',
      'top: 0',
      'left: 50%',
      'transform: translateX(-50%)',
      'margin: 0',
      'padding: 0',
      'border: 0',
      'background: transparent',
      'pointer-events: auto'
    ].join('; ');

    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = [
      ':host { display: block; }',
      'button {',
      '  font: 12px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
      '  margin: 8px 0 0;',
      '  padding: 6px 12px;',
      '  color: #202124;',
      '  background: #fff;',
      '  border: 1px solid rgba(60,64,67,0.28);',
      '  border-radius: 6px;',
      '  box-shadow: 0 1px 2px rgba(60,64,67,0.15), 0 1px 1px rgba(60,64,67,0.1);',
      '  cursor: default;',
      '  user-select: none;',
      '  -webkit-user-select: none;',
      '}'
    ].join('\n');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Hermes');
    btn.appendChild(document.createTextNode('Hermes'));

    root.appendChild(style);
    root.appendChild(btn);
    (document.body || document.documentElement).appendChild(host);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}

load();
injectHermesButton();

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
