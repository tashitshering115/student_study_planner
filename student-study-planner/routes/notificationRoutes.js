
const express = require('express');
const webpush = require('web-push');
const pool = require('../config/db');
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey ||
      publicKey.includes('PASTE_') || privateKey.includes('PASTE_')) {
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey,
    privateKey
  );

  return true;
}

router.post('/subscribe', requireAuth, asyncHandler(async (req, res) => {
  const subscription = req.body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid push subscription.' });
  }

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       subscription = EXCLUDED.subscription`,
    [req.session.user.id, subscription.endpoint, JSON.stringify(subscription)]
  );

  res.json({ message: 'Notifications enabled successfully.' });
}));

router.post('/unsubscribe', requireAuth, asyncHandler(async (req, res) => {
  const { endpoint } = req.body;

  if (endpoint) {
    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.session.user.id, endpoint]
    );
  }

  res.json({ message: 'Notifications disabled.' });
}));

router.post('/test', requireAuth, asyncHandler(async (req, res) => {
  if (!configureWebPush()) {
    return res.status(503).json({ error: 'Push notification keys are not configured on the server.' });
  }

  const result = await pool.query(
    'SELECT id, subscription FROM push_subscriptions WHERE user_id = $1',
    [req.session.user.id]
  );

  if (!result.rowCount) {
    return res.status(400).json({ error: 'Enable notifications on this device first.' });
  }

  const payload = JSON.stringify({
    title: 'Student Study Planner',
    body: 'Your test notification is working!',
    url: '/dashboard',
    tag: 'test-notification'
  });

  let sent = 0;

  for (const row of result.rows) {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
    } catch (error) {
      console.error('Test notification failed:', error.statusCode || error.message);

      if (error.statusCode === 404 || error.statusCode === 410) {
        await pool.query(
          'DELETE FROM push_subscriptions WHERE id = $1',
          [row.id]
        );
      }
    }
  }

  if (!sent) {
    return res.status(502).json({ error: 'Could not deliver the test notification.' });
  }

  res.json({ message: 'Test notification sent successfully.' });
}));

module.exports = router;
