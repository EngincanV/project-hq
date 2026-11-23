import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useMessages } from '../../i18n';
import { IconButton, useToast } from '../../ui';
import { sharedMessages } from './messages';

export interface CopyButtonProps {
  value: string;
  /** What is copied, used in the accessible name ("Copy package name"). */
  what: string;
}

/** Copies `value` to the clipboard and confirms with a check icon + toast. */
export function CopyButton({ value, what }: CopyButtonProps) {
  const t = useMessages(sharedMessages);
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.show(t.copied, 'success', 2000);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.show(t.copyFailed, 'error');
    }
  }

  return (
    <IconButton
      label={t.copy(what)}
      icon={copied ? <Check size={16} /> : <Copy size={16} />}
      onClick={copy}
      disabled={!value}
    />
  );
}
