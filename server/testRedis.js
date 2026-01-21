const redis = require("./src/config/redis");

(async () => {
  await redis.set("hello", "world");
  const value = await redis.get("hello");
  console.log(value); // world
})();
