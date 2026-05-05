const db = require('../config/db');

/**
 * Get current app settings
 */
const getSettings = async () => {
  const result = await db.query('SELECT * FROM app_settings WHERE id = 1');
  return result.rows[0];
};

/**
 * Update app settings
 */
const updateSettings = async (settingsData) => {
  const fields = Object.keys(settingsData);
  if (fields.length === 0) return null;

  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
  const values = Object.values(settingsData);

  const result = await db.query(
    `UPDATE app_settings SET ${setClause} WHERE id = 1 RETURNING *`,
    values
  );
  return result.rows[0];
};

module.exports = {
  getSettings,
  updateSettings
};
