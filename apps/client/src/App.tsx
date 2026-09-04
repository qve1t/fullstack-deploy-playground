import { useState } from 'react'
import type { User } from './api'
import { NotePage } from './NotePage'
import { UserPage } from './UserPage'

function App() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  if (selectedUser) {
    return <NotePage user={selectedUser} onBack={() => setSelectedUser(null)} />
  }

  return <UserPage onSelect={setSelectedUser} />
}

export { App }
