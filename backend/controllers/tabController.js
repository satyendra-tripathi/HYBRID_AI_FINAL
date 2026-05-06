const Tab = require("../models/Tab");

// SINGLE TAB SAVE
exports.saveTab = async (req, res) => {
  try {

    console.log("📥 Incoming Tab:", req.body);

    const newTab = new Tab({
      domain: req.body.domain,
      url: req.body.url,
      title: req.body.title,
      detection_source: req.body.detection_source,
      timestamp: req.body.timestamp,
    });

    await newTab.save();

    res.status(201).json({ message: "Tab saved" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving tab" });
  }
};

// BATCH SAVE
exports.saveTabsBatch = async (req, res) => {
  try {

    const { tabs } = req.body;

    console.log("📥 Incoming Tabs:", tabs);

    if (!tabs || !Array.isArray(tabs)) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const formattedTabs = tabs.map(tab => ({
      domain: tab.domain,
      url: tab.url,
      title: tab.title,
      detection_source: tab.detection_source,
      timestamp: tab.timestamp,
    }));

    await Tab.insertMany(formattedTabs);

    res.status(200).json({
      message: "Tabs saved",
      count: formattedTabs.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Batch save error" });
  }
};