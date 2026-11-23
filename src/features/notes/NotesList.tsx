import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useLang, useMessages } from '../../i18n';
import { Button, cx } from '../../ui';
import { filterNotes, type Note } from './notes';
import { notesMessages } from './messages';
import styles from './NotesTab.module.css';

interface NotesListProps {
  notes: Note[];
  /** Route base, `/p/<slug>/notes`. */
  base: string;
  onNew: () => void;
}

export function NotesList({ notes, base, onNew }: NotesListProps) {
  const t = useMessages(notesMessages);
  const [lang] = useLang();
  const [query, setQuery] = useState('');
  const visible = filterNotes(notes, query, lang);

  return (
    <div className={styles.list}>
      <div className={styles.listHead}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <span className="visually-hidden">{t.search}</span>
          <input
            type="search"
            value={query}
            placeholder={t.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Button variant="primary" icon={<Plus size={16} />} onClick={onNew}>
          {t.newNote}
        </Button>
      </div>
      <nav aria-label={t.listLabel}>
        {visible.length === 0 ? (
          <p className={styles.noMatches}>{t.noMatches}</p>
        ) : (
          <ul className={styles.items}>
            {visible.map((note) => (
              <li key={note.path}>
                <NavLink
                  to={`${base}/${encodeURIComponent(note.name)}`}
                  className={({ isActive }) => cx(styles.item, isActive && styles.active)}
                >
                  <span className={styles.itemTitle}>{note.title}</span>
                  {note.snippet && <span className={styles.itemSnippet}>{note.snippet}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
