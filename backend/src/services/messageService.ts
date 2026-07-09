import { messageRepository } from '../repositories/messageRepository';
import { userRepository } from '../repositories/userRepository';
import { notificationService } from './notificationService';
import { notFound } from '../utils/httpError';
import { ImportantMessage } from '../types/models';

const toDto = (message: ImportantMessage) => ({
  _id: message.id,
  title: message.title,
  description: message.description,
  priority: message.priority,
  startDate: message.start_date,
  expiryDate: message.expiry_date,
  pinned: message.pinned,
  active: message.active,
  createdBy: message.created_by,
  createdAt: message.created_at,
  updatedAt: message.updated_at,
});

const todayISODate = () => new Date().toISOString().slice(0, 10);

interface UpsertMessageInput {
  title: string;
  description: string;
  priority?: string;
  startDate?: string;
  expiryDate: string;
  pinned?: boolean;
  active?: boolean;
}

export const messageService = {
  async list() {
    const messages = await messageRepository.list();
    return messages.map(toDto);
  },

  async listActive() {
    const messages = await messageRepository.findActive(todayISODate());
    return messages.map(toDto);
  },

  async create(input: UpsertMessageInput, actorId: string) {
    const message = await messageRepository.create({
      title: input.title,
      description: input.description,
      priority: (input.priority as any) || 'Medium',
      start_date: input.startDate || todayISODate(),
      expiry_date: input.expiryDate,
      pinned: input.pinned ?? false,
      active: input.active ?? true,
      created_by: actorId,
    });

    if (message.active) {
      const users = await userRepository.list();
      await Promise.all(
        users
          .filter((u: any) => u.id !== actorId)
          .map((u: any) =>
            notificationService.notify(u.id, 'message_published', 'Important Message Published', message.title, {
              relatedType: 'important_message',
              relatedId: message.id,
            })
          )
      );
    }

    return toDto(message);
  },

  async update(id: string, patch: Partial<UpsertMessageInput>) {
    const updated = await messageRepository.update(id, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.priority !== undefined && { priority: patch.priority as any }),
      ...(patch.startDate !== undefined && { start_date: patch.startDate }),
      ...(patch.expiryDate !== undefined && { expiry_date: patch.expiryDate }),
      ...(patch.pinned !== undefined && { pinned: patch.pinned }),
      ...(patch.active !== undefined && { active: patch.active }),
    });
    if (!updated) throw notFound('Message not found');
    return toDto(updated);
  },

  async remove(id: string) {
    const existing = await messageRepository.findById(id);
    if (!existing) throw notFound('Message not found');
    await messageRepository.remove(id);
    return { message: 'Message deleted successfully' };
  },
};
