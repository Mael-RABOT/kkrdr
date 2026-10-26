import { useEffect, useRef, useState } from 'react';
import { getPicture } from '../data';
import { useT } from '../i18n';
import type { Poop } from '../types';

/** An entry's photo or GIF, if it has one. The photo loads once it comes near the screen, or at once if `eager`. */
export default function PostMedia({ poop: p, eager }: { poop: Poop; eager?: boolean }) {
  const t = useT();
  if (p.gif) return <img className="post-media gif" src={p.gif} alt={t('log.gif')} loading="lazy" />;
  if (p.photo) return <PostPhoto poopId={p.id} v={p.photo} alt={t('log.picture')} eager={eager} />;
  return null;
}

function PostPhoto({ poopId, v, alt, eager }: { poopId: string; v: number; alt: string; eager?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!!eager);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let live = true;
    setFailed(false);
    getPicture(poopId, v).then(
      (u) => live && (u ? setUrl(u) : setFailed(true)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [near, poopId, v]);

  if (failed) return null;
  return (
    <div ref={box} className={`post-media photo${url ? '' : ' loading'}`}>
      {url && <img src={url} alt={alt} />}
    </div>
  );
}
