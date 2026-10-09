const mongoose = require("mongoose");
const Item = require("./models/Item");
const data = require("./data/live_filter_catalog.json");

// force=false: seed only if empty. force=true: wipe and reload.
async function seed(force = false) {
  if (force) await Item.deleteMany({});
  else if ((await Item.countDocuments()) > 0) return false;
  await Item.insertMany(data);
  return true;
}

module.exports = { seed };

// `npm run seed` resets the database to the catalog file
if (require.main === module) {
  require("dotenv").config();
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => seed(true))
    .then(() => {
      console.log(`Seeded ${data.length} items`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
