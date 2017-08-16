chrome.extension.sendMessage({}, function(response) {
  document.body.addEventListener('keypress', function(e) {
    if (e.keyCode === 9) {
      var email = document.querySelector('img.ajn[jid]').getAttribute('jid');
      copyTextToClipboard(email);
      console.log('copied', email);
    }
  });
});

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
