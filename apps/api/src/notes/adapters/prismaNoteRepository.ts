import type { PrismaClient } from "../../generated/prisma/client.js";
import type { NoteRepository } from "../application/noteRepository.js";
import type { CreateNoteInput, UpdateNoteInput } from "../domain/note.js";

class PrismaNoteRepository implements NoteRepository {
	constructor(private readonly prisma: PrismaClient) {}

	findAll(userId?: string) {
		return this.prisma.note.findMany({
			where: userId ? { userId } : undefined,
			orderBy: { createdAt: "desc" },
		});
	}

	findById(id: string) {
		return this.prisma.note.findUnique({ where: { id } });
	}

	create(input: CreateNoteInput) {
		return this.prisma.note.create({ data: input });
	}

	update(id: string, input: UpdateNoteInput) {
		return this.prisma.note.update({ where: { id }, data: input });
	}

	async delete(id: string) {
		await this.prisma.note.delete({ where: { id } });
	}
}

export { PrismaNoteRepository };
