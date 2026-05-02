import nodemailer from 'nodemailer';
import axios from 'axios';
import logger from './logger.js';

/**
 * Configure Nodemailer Transporter
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

import User from '../models/User.js';

export const sendEmailAlert = async (logData) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('Email credentials not set, skipping email alert');
    return;
  }

  let recipientEmail = process.env.SMTP_USER;
  try {
    const user = await User.findById(logData.userId);
    if (user && user.email) {
      recipientEmail = user.email;
    }
  } catch (error) {
    logger.error(`Failed to fetch user email: ${error.message}`);
  }

  const mailOptions = {
    from: `"AI-IDS Alerts" <${process.env.SMTP_USER}>`,
    to: recipientEmail,
    subject: `🚨 CRITICAL ALERT: ${logData.analysis.attack_type} Detected!`,
    html: `
      <h2>⚠️ Intrusion Detected</h2>
      <p>The AI-IDS system has detected a high-severity threat.</p>
      <table border="1" cellpadding="10" style="border-collapse: collapse;">
        <tr><td><strong>Severity:</strong></td><td style="color: red;">${logData.severity}</td></tr>
        <tr><td><strong>Attack Type:</strong></td><td>${logData.analysis.attack_type}</td></tr>
        <tr><td><strong>Confidence:</strong></td><td>${(logData.analysis.confidence * 100).toFixed(2)}%</td></tr>
        <tr><td><strong>Protocol:</strong></td><td>${logData.protocol}</td></tr>
        <tr><td><strong>Source Port:</strong></td><td>${logData.src_port}</td></tr>
        <tr><td><strong>Destination Port:</strong></td><td>${logData.dst_port}</td></tr>
        <tr><td><strong>Time:</strong></td><td>${new Date().toLocaleString()}</td></tr>
      </table>
      <p>Please check the IDS Dashboard for more details to confirm or mark as false positive.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email alert sent: ${info.messageId}`);
  } catch (error) {
    logger.error(`Failed to send email alert: ${error.message}`);
  }
};

/**
 * Send Slack Webhook Alert
 */
export const sendSlackAlert = async (logData) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl || webhookUrl.includes('example.com')) {
    logger.warn('Valid Slack Webhook URL not set, skipping Slack alert');
    return;
  }

  const message = {
    text: `🚨 *CRITICAL THREAT DETECTED* 🚨`,
    attachments: [
      {
        color: "#ff0000",
        fields: [
          { title: "Attack Type", value: logData.analysis.attack_type, short: true },
          { title: "Severity", value: logData.severity, short: true },
          { title: "Confidence", value: `${(logData.analysis.confidence * 100).toFixed(2)}%`, short: true },
          { title: "Protocol", value: logData.protocol, short: true },
          { title: "Source Port", value: logData.src_port.toString(), short: true },
          { title: "Destination Port", value: logData.dst_port.toString(), short: true },
        ],
        footer: "AI-IDS Security System",
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };

  try {
    await axios.post(webhookUrl, message);
    logger.info('Slack alert sent successfully');
  } catch (error) {
    logger.error(`Failed to send Slack alert: ${error.message}`);
  }
};

/**
 * Trigger All Alerts
 */
export const triggerAlerts = async (logData) => {
  // We only want to send active notifications for High or Critical severity
  if (logData.severity === 'Critical' || logData.severity === 'High') {
    // Run them asynchronously so we don't slow down the API response
    sendEmailAlert(logData);
    sendSlackAlert(logData);
  }
};
