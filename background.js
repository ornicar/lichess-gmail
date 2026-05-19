var ext = typeof browser !== 'undefined' ? browser : chrome;

var HERMES_TEMPLATES_URL = 'https://hermes.lichess.app/api/templates';

function fetchHermesTemplates() {
  return fetch(HERMES_TEMPLATES_URL).then(function(res) {
    if (!res.ok) throw new Error('Bad status ' + res.status);
    return res.json();
  });
}

ext.runtime.onMessage.addListener(function(message, _sender, sendResponse) {
  if (!message || message.type !== 'hermesFetchTemplates') return;
  fetchHermesTemplates()
    .then(function(payload) {
      sendResponse({ ok: true, payload: payload });
    })
    .catch(function(err) {
      sendResponse({ ok: false, error: err && err.message ? err.message : String(err) });
    });
  return true;
});

function jumpToAccount(info, tab) {
  var h = info.selectionText;
  var m = h.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*/i);
  var url;
  if (m) url = "https://lichess.org/mod/search?q=" + encodeURIComponent(m[0]);
  else {
    m = h.match(/[a-z0-9][\w-]*[a-z0-9]/i);
    url = m ? "https://lichess.org/@/" + m[0] + "?mod" : null;
  }
  if (url) ext.tabs.create({ url: url });
}

ext.contextMenus.create({
  id: "lichess-account",
  title: "Lichess account",
  contexts: ["selection"]
});

ext.contextMenus.onClicked.addListener(jumpToAccount);
