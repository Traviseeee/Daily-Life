const { Redis } = require("@upstash/redis");
const webpush = require("web-push");

let redisClient;

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis is not configured.");
  }
  if (!redisClient) redisClient = Redis.fromEnv();
  return redisClient;
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:notifications@example.com";
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured.");
  if (!/^(mailto:.+|https:\/\/.+)$/i.test(subject)) throw new Error("VAPID_SUBJECT must be a mailto: or https: URL.");
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch (error) {
    return "UTC";
  }
}

async function getUserSubscriptions(userId) {
  if (!userId) return [];
  const redis = getRedis();
  const key = `mylife:push:subscriptions:${userId}`;
  const entries = await redis.hgetall(key);
  const subscriptions = [];

  for (const [endpoint, raw] of Object.entries(entries || {})) {
    try {
      const stored = typeof raw === "string" ? JSON.parse(raw) : raw;
      const subscription = stored?.subscription || stored;
      if (!subscription?.endpoint || subscription.endpoint !== endpoint) continue;
      subscriptions.push({
        endpoint,
        subscription,
        timeZone: isValidTimeZone(stored?.timeZone || "UTC")
      });
    } catch (error) {
      console.warn("MYLIFE skipped an invalid stored push subscription.");
    }
  }

  return subscriptions;
}

async function sendToSubscription(userId, subscription, payload) {
  configureWebPush();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    const statusCode = Number(error?.statusCode || 0);
    if (statusCode === 404 || statusCode === 410) {
      try {
        await getRedis().hdel(`mylife:push:subscriptions:${userId}`, subscription.endpoint);
      } catch (cleanupError) {
        console.error("MYLIFE could not remove an expired push subscription.", cleanupError);
      }
    } else if (statusCode === 401 || statusCode === 403) {
      console.error("MYLIFE push authorization failed.", statusCode, error?.body || "");
    } else {
      console.error("MYLIFE push delivery failed.", statusCode, error?.body || error?.message || "");
    }
    throw error;
  }
}

async function sendToUser(userId, payload) {
  const subscriptions = await getUserSubscriptions(userId);
  configureWebPush();
  const results = await Promise.allSettled(subscriptions.map(({ subscription }) => sendToSubscription(userId, subscription, payload)));
  return {
    attempted: results.length,
    sent: results.filter(result => result.status === "fulfilled").length,
    failed: results.filter(result => result.status === "rejected").length
  };
}

module.exports = { configureWebPush, getRedis, getUserSubscriptions, isValidTimeZone, sendToSubscription, sendToUser };