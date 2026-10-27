/** Runs once per full document, even when client-side navigation reuses the layout. */
export const adcashBootstrap = `(function () {
  function start() {
    if (window.__tvRoomAdcashStarted || !window.aclib || typeof window.aclib.runAutoTag !== 'function') return;
    window.__tvRoomAdcashStarted = true;
    try {
      window.aclib.runAutoTag({ zoneId: 'txhkagiska' });
    } catch (_) {
      window.__tvRoomAdcashStarted = false;
    }
  }
  var library = document.getElementById('aclib');
  if (library) library.addEventListener('load', start, { once: true });
  window.addEventListener('load', start, { once: true });
  start();
})();`
