import type { Note } from '../api'

interface NoteCardProps {
  note: Note
  deleting: boolean
  deleteDisabled: boolean
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function NoteCard({
  note,
  deleting,
  deleteDisabled,
  onEdit,
  onDelete,
}: NoteCardProps) {
  return (
    <article>
      <header>
        <h3>{note.title}</h3>
        <small>{dateFormatter.format(new Date(note.updatedAt))}</small>
      </header>
      {note.content && <p>{note.content}</p>}
      <footer>
        <fieldset className="grid">
          <button
            className="outline secondary"
            type="button"
            onClick={() => onEdit(note)}
            disabled={deleting}
          >
            Edit
          </button>
          <button
            className="outline contrast"
            type="button"
            onClick={() => onDelete(note)}
            aria-busy={deleting}
            disabled={deleteDisabled}
          >
            Delete
          </button>
        </fieldset>
      </footer>
    </article>
  )
}

export { NoteCard }
