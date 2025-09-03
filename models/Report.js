const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    unique: true,
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportType: {
    type: String,
    enum: ['teacher_spotted', 'technical_issue', 'content_issue', 'other'],
    required: true
  },
  urgencyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  location: {
    type: String,
    required: false
  },
  timeOfIncident: {
    type: Date,
    required: true
  },
  witnessPresent: {
    type: Boolean,
    required: true
  },
  actionTaken: {
    type: String,
    required: true
  },
  additionalInfo: {
    type: String,
    maxlength: 1000
  },
  // Dynamic fields for different report types
  teacherName: {
    type: String,
    maxlength: 100
  },
  deviceType: {
    type: String,
    maxlength: 100
  },
  contentUrl: {
    type: String,
    maxlength: 500
  },
  contentName: {
    type: String,
    maxlength: 200
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    maxlength: 1000
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', reportSchema);
