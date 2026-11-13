(function () {
  const button = document.getElementById('enableNotifications');
  const testButton = document.getElementById('testNotification');
  const status = document.getElementById('notificationStatus');
  if (!button || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (button) {
      button.disabled = true;
      button.textContent = 'Notifications not supported';
    }
    if (status) status.textContent = 'Use a supported browser such as Chrome or Edge. The deployed site must use HTTPS.';
    return;
  }

  const publicKey = window.STUDY_PLANNER_VAPID_PUBLIC_KEY;
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
  }

  async function registerWorker() {
    return navigator.serviceWorker.register('/service-worker.js');
  }

  async function enableNotifications() {
    if (!publicKey || publicKey.includes('PASTE_')) {
      throw new Error('The server VAPID public key is not configured. Follow the notification setup guide.');
    }
    if (!window.isSecureContext) {
      throw new Error('Notifications require HTTPS, except when testing on localhost.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');

    const registration = await registerWorker();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    const response = await fetch('/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
      credentials: 'same-origin'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save this device subscription.');

    button.textContent = 'Notifications enabled';
    button.classList.remove('btn-outline-primary');
    button.classList.add('btn-success');
    if (testButton) testButton.disabled = false;
    if (status) status.textContent = 'This device is subscribed. Same-day reminders are scheduled for the configured time.';
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    if (status) status.textContent = 'Requesting notification permission...';
    try {
      await enableNotifications();
    } catch (err) {
      if (status) status.textContent = err.message;
      else window.alert(err.message);
    } finally {
      button.disabled = false;
    }
  });

  if (testButton) {
    testButton.addEventListener('click', async () => {
      testButton.disabled = true;
      try {
        const response = await fetch('/notifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Test notification failed.');
        if (status) status.textContent = result.message;
      } catch (err) {
        if (status) status.textContent = err.message;
      } finally {
        testButton.disabled = false;
      }
    });
  }

  registerWorker().catch(err => console.error('Service worker registration failed:', err));
})();
