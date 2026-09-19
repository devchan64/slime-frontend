import { useEffect, useState } from 'preact/hooks';
import type { Client } from '../client/api';

const POLL_MS = 2000;
const DEFAULT_AD_DISPLAY_MS = 1500;
type Attempt = { attemptId: string; campaignId: string; displayUrl: string | null; text: string; verification: 'unavailable' | 'provider' | 'default_timer'; verified: boolean;
  generation: number; epoch: number; room: string; expiresAt: number; notBefore: number };

export function SponsorGate({ client, generation, epoch, room, onReady, onExit }: {
  client: Client; generation: number; epoch: number; room: string; onReady: () => void; onExit: () => void;
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState('');
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
            || (value.displayUrl !== null && new URL(value.displayUrl).protocol !== 'https:')) throw new Error('광고 입장 계약이 올바르지 않습니다.');
        setAttempt(value);
        if (value.verified) {
          await client.connectChat();
          if (!cancelled) onReady();
        } else timer = setTimeout(poll, value.verification === 'default_timer' ? DEFAULT_AD_DISPLAY_MS : POLL_MS);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [client, generation, epoch, room, retry]);
  const source = attempt?.displayUrl ? new URL(attempt.displayUrl) : null;
  if (source && attempt) source.searchParams.set('attemptId', attempt.attemptId);
  return <section class="sponsor-gate" aria-label="스폰서 광고 확인">
    {!source && <div class="sponsor-default" aria-label="기본 광고">
      <span>SLIME</span>
      <strong>{attempt?.text ?? '슬라임에 오신걸 환영합니다.'}</strong>
    </div>}
    {source && !attempt?.verified && !error && <iframe title="스폰서 광고 재생" src={source.href}
      sandbox="allow-scripts allow-same-origin" allow="autoplay; fullscreen" referrerPolicy="no-referrer" />}
    {error && <p role="alert">{error}</p>}
    {error && <button onClick={() => setRetry(value => value + 1)}>다시 확인</button>}
    {error && <button class="secondary" onClick={onExit}>로그아웃</button>}
  </section>;
}
