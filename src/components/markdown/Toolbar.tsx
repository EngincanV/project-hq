// Formatting buttons. One Tab stop; arrow keys / Home / End move between buttons (ARIA toolbar pattern).
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import {
  Bold,
  Code,
  Heading,
  ImagePlus,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
} from 'lucide-react';
import { useMessages } from '../../i18n';
import { IconButton } from '../../ui';
import { isApplePlatform, SHORTCUTS, shortcutLabel, type FormatAction } from './editor/commands';
import { markdownMessages } from './messages';
import styles from './MarkdownDoc.module.css';

type ToolbarItem = FormatAction | 'image';

const GROUPS: { id: ToolbarItem; icon: ReactNode }[][] = [
  [
    { id: 'heading', icon: <Heading size={18} /> },
    { id: 'bold', icon: <Bold size={18} /> },
    { id: 'italic', icon: <Italic size={18} /> },
    { id: 'strike', icon: <Strikethrough size={18} /> },
  ],
  [
    { id: 'bullet', icon: <List size={18} /> },
    { id: 'ordered', icon: <ListOrdered size={18} /> },
    { id: 'task', icon: <ListChecks size={18} /> },
    { id: 'quote', icon: <Quote size={18} /> },
  ],
  [
    { id: 'code', icon: <Code size={18} /> },
    { id: 'codeBlock', icon: <SquareCode size={18} /> },
    { id: 'link', icon: <Link size={18} /> },
    { id: 'image', icon: <ImagePlus size={18} /> },
    { id: 'rule', icon: <Minus size={18} /> },
  ],
];

interface ToolbarProps {
  onFormat: (action: FormatAction) => void;
  onImage: () => void;
}

export function Toolbar({ onFormat, onImage }: ToolbarProps) {
  const t = useMessages(markdownMessages);
  const ref = useRef<HTMLDivElement>(null);
  const apple = isApplePlatform();

  const label = (id: ToolbarItem) => {
    const name = id === 'image' ? t.image : t.actions[id];
    const key = id === 'image' ? undefined : SHORTCUTS[id];
    return key ? `${name} (${shortcutLabel(key, apple)})` : name;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % buttons.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    if (next < 0) return;
    e.preventDefault();
    buttons[index].tabIndex = -1;
    buttons[next].tabIndex = 0;
    buttons[next].focus();
  };

  let first = true;
  return (
    <div ref={ref} role="toolbar" aria-label={t.toolbar} className={styles.toolbar} onKeyDown={onKeyDown}>
      {GROUPS.map((group, i) => (
        <div key={i} className={styles.group}>
          {group.map(({ id, icon }) => {
            const tabIndex = first ? 0 : -1;
            first = false;
            return (
              <IconButton
                key={id}
                label={label(id)}
                icon={icon}
                tabIndex={tabIndex}
                // Keep the editor's selection: act on click without stealing focus first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (id === 'image' ? onImage() : onFormat(id))}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
