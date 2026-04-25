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
