const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  title: { type: String, required: true, index: true },
  category: { type: String, index: true },
  level: { type: String, index: true },
  durationMinutes: Number,
  rating: { type: Number, index: true },
});

module.exports = mongoose.model('Item', itemSchema);
