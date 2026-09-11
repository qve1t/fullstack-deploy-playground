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
