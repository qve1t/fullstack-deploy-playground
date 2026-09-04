import type { FormEventHandler } from 'react'

interface NewUserFormProps {
  name: string
  creating: boolean
  onNameChange: (name: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

function NewUserForm({
  name,
  creating,
  onNameChange,
  onSubmit,
}: NewUserFormProps) {
  return (
    <section aria-labelledby="new-user-heading">
      <article>
        <h2 id="new-user-heading">New user</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="new-user-name">Name</label>
          <fieldset className="grid">
            <input
              id="new-user-name"
              name="name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={100}
              placeholder="e.g. Anna"
              autoComplete="name"
              required
            />
            <button type="submit" aria-busy={creating} disabled={creating}>
              Create and select
            </button>
          </fieldset>
        </form>
      </article>
    </section>
  )
}

export { NewUserForm }
