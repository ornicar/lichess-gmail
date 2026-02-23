(function() {
  var DEFAULT_SIGNATURE = '--\nRegards,\nLichess mod team';

  var signature = document.getElementById('signature');
  var saveBtn = document.getElementById('save');
  var status = document.getElementById('status');

  var storage = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage : browser.storage;

  function showStatus(msg, isSuccess) {
    status.textContent = msg;
    status.className = 'status' + (isSuccess ? ' success' : '');
    setTimeout(function() { status.textContent = ''; }, 2000);
  }

  storage.sync.get(['customSignature'], function(data) {
    signature.value = data.customSignature !== undefined ? data.customSignature : DEFAULT_SIGNATURE;
  });

  saveBtn.addEventListener('click', function() {
    storage.sync.set({ customSignature: signature.value }, function() {
      showStatus('Settings saved.', true);
    });
  });
})();
