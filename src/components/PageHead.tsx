export default function PageHead({ title }: { title: string }) {
  return (
    <header className="page-head">
      <span className="wordmark">kkrdr</span>
      <h1>{title}</h1>
    </header>
  );
}
