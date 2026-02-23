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
    var storage = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage : browser.storage;
    storage.sync.get(['customSignature'], function(data) {
      var html = buildEmailConfirmedHtml(data.customSignature);
      setTimeout(function() {
        setReply(html);
        setReplyEmail('lichess.contact@gmail.com');
      }, 100);
    });
  }
  Mousetrap.bind('ctrl+shift+e', function(e) {
    e.preventDefault();
    var storage = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage : browser.storage;
    storage.sync.get(['customSignature'], function(data) {
      insertSignature(signatureToHtml(data.customSignature));
    });
  });
  Mousetrap.bind('ctrl+,', confirmEmail);
  Mousetrap.bind('ctrl+f', confirmEmail);
  Mousetrap.bind('ctrl+y', function(e) {
    var email = getSenderEmail();
    openUrl('https://lichess.org/mod/search?q=' + email);
  });
}
load();

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
    o => o.textContent === 'Lichess Contact <contact@lichess.org>'
  );
  if (el) el.innerHTML = email;
}

var DEFAULT_SIGNATURE = '--\nRegards,\nLichess mod team';

var emailConfirmedBody = '<div dir="ltr"><div>Hi,</div><div><br></div><div>We have confirmed your email address. You should now be able to login on <a href="https://lichess.org/login" target="_blank" data-saferedirecturl="https://www.google.com/url?hl=en&amp;q=https://lichess.org/login&amp;source=gmail&amp;ust=1502980246998000&amp;usg=AFQjCNHZF7-3y2USLf1bCPOp22Kbk6MQqA">https://lichess.org/login</a><br></div><div></div><div><br></div>';

function signatureToHtml(signature) {
  var lines = (signature || DEFAULT_SIGNATURE).split(/\r?\n/);
  return lines.map(function(line) {
    if (line === '--') return '<div>--&nbsp;</div>';
    return '<div>' + escapeHtml(line) + '</div>';
  }).join('');
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function buildEmailConfirmedHtml(customSignature) {
  return emailConfirmedBody + signatureToHtml(customSignature) + '</div>';
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
