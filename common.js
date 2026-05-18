// Code common to inject.js, options.js, and popup.js

const DEFAULT_SIGNATURE = '--\nRegards,\nLichess team';
const SIGNATURE_STORAGE_KEY = 'customSignature';

/** Gmail “From” row label we replace so the reply sends from Gmail instead of contact@lichess.org */
const REPLY_SEND_AS_DISPLAY = 'Lichess Contact <contact@lichess.org>';
const REPLY_SEND_AS_EMAIL = 'lichess.contact@gmail.com';

const extensionStorage = () =>
  typeof chrome !== 'undefined' && chrome.storage ? chrome.storage : browser.storage;

const extensionRuntime = () =>
  typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime : browser.runtime;

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const signatureToHtml = (signature) =>
  (signature || DEFAULT_SIGNATURE)
    .split(/\r?\n/)
    .map((line) => (line === '--' ? '<div>--&nbsp;</div>' : '<div>' + escapeHtml(line) + '</div>'))
    .join('');

const emailConfirmedBody =
  '<div dir="ltr"><div>Hi,</div><div><br></div><div>We have confirmed your email address. You should now be able to login on <a href="https://lichess.org/login" target="_blank" data-saferedirecturl="https://www.google.com/url?hl=en&amp;q=https://lichess.org/login&amp;source=gmail&amp;ust=1502980246998000&amp;usg=AFQjCNHZF7-3y2USLf1bCPOp22Kbk6MQqA">https://lichess.org/login</a><br></div><div></div><div><br></div>';

const buildEmailConfirmedHtml = (customSignature) =>
  emailConfirmedBody + signatureToHtml(customSignature) + '</div>';
