import type { PrismaClient } from "../../generated/prisma/client.js";
import type { NoteModel } from "../../generated/prisma/models.js";
import type { NoteRepository } from "../application/noteRepository.js";
import type { CreateNoteInput, Note, UpdateNoteInput } from "../domain/note.js";

class PrismaNoteRepository implements NoteRepository {
	constructor(private readonly prisma: PrismaClient) {}

	private toDomain(note: NoteModel): Note {
		return { ...note, title: note.heading ?? note.title };
	}

	async findAll(userId?: string) {
		return (
			await this.prisma.note.findMany({
				where: userId ? { userId } : undefined,
				orderBy: { createdAt: "desc" },
			})
		).map(this.toDomain);
	}

	async findById(id: string) {
		const note = await this.prisma.note.findUnique({ where: { id } });
		return note ? this.toDomain(note) : null;
	}

	create(input: CreateNoteInput) {
		const heading = input.title;
		return this.prisma.note.create({ data: { ...input, heading } });
	}

	update(id: string, input: UpdateNoteInput) {
		const heading = input.title;
		return this.prisma.note.update({
			where: { id },
			data: { ...input, heading },
		});
	}

	async delete(id: string) {
		await this.prisma.note.delete({ where: { id } });
	}
}

export { PrismaNoteRepository };
