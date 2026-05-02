import User from '../models/User.js';

export const checkApiKey = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: "API key missing",
    });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({
      success: false,
      message: "Invalid API key",
    });
  }

  // AI-IDS specific: analyzeController requires req.user._id to save logs.
  // When an agent calls this via API Key, we assign the first available user (admin) 
  // as the owner of these automated logs so it doesn't crash.
  if (!req.user) {
    try {
      // Get the most recently created user so the active user sees the traffic
      const defaultUser = await User.findOne().sort({ createdAt: -1 });
      if (defaultUser) {
        req.user = defaultUser;
      }
    } catch (error) {
      console.error("Error fetching default user for API Key auth:", error);
    }
  }

  next();
};
