import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHead from '../components/PageHead';
import PoopForm from '../components/PoopForm';
import { deletePoop, getPoop, updatePoop } from '../data';
import { useDialogs } from '../dialogs';
import { useT } from '../i18n';
import { useSession } from '../session';
import type { Poop } from '../types';

export default function EditPoop() {
  const t = useT();
  const dialogs = useDialogs();
  const { id = '' } = useParams();
  const { me } = useSession();
  const navigate = useNavigate();
  // undefined while loading, null when missing.
  const [poop, setPoop] = useState<Poop | null | undefined>();

  useEffect(() => {
    getPoop(id).then(setPoop, () => setPoop(null));
  }, [id]);

  const errorMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));
  // Back to where the edit was opened from, or the feed on a direct link.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/', { replace: true }));

  async function remove(p: Poop) {
    const ok = await dialogs.confirm({ title: t('feed.deleteTitle'), message: t('feed.confirmDelete'), confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    deletePoop(p.id).catch((err) => dialogs.alert(errorMsg(err)));
    back();
  }

  if (poop === undefined) return <p className="muted">{t('common.loading')}</p>;
  if (poop === null) return <p className="muted">{t('log.notFound')}</p>;
  if (poop.userId !== me?.id) return <Navigate to="/" replace />;

  return (
    <>
      <PageHead title={t('log.editTitle')} />
      <PoopForm
        initial={poop}
        submitLabel={t('log.saveChanges')}
        onSave={(p) => {
          // Not awaited, like a new entry: the cache shows it right away.
          updatePoop(poop.id, p).catch((err) => dialogs.alert(t('log.saveFailed', { msg: errorMsg(err) })));
          back();
        }}
        footer={
          <button type="button" className="link danger" onClick={() => remove(poop)}>
            {t('common.delete')}
          </button>
        }
      />
    </>
  );
}
