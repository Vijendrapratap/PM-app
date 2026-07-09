import { ideaRepository } from '../repositories/ideaRepository';
import { notFound } from '../utils/httpError';

const toDto = (idea: any) => ({
  _id: idea.id,
  title: idea.title,
  description: idea.description,
  createdBy: idea.creator ? { _id: idea.creator.id, name: idea.creator.name, photo: idea.creator.photo } : null,
  createdAt: idea.created_at,
});

export const ideaService = {
  async list() {
    const ideas = await ideaRepository.list();
    return ideas.map(toDto);
  },

  async create(input: { title: string; description: string }, actorId: string) {
    const idea = await ideaRepository.create({ title: input.title, description: input.description, created_by: actorId });
    return toDto({ ...idea, creator: null });
  },

  async remove(id: string) {
    const existing = await ideaRepository.findById(id);
    if (!existing) throw notFound('Idea not found');
    await ideaRepository.remove(id);
    return { message: 'Idea deleted successfully' };
  },
};
