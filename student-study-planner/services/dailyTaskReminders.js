const pool = require('../config/db');
const webpush = require('web-push');

const TIME_ZONE = 'Asia/Thimphu';
let checkInProgress = false;

function getBhutanDateTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey || publicKey.includes('PASTE_') || privateKey.includes('PASTE_')) {
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey,
    privateKey
  );
  return true;
}

async function sendDueTodayReminders() {
  if (checkInProgress || !configureWebPush()) return;
  checkInProgress = true;

  try {
    const now = getBhutanDateTime();
    const reminderHour = Number(process.env.REMINDER_HOUR || 8);
    const reminderMinute = Number(process.env.REMINDER_MINUTE || 0);

    // Only send at or after the configured local time, and only once per task per date.
    if (now.hour < reminderHour ||
        (now.hour === reminderHour && now.minute < reminderMinute)) return;

    const dueTasks = await pool.query(
      `SELECT id, user_id, title
       FROM tasks
       WHERE due_date = $1::date
         AND status <> 'Completed'
       ORDER BY user_id, id`,
      [now.date]
    );

    for (const task of dueTasks.rows) {
      const subscriptions = await pool.query(
        'SELECT endpoint, subscription FROM push_subscriptions WHERE user_id=$1',
        [task.user_id]
      );
      if (!subscriptions.rowCount) continue;

      // Claim this task/date before sending so repeated scheduler checks do not duplicate it.
      const claim = await pool.query(
        `INSERT INTO task_reminder_log (task_id, reminder_date)
         VALUES ($1, $2::date)
         ON CONFLICT DO NOTHING
         RETURNING task_id`,
        [task.id, now.date]
      );
      if (!claim.rowCount) continue;

      const payload = JSON.stringify({
        title: 'Task due today!',
        body: `"${task.title}" is due today. Open your Study Planner to review it.`,
        url: '/tasks'
      });

      await Promise.all(subscriptions.rows.map(async item => {
        try {
          await webpush.sendNotification(item.subscription, payload);
        } catch (err) {
          console.error('Push notification failed:', err.statusCode || err.message);
          if (err.statusCode === 404 || err.statusCode === 410) {
            await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [item.endpoint]);
          }
        }
      }));
    }
  } catch (err) {
    console.error('Daily task reminder check failed:', err.message);
  } finally {
    checkInProgress = false;
  }
}

function startDailyTaskReminderScheduler() {
  // Check once at startup and then every minute. The database log prevents duplicates.
  sendDueTodayReminders();
  setInterval(sendDueTodayReminders, 60 * 1000);
}

module.exports = { startDailyTaskReminderScheduler };
