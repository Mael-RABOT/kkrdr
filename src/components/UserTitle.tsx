import { useT, type Key } from '../i18n';
import { useWornTitle } from '../titlesProvider';

/** The title a user wears, coloured by its tier; nothing if they wear none. */
export default function UserTitle({ userId }: { userId: string }) {
  const t = useT();
  const title = useWornTitle(userId);
  if (!title) return null;
  return <span className={`user-title ${title.tier}`}>{t(`title.${title.id}` as Key)}</span>;
}
