// One-field dialog used for "New note" (asks for a title) and "Rename" (asks for a file name).
import { useEffect, useState, type FormEvent } from 'react';
import { useMessages } from '../../i18n';
import { Button, Input, Modal } from '../../ui';
import { notesMessages } from './messages';

interface NameDialogProps {
  open: boolean;
  title: string;
  label: string;
  submitLabel: string;
  initialValue?: string;
  placeholder?: string;
  /** Hint under the field for the current value, e.g. the resulting file name. */
  hint?: (value: string) => string | undefined;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}

export function NameDialog({ open, title, label, submitLabel, initialValue = '', placeholder, hint, onSubmit, onClose }: NameDialogProps) {
  const t = useMessages(notesMessages);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError('');
    }
  }, [open, initialValue]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError(t.required);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(value.trim());
    } catch (err) {
      setError(t.failed(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const formId = 'notes-name-dialog';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button type="submit" form={formId} variant="primary" loading={busy}>
          {submitLabel}
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <Input
          label={label}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          error={error || undefined}
          hint={hint?.(value)}
          autoComplete="off"
        />
      </form>
    </Modal>
  );
}
