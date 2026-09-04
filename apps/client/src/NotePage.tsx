import { type FormEvent, useEffect, useState } from 'react'
import { api, errorMessage, type Note, type User } from './api'
import { NoteForm } from './components/NoteForm'
import { NoteList } from './components/NoteList'

interface NotePageProps {
  user: User
  onBack: () => void
}

function NotePage({ user, onBack }: NotePageProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    api.notes
      .list(user.id)
      .then((loadedNotes) => {
        if (active) {
          setNotes(loadedNotes)
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
  }, [user.id])

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (editingId) {
        const updatedNote = await api.notes.update(
          editingId,
          user.id,
          title,
          content,
        )
        setNotes((currentNotes) =>
          currentNotes.map((note) =>
            note.id === updatedNote.id ? updatedNote : note,
          ),
        )
      } else {
        const createdNote = await api.notes.create(user.id, title, content)
        setNotes((currentNotes) => [createdNote, ...currentNotes])
      }

      resetForm()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(note: Note) {
    if (!window.confirm(`Delete the note “${note.title}”?`)) {
      return
    }

    setDeletingId(note.id)
    setError(null)

    try {
      await api.notes.delete(note.id)
      setNotes((currentNotes) =>
        currentNotes.filter((currentNote) => currentNote.id !== note.id),
      )
      if (editingId === note.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  function editNote(note: Note) {
    setEditingId(note.id)
    setTitle(note.title)
    setContent(note.content ?? '')
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setContent('')
  }

  return (
    <main className="container">
      <nav aria-label="Notes navigation">
        <ul>
          <li>
            <button
              className="outline secondary"
              type="button"
              onClick={onBack}
            >
              ← Change user
            </button>
          </li>
        </ul>
        <ul>
          <li>
            <strong>{user.name}</strong>
          </li>
        </ul>
      </nav>

      <header>
        <small>User notes</small>
        <h1>{user.name}</h1>
      </header>

      {error && <article role="alert">{error}</article>}

      <NoteForm
        title={title}
        content={content}
        editing={editingId !== null}
        saving={saving}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onSubmit={saveNote}
        onCancel={resetForm}
      />

      <NoteList
        notes={notes}
        loading={loading}
        deletingId={deletingId}
        onEdit={editNote}
        onDelete={deleteNote}
      />
    </main>
  )
}

export { NotePage }
