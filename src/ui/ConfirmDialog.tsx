import type { ReactNode } from 'react';
import { useMessages } from '../i18n';
import { Button } from './Button';
import { Modal } from './Modal';
import { uiMessages } from './messages';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Explanation shown in the body. */
  message: ReactNode;
  /** Defaults to "Onayla" / "Confirm". */
  confirmLabel?: string;
  /** Defaults to "Vazgeç" / "Cancel". */
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  /** Shows a spinner on the confirm button. */
  busy?: boolean;
  /** Disables the confirm button (e.g. until a confirmation text is typed). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Yes/no question in a Modal. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useMessages(uiMessages);
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t.cancel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} disabled={confirmDisabled}>
            {confirmLabel ?? t.confirm}
          </Button>
        </>
      }
    >
      <div>{message}</div>
    </Modal>
  );
}
