// Loads the month files a view needs and writes every change back to the whole files right away.
//
// Same saving rules as the roadmap board: changes show optimistically, writes run one after another (so an
// older write can never land after a newer one), a failed write rolls the view back to what storage has
// and rejects, and once nothing is pending the files are re-read from storage (picking up outside edits).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorageQuery } from '../../data';
import { useStorage } from '../../storage';
import { monthOf, type DateKey, type MonthKey } from './dates';
import { joinTag, parsePlan, planItems, planPath, serializePlan, type ItemRef, type PlanDoc, type PlanItem } from './model';
import { addItem, deleteItem, moveItems, toggleItem, updateItem, type PlanDocs } from './operations';

type Texts = Record<MonthKey, string>;

export interface PlanActions {
  add: (date: DateKey, title: string, project: string | null, index?: number) => Promise<void>;
  toggle: (item: ItemRef, done: boolean) => Promise<void>;
  /** Changes title/project and moves the item when `date` differs from its current day. */
  edit: (item: PlanItem, patch: { title: string; project: string | null; date: DateKey }) => Promise<void>;
  remove: (item: ItemRef) => Promise<void>;
  /** Moves items to `date`; `index` is the position in that day counted without the moved items. */
  move: (items: readonly ItemRef[], date: DateKey, index?: number) => Promise<void>;
}

export interface Plan extends PlanActions {
  /** Items of the requested months, by date (file order within a day). */
  items: PlanItem[];
  loading: boolean;
  error: Error | null;
}

/** `months` are the month files to load; `slugs` are the known project slugs (for `#tag`s). */
export function usePlan(months: readonly MonthKey[], slugs: ReadonlySet<string>): Plan {
  const storage = useStorage();
  const key = [...new Set(months)].sort().join(',');
  const monthList = useMemo(() => (key ? key.split(',') : []), [key]);
  const query = useStorageQuery(`plan:${key}`, async (s) => {
    const texts = await Promise.all(monthList.map((m) => s.readText(planPath(m))));
    return Object.fromEntries(monthList.map((m, i) => [m, texts[i] ?? ''])) as Texts;
  });

  // While another set of months loads, keep showing the last one instead of flashing a spinner.
  const lastLoaded = useRef<Texts | undefined>(undefined);
  if (query.data) lastLoaded.current = query.data;
  const stored = query.data ?? lastLoaded.current;

  const [optimistic, setOptimistic] = useState<Texts>({});
  const pending = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef<Texts>({});
  latest.current = { ...stored, ...optimistic };

  useEffect(() => {
    if (pending.current === 0) setOptimistic({});
  }, [query.data]);

  const write = useCallback(
    (changed: Texts) => {
      latest.current = { ...latest.current, ...changed };
      setOptimistic((prev) => ({ ...prev, ...changed }));
      pending.current++;
      const run = queue.current.then(async () => {
        for (const [month, text] of Object.entries(changed)) await storage.writeText(planPath(month), text);
      });
      queue.current = run.catch(() => undefined);
      return run.then(
        () => {
          pending.current--;
        },
        (err: unknown) => {
          pending.current--;
          setOptimistic({});
          throw err;
        },
      );
    },
    [storage],
  );

  /** Runs a multi-file operation on the latest texts (reading months that are not loaded) and saves. */
  const apply = useCallback(
    async (needed: readonly MonthKey[], op: (docs: PlanDocs) => Record<MonthKey, PlanDoc>) => {
      const missing = needed.filter((m) => latest.current[m] === undefined);
      const read = await Promise.all(missing.map((m) => storage.readText(planPath(m))));
      const base: Texts = { ...Object.fromEntries(missing.map((m, i) => [m, read[i] ?? ''])), ...latest.current };
      const docs = Object.fromEntries(needed.map((m) => [m, parsePlan(base[m])]));
      const changed: Texts = {};
      for (const [month, doc] of Object.entries(op(docs))) {
        const text = serializePlan(doc);
        if (text !== base[month]) changed[month] = text;
      }
      if (Object.keys(changed).length > 0) await write(changed);
    },
    [storage, write],
  );

  const actions = useMemo<PlanActions>(() => {
    const one = (month: MonthKey, op: (doc: PlanDoc) => PlanDoc) => apply([month], (docs) => ({ [month]: op(docs[month]) }));
    const move: PlanActions['move'] = (items, date, index) =>
      apply([...new Set([...items.map((i) => i.month), monthOf(date)])], (docs) => moveItems(docs, items, date, index));
    return {
      add: (date, title, project, index) => one(monthOf(date), (doc) => addItem(doc, date, joinTag(title, project), index)),
      toggle: (item, done) => one(item.month, (doc) => toggleItem(doc, item.id, done)),
      remove: (item) => one(item.month, (doc) => deleteItem(doc, item.id)),
      move,
      edit: (item, { title, project, date }) =>
        apply([...new Set([item.month, monthOf(date)])], (docs) => updateItem(docs, item, joinTag(title, project), date)),
    };
  }, [apply]);

  const items = useMemo(() => {
    const texts = { ...stored, ...optimistic };
    return monthList
      .flatMap((m) => planItems(parsePlan(texts[m] ?? ''), m, slugs))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [stored, optimistic, monthList, slugs]);

  return {
    items,
    loading: query.loading && !stored,
    error: query.error,
    ...actions,
  };
}
