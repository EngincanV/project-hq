import { useNavigate } from 'react-router-dom';
import { useMessages } from '../i18n';
import { Button, EmptyState } from '../ui';
import { appMessages } from './messages';

export function NotFound() {
  const t = useMessages(appMessages);
  const navigate = useNavigate();
  return (
    <EmptyState
      title={t.notFoundTitle}
      description={t.notFoundText}
      action={<Button onClick={() => navigate('/')}>{t.backToDashboard}</Button>}
    />
  );
}
