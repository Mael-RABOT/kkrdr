import { useNavigate } from 'react-router-dom';
import PageHead from '../components/PageHead';
import PoopForm from '../components/PoopForm';
import { addPoop } from '../data';
import { useDialogs } from '../dialogs';
import { useT } from '../i18n';
import { useSession } from '../session';

export default function NewPoop() {
  const t = useT();
  const dialogs = useDialogs();
  const { me } = useSession();
  const navigate = useNavigate();

  return (
    <>
      <PageHead title={t('log.title')} />
      <PoopForm
        submitLabel={t('log.save')}
        onSave={(p, photo) => {
          if (!me) return;
          // Not awaited: the local cache shows the entry right away and syncs it when online.
          addPoop(me.id, p, photo ?? undefined).catch((err) => dialogs.alert(t('log.saveFailed', { msg: err instanceof Error ? err.message : String(err) })));
          navigate('/');
        }}
      />
    </>
  );
}
