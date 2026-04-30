var ext = typeof browser !== 'undefined' ? browser : chrome;

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
