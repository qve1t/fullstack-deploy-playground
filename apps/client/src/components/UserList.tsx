import type { User } from '../api'

interface UserListProps {
  users: User[]
  loading: boolean
  onSelect: (user: User) => void
}

function UserList({ users, loading, onSelect }: UserListProps) {
  return (
    <section aria-labelledby="users-heading">
      <h2 id="users-heading">Users</h2>
      {loading ? (
        <p aria-busy="true">Loading users…</p>
      ) : users.length === 0 ? (
        <article>There are no users yet.</article>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <th scope="row">{user.name}</th>
                <td>
                  <button
                    className="outline secondary"
                    type="button"
                    onClick={() => onSelect(user)}
                  >
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export { UserList }
