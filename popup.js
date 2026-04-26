(function() {
  var signature = document.getElementById('signature');
  var saveBtn = document.getElementById('save');
  var status = document.getElementById('status');
  var optionsLink = document.getElementById('options-link');

  function showStatus(msg) {
    status.textContent = msg;
    setTimeout(function() { status.textContent = ''; }, 2000);
  }

  extensionStorage().sync.get([SIGNATURE_STORAGE_KEY], function(data) {
    signature.value =
      data[SIGNATURE_STORAGE_KEY] !== undefined ? data[SIGNATURE_STORAGE_KEY] : DEFAULT_SIGNATURE;
  });

  saveBtn.addEventListener('click', function() {
    var payload = {};
    payload[SIGNATURE_STORAGE_KEY] = signature.value;
    extensionStorage().sync.set(payload, function() {
      showStatus('Saved');
    });
  });

  optionsLink.addEventListener('click', function(e) {
    e.preventDefault();
    extensionRuntime().openOptionsPage && extensionRuntime().openOptionsPage();
  });
})();
