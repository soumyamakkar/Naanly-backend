require('dotenv').config();

const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL,
});

client.connect()
  .then(() => console.log("✅ Redis Cloud connected"))
  .catch((err) => console.error("❌ Redis Cloud connection failed:", err));

module.exports = client;
