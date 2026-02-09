import { Router } from 'express';
import commentService from '../../../services/comment-service.js';
import { requireAuth } from '../../../middleware/requireAuth.js';

const router = Router();

const VALID_ENTITY_TYPES = ['task', 'event'];

router.post('/', requireAuth, (req, res, next) => {
  try {
    const { entityType, entityId, content } = req.body;
    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ error: 'Valid entityType is required (task or event)', code: 'VALIDATION_ERROR' });
    }
    if (!entityId) {
      return res.status(400).json({ error: 'entityId is required', code: 'VALIDATION_ERROR' });
    }
    if (!content || content.length > 5000) {
      return res.status(400).json({ error: 'Content is required (max 5000 chars)', code: 'VALIDATION_ERROR' });
    }

    const comment = commentService.addComment(entityType, parseInt(entityId, 10), req.user.id, content);
    res.status(201).json({ data: comment });
  } catch (err) { next(err); }
});

router.get('/:entityType/:entityId', requireAuth, (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ error: 'Valid entityType is required', code: 'VALIDATION_ERROR' });
    }

    const { limit, offset } = req.query;
    const result = commentService.listComments(entityType, parseInt(entityId, 10), {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json({ data: result.comments, total: result.total });
  } catch (err) { next(err); }
});

router.put('/:commentId', requireAuth, (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || content.length > 5000) {
      return res.status(400).json({ error: 'Content is required (max 5000 chars)', code: 'VALIDATION_ERROR' });
    }

    const comment = commentService.updateComment(parseInt(req.params.commentId, 10), content);
    res.json({ data: comment });
  } catch (err) { next(err); }
});

router.delete('/:commentId', requireAuth, (req, res, next) => {
  try {
    commentService.deleteComment(parseInt(req.params.commentId, 10));
    res.json({ data: { message: 'Comment deleted' } });
  } catch (err) { next(err); }
});

export default router;
