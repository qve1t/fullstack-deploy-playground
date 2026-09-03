import {
	ConflictError,
	NotFoundError,
} from "../../shared/applicationErrors.js";
import type { CreateUserInput, UpdateUserInput } from "../domain/user.js";
import type { UserRepository } from "./userRepository.js";

class UserService {
	constructor(private readonly users: UserRepository) {}

	list() {
		return this.users.findAll();
	}

	async get(id: string) {
		const user = await this.users.findById(id);
		if (!user) {
			throw new NotFoundError("User not found");
		}
		return user;
	}

	async create(input: CreateUserInput) {
		if (await this.users.findByName(input.name)) {
			throw new ConflictError("Name is already in use");
		}
		return this.users.create(input);
	}

	async update(id: string, input: UpdateUserInput) {
		const user = await this.get(id);
		const userWithName = await this.users.findByName(input.name);

		if (userWithName && userWithName.id !== user.id) {
			throw new ConflictError("Name is already in use");
		}

		return this.users.update(id, input);
	}

	async delete(id: string) {
		await this.get(id);
		await this.users.delete(id);
	}
}

export { UserService };
