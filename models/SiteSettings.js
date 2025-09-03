const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  shutdownMode: {
    type: Boolean,
    default: false
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);