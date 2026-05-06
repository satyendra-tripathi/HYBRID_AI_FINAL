import mongoose from "mongoose";

const tabSchema = new mongoose.Schema({
  domain: String,
  url: String,
  title: String,
  detection_source: String,
  timestamp: String,
});

export default mongoose.model("Tab", tabSchema);