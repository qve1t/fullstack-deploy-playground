import type { CreateNoteInput, Note, UpdateNoteInput } from "../domain/note.js";

interface NoteRepository {
	findAll(userId?: string): Promise<Note[]>;
	findById(id: string): Promise<Note | null>;
	create(input: CreateNoteInput): Promise<Note>;
	update(id: string, input: UpdateNoteInput): Promise<Note>;
	delete(id: string): Promise<void>;
}

export type { NoteRepository };
