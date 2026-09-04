import { type FormEvent, useEffect, useState } from 'react'
import { api, errorMessage, type User } from './api'
import { NewUserForm } from './components/NewUserForm'
import { UserList } from './components/UserList'

interface UserPageProps {
  onSelect: (user: User) => void
}

function UserPage({ onSelect }: UserPageProps) {
  const [users, setUsers] = useState<User[]>([])
  const [newUserName, setNewUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    api.users
      .list()
      .then((loadedUsers) => {
        if (active) {
          setUsers(loadedUsers)
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(errorMessage(loadError))
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const user = await api.users.create(newUserName)
      setNewUserName('')
      onSelect(user)
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="container">
      <header>
        <small>Simple notes app</small>
        <h1>Select a user</h1>
        <p>Choose a profile to view its notes.</p>
      </header>

      {error && <article role="alert">{error}</article>}

      <NewUserForm
        name={newUserName}
        creating={creating}
        onNameChange={setNewUserName}
        onSubmit={createUser}
      />

      <UserList users={users} loading={loading} onSelect={onSelect} />
    </main>
  )
}

export { UserPage }
