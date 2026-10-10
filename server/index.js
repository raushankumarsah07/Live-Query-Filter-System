require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const Item = require("./models/Item");
const { seed } = require("./seed");

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const CLIENT_URI = process.env.CLIENT_URI;

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === CLIENT_URI ||
        origin === "http://localhost:5173"
      ) {
        return callback(null, true);
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toList = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
const SORTS = {
  rating: { rating: -1, id: 1 },
  duration: { durationMinutes: 1, id: 1 },
  title: { title: 1 },
  default: { id: 1 },
};

// Step 1: search API  ->  GET /api/items?search=&category=A,B&level=&sort=&page=&limit=
app.get("/api/items", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      48,
      Math.max(1, parseInt(req.query.limit, 10) || 12),
    );
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 60);
    const categories = toList(req.query.category);
    const levels = toList(req.query.level);

    const base = {};
    if (search) base.title = { $regex: escapeRegex(search), $options: "i" };
    if (levels.length) base.level = { $in: levels };
    const filter = { ...base };
    if (categories.length) filter.category = { $in: categories }; // multi-category filter

    const [total, items, facetRows] = await Promise.all([
      Item.countDocuments(filter),
      Item.find(filter)
        .collation({ locale: "en", numericOrdering: true }) // "Resource 2" before "Resource 10"
        .sort(SORTS[req.query.sort] || SORTS.default)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      // live counts per category for the current search/level (ignores the category filter itself)
      Item.aggregate([
        { $match: base },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      items: items.map(({ _id, __v, ...rest }) => rest),
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      facets: Object.fromEntries(facetRows.map((f) => [f._id, f.count])),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed. Please try again." });
  }
});

// Filter options for the sidebar
app.get("/api/meta", async (req, res) => {
  try {
    const [categories, levels, total] = await Promise.all([
      Item.distinct("category"),
      Item.distinct("level"),
      Item.countDocuments(),
    ]);
    const order = ["Beginner", "Intermediate", "Advanced"];
    res.json({
      categories: categories.sort(),
      levels: levels.sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      total,
    });
  } catch {
    res.status(500).json({ error: "Could not load filters." });
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

const dist = path.join(__dirname, "../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("MongoDB connected");
    if (await seed(false))
      console.log("Database was empty: loaded catalog data");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
