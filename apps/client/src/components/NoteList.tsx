import type { Note } from '../api'
import { NoteCard } from './NoteCard'

interface NoteListProps {
  notes: Note[]
  loading: boolean
  deletingId: string | null
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}

function NoteList({
  notes,
  loading,
  deletingId,
  onEdit,
  onDelete,
}: NoteListProps) {
  return (
    <section aria-labelledby="notes-heading">
      <hgroup>
        <h2 id="notes-heading">Your notes</h2>
        {!loading && <p>Number of notes: {notes.length}</p>}
      </hgroup>

      {loading ? (
        <p aria-busy="true">Loading notes…</p>
      ) : notes.length === 0 ? (
        <article>There are no notes yet.</article>
      ) : (
        <div>
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              deleting={deletingId === note.id}
              deleteDisabled={deletingId !== null}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export { NoteList }
