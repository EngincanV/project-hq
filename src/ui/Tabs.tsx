import type { KeyboardEvent, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cx } from './cx';
import styles from './Tabs.module.css';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  /** id of the selected tab. */
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for the ids; each tab gets `${idPrefix}-tab-${id}` and controls `${idPrefix}-panel-${id}`. */
  idPrefix?: string;
}

/**
 * In-page tabs (role="tablist", arrow keys move between tabs). Render the panel yourself with
 * `role="tabpanel"` and `id={`${idPrefix}-panel-${value}`}`. For tabs that are routes use `TabNav`.
 */
export function Tabs<T extends string = string>({ items, value, onChange, label, idPrefix = 'tabs' }: TabsProps<T>) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((i) => i.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].id);
    document.getElementById(`${idPrefix}-tab-${items[next].id}`)?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            className={cx(styles.tab, selected && styles.active)}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export interface TabNavItem {
  /** Router path, absolute (`/p/x/notes`). */
  to: string;
  label: string;
  icon?: ReactNode;
  /** Only active on an exact path match (use for the index tab). */
  end?: boolean;
}

export interface TabNavProps {
  items: readonly TabNavItem[];
  /** Accessible name of the navigation. */
  label: string;
}

/** Tabs that are links to routes; the active one gets `aria-current="page"`. Scrolls horizontally on phones. */
export function TabNav({ items, label }: TabNavProps) {
  return (
    <nav aria-label={label} className={styles.list}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => cx(styles.tab, isActive && styles.active)}
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
