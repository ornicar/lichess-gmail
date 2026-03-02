(function() {
  var DEFAULT_SIGNATURE = '--\nRegards,\nLichess mod team';

  var signature = document.getElementById('signature');
  var saveBtn = document.getElementById('save');
  var status = document.getElementById('status');
  var optionsLink = document.getElementById('options-link');

  var storage = (typeof chrome !== 'undefined' && chrome.storage ? chrome : browser).storage;

  function showStatus(msg) {
    status.textContent = msg;
    setTimeout(function() { status.textContent = ''; }, 2000);
  }

  storage.sync.get(['customSignature'], function(data) {
    signature.value = data.customSignature !== undefined ? data.customSignature : DEFAULT_SIGNATURE;
  });

  saveBtn.addEventListener('click', function() {
    storage.sync.set({ customSignature: signature.value }, function() {
      showStatus('Saved');
    });
  });

  optionsLink.addEventListener('click', function(e) {
    e.preventDefault();
    var ext = typeof chrome !== 'undefined' && chrome.runtime ? chrome : browser;
    ext.runtime.openOptionsPage && ext.runtime.openOptionsPage();
  });
})();
