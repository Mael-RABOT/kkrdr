// Seeds the local Firestore emulator with an admin, two users and some entries.
// Usage: npm run emulators (in another terminal), then npm run seed
const base = 'http://127.0.0.1:8080/v1/projects/demo-kkrdr/databases/(default)/documents';

function value(v) {
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  if (v && typeof v === 'object')
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) } };
  return { stringValue: String(v) };
}

async function put(path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, value(v)]));
  const res = await fetch(`${base}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

const now = new Date();
const people = [
  ['admin', 'Admin', true, 'adminkey'],
  ['sam', 'Sam', false, 'samkey'],
  ['lou', 'Lou', false, 'loukey'],
];
for (const [id, name, admin, key] of people) {
  await put(`users/${id}`, { name, admin, active: true, createdAt: now });
  await put(`keys/${key}`, { userId: id, createdAt: now });
}

const sizes = ['S', 'M', 'L', 'XL'];
const places = ['home', 'work', 'friends', 'public', 'other'];
const lines = ['Impressive.', 'Again?!', 'Respect 💩', 'That one was rough.', 'Legendary.'];
let n = 0;
for (let day = 0; day < 45; day++) {
  for (const [uid] of people) {
    const count = Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const at = new Date(now);
      at.setDate(at.getDate() - day);
      at.setHours(6 + Math.floor(Math.random() * 16), Math.floor(Math.random() * 60), 0, 0);
      if (at > now) continue;
      const id = `seed${n++}`;
      const comments = people.filter(([other]) => other !== uid && Math.random() < 0.2);
      for (const [other] of comments) {
        const createdAt = new Date(Math.min(now.getTime(), at.getTime() + Math.random() * 3 * 3600_000));
        const text = lines[Math.floor(Math.random() * lines.length)];
        // Some tag the entry's author, so there are notifications to see.
        const tag = Math.random() < 0.3 ? people.find(([p]) => p === uid) : null;
        await put(`poops/${id}/comments/${other}`, {
          userId: other,
          text: tag ? `@${tag[1]} ${text}` : text,
          ...(tag && { mentions: [uid] }),
          createdAt,
        });
      }
      await put(`poops/${id}`, {
        userId: uid,
        at,
        type: 1 + Math.floor(Math.random() * 7),
        size: sizes[Math.floor(Math.random() * 4)],
        place: places[Math.floor(Math.random() * 5)],
        rating: 1 + Math.floor(Math.random() * 5),
        votes: Object.fromEntries(
          people.filter(([other]) => other !== uid && Math.random() < 0.4).map(([other]) => [other, Math.random() < 0.8 ? 1 : -1]),
        ),
        ...(comments.length && { commentCount: comments.length }),
        createdAt: at,
      });
    }
  }
}
console.log(`Seeded ${people.length} users and ${n} entries.`);
console.log('Open http://localhost:5173/?key=adminkey');
