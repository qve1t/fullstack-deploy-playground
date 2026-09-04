import type { FormEventHandler } from 'react'

interface NoteFormProps {
  title: string
  content: string
  editing: boolean
  saving: boolean
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  onCancel: () => void
}

function NoteForm({
  title,
  content,
  editing,
  saving,
  onTitleChange,
  onContentChange,
  onSubmit,
  onCancel,
}: NoteFormProps) {
  return (
    <article>
      <h2>{editing ? 'Edit note' : 'New note'}</h2>
      <form onSubmit={onSubmit}>
        <label>
          Title
          <input
            name="title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            maxLength={200}
            required
          />
        </label>
        <label>
          Content
          <textarea
            name="content"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            rows={5}
          />
        </label>
        <fieldset className="grid">
          <button type="submit" aria-busy={saving} disabled={saving}>
            {editing ? 'Save changes' : 'Add note'}
          </button>
          {editing && (
            <button
              className="outline secondary"
              type="button"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </fieldset>
      </form>
    </article>
  )
}

export { NoteForm }
