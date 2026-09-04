interface User {
	id: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
}

interface CreateUserInput {
	name: string;
}

type UpdateUserInput = CreateUserInput;

export type { CreateUserInput, UpdateUserInput, User };
