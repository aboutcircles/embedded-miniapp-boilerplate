'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/components/wallet/WalletProvider';
import { explorerTxUrl, fromAtto, getSdk } from '@/lib/circles';
import { shortenAddress } from '@/lib/utils';

const PAGE = 20;

// Structural view of the enriched rows we render. `event` is intentionally loose —
// the indexer returns different event shapes (transfers, mints, trust) under one feed.
type ActivityRow = {
  transactionHash: string;
  timestamp: number;
  event: Record<string, unknown>;
  participants: Record<string, { profile?: { name?: string } | null }>;
};

type EventFields = { type?: string; from?: string; to?: string; value?: string };

function readEvent(event: Record<string, unknown>): EventFields {
  return {
    type: typeof event.type === 'string' ? event.type : undefined,
    from: typeof event.from === 'string' ? event.from : undefined,
    to: typeof event.to === 'string' ? event.to : undefined,
    value: event.value != null ? String(event.value) : undefined,
  };
}

function humanizeType(type: string): string {
  const base = type.replace(/^Crc(V1|V2)_/, '');
  return base ? base.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : 'activity';
}

function when(ts: number): string {
  const d = new Date(ts * 1000);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

type Described = {
  verb: 'sent' | 'received' | 'minted' | string;
  counterparty?: string;
  value?: string;
};

function describe(ev: EventFields, me: string): Described {
  const meL = me.toLowerCase();
  const value = ev.value && /^\d+$/.test(ev.value) ? fromAtto(BigInt(ev.value)) : undefined;
  if (/mint/i.test(ev.type ?? '')) return { verb: 'minted', value };
  if (ev.from && ev.from.toLowerCase() === meL) return { verb: 'sent', counterparty: ev.to, value };
  if (ev.to && ev.to.toLowerCase() === meL) return { verb: 'received', counterparty: ev.from, value };
  return { verb: humanizeType(ev.type ?? '') };
}

const BADGE: Record<string, 'default' | 'secondary' | 'outline'> = {
  received: 'default',
  sent: 'secondary',
  minted: 'outline',
};

export function ActivityFeed() {
  const { address, isConnected } = useWallet();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'loadingMore' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    (async () => {
      setRows([]);
      setCursor(null);
      setHasMore(false);
      setError(null);
      setState('loading');
      try {
        const sdk = await getSdk();
        // One call returns transfers + mints already joined with participant profiles.
        const res = await sdk.rpc.sdk.getTransactionHistoryEnriched(
          address as `0x${string}`,
          undefined,
          undefined,
          PAGE,
        );
        if (cancelled) return;
        setRows(res.results as ActivityRow[]);
        setCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setState('idle');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load activity.');
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  async function loadMore() {
    if (!address || !cursor) return;
    setState('loadingMore');
    try {
      const sdk = await getSdk();
      const res = await sdk.rpc.sdk.getTransactionHistoryEnriched(
        address as `0x${string}`,
        undefined,
        undefined,
        PAGE,
        cursor, // cursor-based pagination
      );
      setRows((prev) => [...prev, ...(res.results as ActivityRow[])]);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more.');
      setState('error');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>
          Transfers and mints, joined with participant profiles in one call via{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            sdk.rpc.sdk.getTransactionHistoryEnriched(address)
          </code>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {!isConnected && (
          <p className="text-muted-foreground">
            Connect inside the Circles host to see the user&apos;s activity.
          </p>
        )}

        {isConnected && state === 'loading' && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {isConnected && error && <p className="text-destructive">{error}</p>}

        {isConnected && state !== 'loading' && !error && rows.length === 0 && (
          <p className="text-muted-foreground">No activity yet for this avatar.</p>
        )}

        {isConnected && rows.length > 0 && (
          <>
            <ul className="divide-y">
              {rows.map((row) => {
                const ev = readEvent(row.event);
                const d = describe(ev, address!);
                const lower = Object.fromEntries(
                  Object.entries(row.participants ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
                );
                const name = d.counterparty
                  ? lower[d.counterparty.toLowerCase()]?.profile?.name
                  : undefined;
                return (
                  <li
                    key={`${row.transactionHash}-${row.timestamp}-${ev.from ?? ''}-${ev.to ?? ''}`}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={BADGE[d.verb] ?? 'outline'}>{d.verb}</Badge>
                        {d.value && <span className="font-mono">{d.value} CRC</span>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {d.counterparty && <>{name || shortenAddress(d.counterparty)} · </>}
                        {when(row.timestamp)}
                      </div>
                    </div>
                    <a
                      className="shrink-0 font-mono text-xs text-muted-foreground underline"
                      href={explorerTxUrl(row.transactionHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortenAddress(row.transactionHash)}
                    </a>
                  </li>
                );
              })}
            </ul>

            {hasMore && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={state === 'loadingMore'}
                >
                  {state === 'loadingMore' ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
