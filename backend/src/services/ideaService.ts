import { ideaRepository } from '../repositories/ideaRepository';
import { notFound } from '../utils/httpError';

const toDto = (idea: any) => ({
  _id: idea.id,
  title: idea.title,
  description: idea.description,
  status: idea.status ?? 'Inbox',
  impact: idea.impact ?? 'Medium',
  effort: idea.effort ?? 'Medium',
  category: idea.category ?? null,
  createdBy: idea.creator ? { _id: idea.creator.id, name: idea.creator.name, photo: idea.creator.photo } : null,
  createdAt: idea.created_at,
});

export const ideaService = {
  async list() {
    const ideas = await ideaRepository.list();
    return ideas.map(toDto);
  },

  async create(input: { title: string; description: string; category?: string; impact?: string; effort?: string }, actorId: string) {
    const idea = await ideaRepository.create({ ...input, created_by: actorId });
    return toDto({ ...idea, creator: null });
  },

  async update(id: string, input: { status?: string; category?: string; impact?: string; effort?: string }) {
    const existing = await ideaRepository.findById(id);
    if (!existing) throw notFound('Idea not found');
    return toDto(await ideaRepository.update(id, input as any));
  },

  async remove(id: string) {
    const existing = await ideaRepository.findById(id);
    if (!existing) throw notFound('Idea not found');
    await ideaRepository.remove(id);
    return { message: 'Idea deleted successfully' };
  },
};
