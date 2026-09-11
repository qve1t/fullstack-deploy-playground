export interface User {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string | null
  userId: string
  createdAt: string
  updatedAt: string
}

interface ApiErrorBody {
  message?: unknown
}

const baseUrl = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init)

  if (!response.ok) {
    let message = `Request failed (${response.status}).`

    try {
      const body = (await response.json()) as ApiErrorBody
      if (typeof body.message === 'string') {
        message = body.message
      }
    } catch {}

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function sendJson(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

const api = {
  users: {
    list: () => request<User[]>('/users'),
    create: (name: string) =>
      request<User>('/users', sendJson('POST', { name: name.trim() })),
  },
  notes: {
    list: (userId: string) =>
      request<Note[]>(`/notes?userId=${encodeURIComponent(userId)}`),
    create: (userId: string, title: string, content: string) =>
      request<Note>(
        '/notes',
        sendJson('POST', {
          userId,
          title: title.trim(),
          content: content.trim() || null,
        }),
      ),
    update: (id: string, userId: string, title: string, content: string) =>
      request<Note>(
        `/notes/${id}`,
        sendJson('PUT', {
          userId,
          title: title.trim(),
          content: content.trim() || null,
        }),
      ),
    delete: (id: string) => request<void>(`/notes/${id}`, { method: 'DELETE' }),
  },
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unknown error occurred.'
}

export { api, errorMessage }
