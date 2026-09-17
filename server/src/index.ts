import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { User } from "./models/User.js";
import { Donation } from "./models/Donation.js";

async function main() {
  await connectDb();
  await Promise.all([User.createIndexes(), Donation.createIndexes()]);
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`ShareTable API on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
