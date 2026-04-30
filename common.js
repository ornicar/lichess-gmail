// Code common to inject.js, options.js, and popup.js

var DEFAULT_SIGNATURE = '--\nRegards,\nLichess team';
var SIGNATURE_STORAGE_KEY = 'customSignature';

/** Gmail “From” row label we replace so the reply sends from Gmail instead of contact@lichess.org */
var REPLY_SEND_AS_DISPLAY = 'Lichess Contact <contact@lichess.org>';
var REPLY_SEND_AS_EMAIL = 'lichess.contact@gmail.com';

function extensionStorage() {
  return (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage : browser.storage;
}

function extensionRuntime() {
  return (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : browser;
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function signatureToHtml(signature) {
  var lines = (signature || DEFAULT_SIGNATURE).split(/\r?\n/);
  return lines.map(function(line) {
    if (line === '--') return '<div>--&nbsp;</div>';
    return '<div>' + escapeHtml(line) + '</div>';
  }).join('');
}

var emailConfirmedBody =
  '<div dir="ltr"><div>Hi,</div><div><br></div><div>We have confirmed your email address. You should now be able to login on <a href="https://lichess.org/login" target="_blank" data-saferedirecturl="https://www.google.com/url?hl=en&amp;q=https://lichess.org/login&amp;source=gmail&amp;ust=1502980246998000&amp;usg=AFQjCNHZF7-3y2USLf1bCPOp22Kbk6MQqA">https://lichess.org/login</a><br></div><div></div><div><br></div>';

function buildEmailConfirmedHtml(customSignature) {
  return emailConfirmedBody + signatureToHtml(customSignature) + '</div>';
}
