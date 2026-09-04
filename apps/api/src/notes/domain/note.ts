interface Note {
	id: string;
	title: string;
	content: string | null;
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

interface CreateNoteInput {
	title: string;
	content?: string | null;
	userId: string;
}

type UpdateNoteInput = CreateNoteInput;

export type { CreateNoteInput, Note, UpdateNoteInput };
