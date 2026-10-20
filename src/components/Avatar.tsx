import { blobatarUri } from 'blobatar/uri';
import { useAvatar } from '../avatars';

// Generated SVGs, by name: the same few people are drawn over and over.
const generated = new Map<string, string>();
function blob(seed: string) {
  let uri = generated.get(seed);
  if (!uri) generated.set(seed, (uri = blobatarUri(seed)));
  return uri;
}

/** Profile picture, or a blobatar generated from the name when there is none. */
export default function Avatar({ id, name, size = 40 }: { id: string; name: string | undefined; size?: number }) {
  const photo = useAvatar(id);
  return (
    <img
      className={photo ? 'avatar' : 'avatar blob'}
      src={photo ?? blob(name ?? id)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
