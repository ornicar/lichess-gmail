function jumpToAccount(info,tab) {
  var h = info.selectionText;
  var m = h.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*/i);
  if (m) window.open("https://lichess.org/mod/search?q=" + encodeURIComponent(m[0]));
  else {
      m = h.match(/[a-z0-9][\w-]*[a-z0-9]/i);
      if (m) window.open("https://lichess.org/@/" + m[0] + "?mod");
  }
}
browser.contextMenus.create({
  title: "Lichess account", 
  contexts:["selection"], 
  onclick: jumpToAccount,
});
