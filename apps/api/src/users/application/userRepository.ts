import type { CreateUserInput, UpdateUserInput, User } from "../domain/user.js";

interface UserRepository {
	findAll(): Promise<User[]>;
	findById(id: string): Promise<User | null>;
	findByName(name: string): Promise<User | null>;
	create(input: CreateUserInput): Promise<User>;
	update(id: string, input: UpdateUserInput): Promise<User>;
	delete(id: string): Promise<void>;
}

export type { UserRepository };
