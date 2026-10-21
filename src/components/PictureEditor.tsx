import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import Spinner from './Spinner';
import { encodeCrop, loadImage, type Crop } from '../image';
import Modal from './Modal';

/** On-screen size of the preview, in CSS pixels. */
const VIEW = 260;
const MAX_ZOOM = 5;

interface View {
  zoom: number;
  /** Center of the visible square, in source pixels. */
  cx: number;
  cy: number;
}

/** Keeps the visible square inside the image. */
function clamp(img: ImageBitmap, v: View): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
  const half = Math.min(img.width, img.height) / zoom / 2;
  return {
    zoom,
    cx: Math.min(img.width - half, Math.max(half, v.cx)),
    cy: Math.min(img.height - half, Math.max(half, v.cy)),
  };
}

function cropOf(img: ImageBitmap, v: View): Crop {
  const side = Math.min(img.width, img.height) / v.zoom;
  return { x: v.cx - side / 2, y: v.cy - side / 2, side };
}

interface Props {
  file: File;
  onCancel: () => void;
  onSave: (bytes: Uint8Array, type: string) => Promise<void>;
}

/** Pick the part of a photo to use: drag to move, pinch / scroll / slider to zoom. */
export default function PictureEditor({ file, onCancel, onSave }: Props) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, cx: 0, cy: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  // Active pointers, for dragging and pinching.
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    let bitmap: ImageBitmap | undefined;
    loadImage(file).then(
      (b) => {
        bitmap = b;
        setImg(b);
        setView({ zoom: 1, cx: b.width / 2, cy: b.height / 2 });
      },
      () => setUnreadable(true),
    );
    return () => bitmap?.close();
  }, [file]);

  // Redraw the preview.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !img) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = Math.round(VIEW * dpr);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    const { x, y, side } = cropOf(img, view);
    ctx.drawImage(img, x, y, side, side, 0, 0, c.width, c.height);
  }, [img, view]);

  const update = (fn: (v: View) => View) => img && setView((v) => clamp(img, fn(v)));

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: React.PointerEvent) {
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    if (!prev || !img) return;
    const next = { x: e.clientX, y: e.clientY };
    if (ps.size === 1) {
      // Drag: the image follows the finger.
      update((v) => {
        const perPx = Math.min(img.width, img.height) / v.zoom / VIEW;
        return { ...v, cx: v.cx - (next.x - prev.x) * perPx, cy: v.cy - (next.y - prev.y) * perPx };
      });
    } else if (ps.size === 2) {
      // Pinch: zoom by the change in distance between the two fingers.
      const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) update((v) => ({ ...v, zoom: v.zoom * (after / before) }));
    }
    ps.set(e.pointerId, next);
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    setError(null);
    try {
      const { bytes, type } = await encodeCrop(img, cropOf(img, view));
      await onSave(bytes, type);
    } catch (e) {
      setError(t('profile.picFailed', { msg: e instanceof Error ? e.message : String(e) }));
      setBusy(false);
    }
  }

  return (
    <Modal className="pic-editor" onClose={() => !busy && onCancel()}>
      <h2>{t('profile.editPic')}</h2>
      <div className="pic-stage" style={{ width: VIEW, height: VIEW }}>
        <canvas
          ref={canvas}
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => update((v) => ({ ...v, zoom: v.zoom * Math.exp(-e.deltaY * 0.002) }))}
        />
        <span className="pic-ring" aria-hidden />
      </div>
      <label className="pic-zoom">
        <span className="label">{t('profile.zoom')}</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          onChange={(e) => update((v) => ({ ...v, zoom: Number(e.target.value) }))}
          disabled={!img}
        />
      </label>
      <p className="hint">{t('profile.picHint')}</p>
      {unreadable && <p className="error">{t('profile.picUnreadable')}</p>}
      {error && <p className="error">{error}</p>}
      <div className="modal-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button type="button" className="primary" onClick={save} disabled={busy || !img}>
          {busy ? <Spinner label={t('profile.uploading')} size="sm" show /> : t('profile.savePic')}
        </button>
      </div>
    </Modal>
  );
}
