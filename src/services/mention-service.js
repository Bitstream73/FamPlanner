import database from '../config/database.js';
import logger from './logger.js';

function parseMentions(text, householdId) {
  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];

  if (matches.length === 0) return [];

  // Get all household member display names
  const members = database.db.prepare(`
    SELECT u.id AS user_id, u.display_name, u.email
    FROM household_members hm
    JOIN users u ON u.id = hm.user_id
    WHERE hm.household_id = ?
  `).all(householdId);

  const found = [];
  for (const match of matches) {
    const username = match[1].toLowerCase();
    const member = members.find(
      (m) => (m.display_name && m.display_name.toLowerCase() === username) ||
             m.email.split('@')[0].toLowerCase() === username
    );
    if (member && !found.some((f) => f.userId === member.user_id)) {
      found.push({ userId: member.user_id, username: match[1] });
    }
  }

  return found;
}

function createMentions(commentId, announcementId, mentionedUserIds) {
  const mentions = [];

  for (const userId of mentionedUserIds) {
    const result = database.db.prepare(
      'INSERT INTO mentions (comment_id, announcement_id, mentioned_user_id) VALUES (?, ?, ?)'
    ).run(commentId || null, announcementId || null, userId);

    mentions.push({
      id: result.lastInsertRowid,
      comment_id: commentId || null,
      announcement_id: announcementId || null,
      mentioned_user_id: userId,
    });
  }

  if (mentions.length > 0) {
    logger.info('mention', 'created', { count: mentions.length, commentId, announcementId });
  }

  return mentions;
}

function getUserMentions(userId, { limit = 20, offset = 0 } = {}) {
  return database.db.prepare(`
    SELECT m.*,
      CASE
        WHEN m.comment_id IS NOT NULL THEN c.content
        WHEN m.announcement_id IS NOT NULL THEN a.content
      END AS context_content,
      CASE
        WHEN m.comment_id IS NOT NULL THEN 'comment'
        WHEN m.announcement_id IS NOT NULL THEN 'announcement'
      END AS context_type
    FROM mentions m
    LEFT JOIN comments c ON c.id = m.comment_id
    LEFT JOIN announcements a ON a.id = m.announcement_id
    WHERE m.mentioned_user_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);
}

export default {
  parseMentions,
  createMentions,
  getUserMentions,
};
