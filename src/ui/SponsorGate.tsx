import { useEffect, useState } from 'preact/hooks';
import type { Client } from '../client/api';
import { LocalizedError, noticeText, type Notice } from '../client/notice';
import { useTranslation } from '../i18n';

const POLL_MS = 2000;
const DEFAULT_AD_DISPLAY_MS = 1500;
type Attempt = { attemptId: string; campaignId: string; displayUrl: string | null; text: string; verification: 'unavailable' | 'provider' | 'default_timer'; verified: boolean;
  generation: number; epoch: number; room: string; expiresAt: number; notBefore: number };

export function SponsorGate({ client, generation, epoch, room, onReady, onExit }: {
  client: Client; generation: number; epoch: number; room: string; onReady: () => void; onExit: () => void;
}) {
  const { t, locale } = useTranslation();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [errorNotice, setError] = useState<Notice>('');
  const error = noticeText(errorNotice, locale, t);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setError(''); setAttempt(null);
    const poll = async () => {
      try {
        const value: Attempt = await client.request('/v1/sponsorship/attempts', {});
        if (cancelled) return;
        if (value.generation !== generation || value.epoch !== epoch || value.room !== room
            || typeof value.verified !== 'boolean' || typeof value.attemptId !== 'string'
            || typeof value.text !== 'string'
            || !['unavailable', 'provider', 'default_timer'].includes(value.verification)
            || (value.displayUrl !== null && new URL(value.displayUrl).protocol !== 'https:')) throw new LocalizedError('sponsor.invalidAttempt');
        setAttempt(value);
        if (value.verified) {
          await client.connectChat();
          if (!cancelled) onReady();
        } else timer = setTimeout(poll, value.verification === 'default_timer' ? DEFAULT_AD_DISPLAY_MS : POLL_MS);
      } catch (e) { if (!cancelled) setError(e as Error); }
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [client, generation, epoch, room, retry]);
  const source = attempt?.displayUrl ? new URL(attempt.displayUrl) : null;
  if (source && attempt) source.searchParams.set('attemptId', attempt.attemptId);
  return <section class="sponsor-gate" aria-label={t('sponsor.region')}>
    {!source && <div class="sponsor-default" aria-label={t('sponsor.defaultAd')}>
      <span>SLIME</span>
      <strong>{attempt?.text ?? t('sponsor.welcome')}</strong>
    </div>}
    {source && !attempt?.verified && !error && <iframe title={t('sponsor.playback')} src={source.href}
      sandbox="allow-scripts allow-same-origin" allow="autoplay; fullscreen" referrerPolicy="no-referrer" />}
    {error && <p role="alert">{error}</p>}
    {error && <button onClick={() => setRetry(value => value + 1)}>{t('sponsor.retry')}</button>}
    {error && <button class="secondary" onClick={onExit}>{t('sponsor.logout')}</button>}
  </section>;
}
