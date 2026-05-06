// import Tab from "../models/Tab.js";

// /* =========================
//    SAVE SINGLE TAB
// ========================= */
// export const saveTab = async (req, res) => {
//   try {
//     console.log("📥 Incoming Tab:", req.body);

//     const { domain, url, title, detection_source, timestamp } = req.body;

//     // validation
//     if (!domain) {
//       return res.status(400).json({ message: "Domain is required" });
//     }

//     const newTab = new Tab({
//       domain,
//       url,
//       title,
//       detection_source: detection_source || "EXTENSION",
//       timestamp: timestamp || new Date().toISOString(),
//     });

//     await newTab.save();

//     res.status(201).json({
//       success: true,
//       message: "Tab saved",
//     });

//   } catch (err) {
//     console.error("❌ saveTab error:", err);

//     res.status(500).json({
//       success: false,
//       message: "Error saving tab",
//     });
//   }
// };

// /* =========================
//    SAVE MULTIPLE TABS
// ========================= */
// export const saveTabsBatch = async (req, res) => {
//   try {
//     const { tabs } = req.body;

//     console.log("📥 Incoming Tabs:", tabs);

//     if (!tabs || !Array.isArray(tabs)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid tabs data",
//       });
//     }

//     const formattedTabs = tabs.map((tab) => ({
//       domain: tab.domain,
//       url: tab.url,
//       title: tab.title,
//       detection_source: tab.detection_source || "EXTENSION",
//       timestamp: tab.timestamp || new Date().toISOString(),
//     }));

//     await Tab.insertMany(formattedTabs);

//     res.status(200).json({
//       success: true,
//       message: "Tabs saved",
//       count: formattedTabs.length,
//     });

//   } catch (err) {
//     console.error("❌ saveTabsBatch error:", err);

//     res.status(500).json({
//       success: false,
//       message: "Batch save error",
//     });
//   }
// };

import Tab from "../models/Tab.js";

/* =========================
   SAVE MULTIPLE TABS (SMART)
========================= */
export const saveTabsBatch = async (req, res) => {
  try {
    const { tabs } = req.body;

    console.log("📥 Incoming Tabs:", tabs?.length);

    if (!tabs || !Array.isArray(tabs)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tabs data",
      });
    }

    // 🔥 STEP 1: CLEAR OLD DATA (IMPORTANT)
    await Tab.deleteMany({});

    // 🔥 STEP 2: INSERT FRESH DATA
    const formattedTabs = tabs.map((tab) => ({
      domain: tab.domain,
      url: tab.url,
      title: tab.title,
      detection_source: tab.detection_source || "EXTENSION",
      timestamp: tab.timestamp || new Date().toISOString(),
    }));

    await Tab.insertMany(formattedTabs);

    res.status(200).json({
      success: true,
      message: "Tabs synced fresh",
      count: formattedTabs.length,
    });

  } catch (err) {
    console.error("❌ saveTabsBatch error:", err);

    res.status(500).json({
      success: false,
      message: "Batch save error",
    });
  }
};

/* =========================
   SINGLE TAB (OPTIONAL)
========================= */
export const saveTab = async (req, res) => {
  try {
    const { domain, url, title } = req.body;

    if (!domain) {
      return res.status(400).json({ message: "Domain required" });
    }

    await Tab.create({
      domain,
      url,
      title,
      detection_source: "EXTENSION",
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: "Tab saved",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving tab" });
  }
};