import TrafficLog from '../models/TrafficLog.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Get AI model performance metrics
 * GET /api/metrics
 */
export const getMetrics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Fetch logs with actual_label (confirmed or false_positive)
  const logs = await TrafficLog.find({
    userId,
    actual_label: { $exists: true },
  });

  if (logs.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1_score: 0,
        total_samples: 0,
      },
    });
  }

  let tp = 0; // True Positive: Attack correctly detected
  let fp = 0; // False Positive: Normal marked as attack
  let tn = 0; // True Negative: Normal correctly detected
  let fn = 0; // False Negative: Attack missed

  logs.forEach((log) => {
    const predicted = log.predicted_label;
    const actual = log.actual_label;

    if (predicted === 1 && actual === 1) tp++;
    else if (predicted === 1 && actual === 0) fp++;
    else if (predicted === 0 && actual === 0) tn++;
    else if (predicted === 0 && actual === 1) fn++;
  });

  const accuracy = (tp + tn) / (tp + tn + fp + fn);
  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1_score = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;

  return res.status(200).json({
    success: true,
    data: {
      accuracy: parseFloat(accuracy.toFixed(4)),
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1_score: parseFloat(f1_score.toFixed(4)),
      total_samples: logs.length,
      confusion_matrix: { tp, fp, tn, fn },
    },
  });
});

export default {
  getMetrics,
};
