const settingsModel = require('../models/settingsModel');

const getSettings = async (req, res) => {
  try {
    const settings = await settingsModel.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await settingsModel.updateSettings(req.body);
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Invalid data' });
    }
    res.status(200).json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
