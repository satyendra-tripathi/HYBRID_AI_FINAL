import express from 'express';

const router = express.Router();

// Global tab map init (important)
global.tabMap = global.tabMap || {};

/**
 * POST /api/tab
 * Save tab domain → title mapping
 */
router.post('/', (req, res) => {
  try {
    const { domain, title, url, tabId } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Normalize domain (remove www)
    const cleanDomain = domain.replace(/^www\./, '');

    // Save mapping
    global.tabMap[cleanDomain] = {
      title: title || cleanDomain,
      url: url || '',
      tabId: tabId || null,
      lastSeen: new Date()
    };

    console.log("✅ Tab stored:", cleanDomain, "→", title);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Tab route error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;