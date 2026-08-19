// Force-unregister any stale Service Worker, then boot the app
(async () => {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
        console.log('SW unregistered:', reg.scope);
      }
    } catch (e) { /* ignore */ }
  }
  if (window.lucide) {
    window.lucide.createIcons();
  }
})();
