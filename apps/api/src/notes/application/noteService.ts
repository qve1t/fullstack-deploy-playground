import { NotFoundError } from "../../shared/applicationErrors.js";
import type { UserRepository } from "../../users/application/userRepository.js";
import type { CreateNoteInput, UpdateNoteInput } from "../domain/note.js";
import type { NoteRepository } from "./noteRepository.js";

class NoteService {
	constructor(
		private readonly notes: NoteRepository,
		private readonly users: UserRepository,
	) {}

	list(userId?: string) {
		return this.notes.findAll(userId);
	}

	async get(id: string) {
		const note = await this.notes.findById(id);
		if (!note) {
			throw new NotFoundError("Note not found");
		}
		return note;
	}

	async create(input: CreateNoteInput) {
		await this.ensureUserExists(input.userId);
		return this.notes.create(input);
	}

	async update(id: string, input: UpdateNoteInput) {
		await this.get(id);
		await this.ensureUserExists(input.userId);
		return this.notes.update(id, input);
	}

	async delete(id: string) {
		await this.get(id);
		await this.notes.delete(id);
	}

	private async ensureUserExists(userId: string) {
		if (!(await this.users.findById(userId))) {
			throw new NotFoundError("User not found");
		}
	}
}

export { NoteService };
