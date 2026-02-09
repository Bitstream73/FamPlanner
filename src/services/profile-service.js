import database from '../config/database.js';
import logger from './logger.js';

function getProfile(userId) {
  const profile = database.db.prepare(
    'SELECT * FROM profiles WHERE user_id = ?'
  ).get(userId);

  if (!profile) {
    // Return basic profile from users table if no profile row exists
    const user = database.db.prepare(
      'SELECT id AS user_id, display_name, NULL AS avatar_url, NULL AS pronouns FROM users WHERE id = ?'
    ).get(userId);
    return user || null;
  }

  return profile;
}

function updateProfile(userId, { displayName, avatarUrl, pronouns } = {}) {
  const existing = database.db.prepare(
    'SELECT user_id FROM profiles WHERE user_id = ?'
  ).get(userId);

  if (existing) {
    database.db.prepare(`
      UPDATE profiles
      SET display_name = COALESCE(?, display_name),
          avatar_url = COALESCE(?, avatar_url),
          pronouns = COALESCE(?, pronouns),
          updated_at = unixepoch()
      WHERE user_id = ?
    `).run(displayName ?? null, avatarUrl ?? null, pronouns ?? null, userId);
  } else {
    database.db.prepare(`
      INSERT INTO profiles (user_id, display_name, avatar_url, pronouns)
      VALUES (?, ?, ?, ?)
    `).run(userId, displayName || null, avatarUrl || null, pronouns || null);
  }

  logger.info('profile', 'updated', { userId });
  return getProfile(userId);
}

function getHouseholdProfiles(householdId) {
  return database.db.prepare(`
    SELECT u.id AS user_id, COALESCE(p.display_name, u.display_name) AS display_name,
           p.avatar_url, p.pronouns, hm.role
    FROM household_members hm
    JOIN users u ON u.id = hm.user_id
    LEFT JOIN profiles p ON p.user_id = hm.user_id
    WHERE hm.household_id = ?
  `).all(householdId);
}

export default {
  getProfile,
  updateProfile,
  getHouseholdProfiles,
};
