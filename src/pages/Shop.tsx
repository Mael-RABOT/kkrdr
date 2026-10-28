import { buyTitle, wearTitle } from '../data';
import PageHead from '../components/PageHead';
import { PageSpinner } from '../components/Spinner';
import { useDialogs } from '../dialogs';
import { useT, type Key } from '../i18n';
import { poopPoints } from '../reports';
import { useReports } from '../reportsProvider';
import { useSession } from '../session';
import { balance, TITLE_TIERS, TITLES, type TitleDef } from '../shop';
import { useTitles } from '../titlesProvider';

/** Spend poop points on titles, and pick the one to wear. */
export default function Shop() {
  const t = useT();
  const dialogs = useDialogs();
  const { me } = useSession();
  const reports = useReports();
  const mine = useTitles().get(me?.id ?? '');

  if (!me) return null;
  const earned = reports ? poopPoints(reports, me.id) : 0;
  const spent = mine?.spent ?? 0;
  const left = balance(earned, spent);
  const fail = (e: unknown) => dialogs.alert(e instanceof Error ? e.message : String(e));

  async function buy(d: TitleDef) {
    const title = t(`title.${d.id}` as Key);
    const ok = await dialogs.confirm({ title: t('shop.buyTitle'), message: t('shop.confirmBuy', { title, n: d.price }), confirmLabel: t('shop.buy'), gold: true });
    // Checked again: the balance may have changed while the dialog was open.
    if (ok && me && d.price <= left) buyTitle(me.id, d.id, d.price).catch(fail);
  }

  const wear = (id: string | null) => wearTitle(me.id, id).catch(fail);

  return (
    <>
      <PageHead title={t('shop.title')} />
      {!reports ? (
        <PageSpinner label={t('common.loading')} />
      ) : (
        <>
          <section className="card shop-head">
            <span className="shop-balance" title={t('shop.balanceHint')}>
              💩 {t('shop.balance', { n: left })}
            </span>
            <small className="muted">{t('shop.earned', { earned, spent })}</small>
            <p className="hint">{t('shop.intro')}</p>
          </section>

          {TITLE_TIERS.map((tier) => (
            <section key={tier} className="card">
              <h2>{t(`shop.tier.${tier}` as Key)}</h2>
              <ul className="shop-list">
                {TITLES.filter((d) => d.tier === tier).map((d) => {
                  const owned = !!mine?.owned[d.id];
                  const worn = mine?.worn === d.id;
                  return (
                    <li key={d.id} className={`shop-item${worn ? ' worn' : ''}`}>
                      <span className={`user-title ${d.tier}`}>{t(`title.${d.id}` as Key)}</span>
                      {!owned && <span className="shop-price">💩 {d.price}</span>}
                      <span className="shop-action">
                        {worn ? (
                          <>
                            <span className="pill amber">✓ {t('shop.wearing')}</span>
                            <button type="button" className="link" onClick={() => wear(null)}>
                              {t('shop.takeOff')}
                            </button>
                          </>
                        ) : owned ? (
                          <button type="button" className="sm" onClick={() => wear(d.id)}>
                            {t('shop.wear')}
                          </button>
                        ) : d.price <= left ? (
                          <button type="button" className="sm primary" onClick={() => buy(d)}>
                            {t('shop.buy')}
                          </button>
                        ) : (
                          <span className="muted shop-missing">{t('shop.missing', { n: d.price - left })}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
