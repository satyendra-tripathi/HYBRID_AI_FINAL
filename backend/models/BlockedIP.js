import mongoose from 'mongoose';

const BlockedIPSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    logId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrafficLog',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attackType: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      required: true,
    },
    blockedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate active blocks for same IP and user
BlockedIPSchema.index({ ip: 1, userId: 1, isActive: 1 }, { unique: true });

const BlockedIP = mongoose.model('BlockedIP', BlockedIPSchema);

export default BlockedIP;
