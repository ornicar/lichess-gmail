browser.extension.sendMessage({}, function(response) {
  var readyStateCheckInterval = setInterval(function() {
    if (document.readyState === "complete") {
      clearInterval(readyStateCheckInterval);
      load();
    }
  }, 100);
});

function load() {
  Mousetrap.bind('ctrl+i', function(e) {
    var email = getSenderEmail();
    // copyTextToClipboard(email); // in case needed for something else
    window.open('https://lichess.org/mod/email-confirm?q=' + email);
    setReply(canned.emailConfirmed);
    setReplyEmail('lichess.contact@gmail.com'); // contact@lichess.org might be blocked
  });
  Mousetrap.bind('ctrl+y', function(e) {
    var email = getSenderEmail();
    window.open('https://lichess.org/mod/search?q=' + email);
  });
}

function getSenderEmail() {
  return document.querySelector('img.ajn[jid]').getAttribute('jid');
}

function clickReply() {
  document.querySelector('span.ams.bkH').click();
}

function setReply(html) {
  clickReply();
  document.querySelector('div.editable[id][contenteditable][g_editable]').innerHTML = html;
}

function setReplyEmail(email) {
  var el = Array.from(document.querySelectorAll('form span')).find(o => o.textContent === 'Lichess Contact <contact@lichess.org>');
  if (el) el.innerHTML = email;
}

var canned = {
  emailConfirmed: '<div dir="ltr"><div>Hi,</div><div><br></div><div>We have confirmed your email address. You should now be able to login on <a href="https://lichess.org/login" target="_blank" data-saferedirecturl="https://www.google.com/url?hl=en&amp;q=https://lichess.org/login&amp;source=gmail&amp;ust=1502980246998000&amp;usg=AFQjCNHZF7-3y2USLf1bCPOp22Kbk6MQqA">https://lichess.org/login</a><br></div><div><br></div><div><br></div><div>--&nbsp;</div><div>Regards,</div><div>Lichess mod team</div></div>'
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
