import { notificationRepository } from '../repositories/notificationRepository';

const toDto = (n: {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}) => ({
  _id: n.id,
  type: n.type,
  title: n.title,
  message: n.message,
  link: n.link,
  read: n.read,
  createdAt: n.created_at,
});

export const notificationService = {
  // Small helper reused by every module that needs to notify a user (project
  // assignment, task/subtask assignment, task completion, message
  // publishing, and the lazy due-soon/overdue generators). Never throws on
  // duplicates - see notificationRepository.create.
  async notify(
    userId: string | null | undefined,
    type: string,
    title: string,
    message: string,
    options?: { link?: string; relatedType?: string; relatedId?: string }
  ) {
    if (!userId) return;
    await notificationRepository.create({
      user_id: userId,
      type,
      title,
      message,
      link: options?.link,
      related_type: options?.relatedType,
      related_id: options?.relatedId,
    });
  },

  async list(userId: string) {
    const rows = await notificationRepository.findForUser(userId);
    return rows.map(toDto);
  },

  async unreadCount(userId: string) {
    return { count: await notificationRepository.countUnread(userId) };
  },

  async markRead(id: string, userId: string) {
    await notificationRepository.markRead(id, userId);
    return { message: 'Notification marked as read' };
  },

  async markAllRead(userId: string) {
    await notificationRepository.markAllRead(userId);
    return { message: 'All notifications marked as read' };
  },
};
