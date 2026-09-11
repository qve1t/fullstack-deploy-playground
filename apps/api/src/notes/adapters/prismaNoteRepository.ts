import type { PrismaClient } from "../../generated/prisma/client.js";
import type { NoteModel } from "../../generated/prisma/models.js";
import type { NoteRepository } from "../application/noteRepository.js";
import type { CreateNoteInput, Note, UpdateNoteInput } from "../domain/note.js";

class PrismaNoteRepository implements NoteRepository {
	constructor(private readonly prisma: PrismaClient) {}

	private toDomain(note: NoteModel): Note {
		return {
			id: note.id,
			title: note.heading ?? note.title,
			content: note.content,
			userId: note.userId,
			createdAt: note.createdAt,
			updatedAt: note.updatedAt,
		};
	}

	async findAll(userId?: string) {
		return (
			await this.prisma.note.findMany({
				where: userId ? { userId } : undefined,
				orderBy: { createdAt: "desc" },
			})
		).map((note) => this.toDomain(note));
	}

	async findById(id: string) {
		const note = await this.prisma.note.findUnique({ where: { id } });
		return note ? this.toDomain(note) : null;
	}

	async create(input: CreateNoteInput) {
		const heading = input.title;
		const note = await this.prisma.note.create({ data: { ...input, heading } });
		return this.toDomain(note);
	}

	async update(id: string, input: UpdateNoteInput) {
		const heading = input.title;
		const note = await this.prisma.note.update({
			where: { id },
			data: { ...input, heading },
		});
		return this.toDomain(note);
	}

	async delete(id: string) {
		await this.prisma.note.delete({ where: { id } });
	}
}

export { PrismaNoteRepository };
