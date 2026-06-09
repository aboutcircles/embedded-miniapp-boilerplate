'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSdk } from '@/lib/circles';
import { shortenAddress } from '@/lib/utils';

const SHOWN = 6;

// `circles` is already a decimal CRC number (not atto) — see AGENTS.md.
type TokenRow = {
  tokenOwner: `0x${string}`;
  tokenType: string;
  circles: number;
  isGroup: boolean;
  isWrapped: boolean;
  isInflationary: boolean;
};

type Loaded = { rows: TokenRow[]; names: Record<string, string>; total: number; extra: number };

function tokenLabel(t: TokenRow): string {
  if (t.isGroup) return 'group';
  if (t.isWrapped) return 'wrapped';
  return 'personal';
}

const fmt = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0';

export function BalancesCard() {
  const { address, isConnected } = useWallet();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    (async () => {
      setData(null);
      setError(null);
      try {
        const sdk = await getSdk();
        const all = (await sdk.rpc.balance.getTokenBalances(address as `0x${string}`)) as TokenRow[];
        const sorted = [...all].sort((a, b) => b.circles - a.circles);
        const shown = sorted.slice(0, SHOWN);
        const total = all.reduce((s, t) => s + (Number.isFinite(t.circles) ? t.circles : 0), 0);

        let names: Record<string, string> = {};
        try {
          const owners = shown.map((t) => t.tokenOwner);
          const profiles = await sdk.rpc.profile.getProfileByAddressBatch(owners);
          names = Object.fromEntries(
            profiles
              .map((p, i) => [owners[i].toLowerCase(), p?.name ?? ''] as const)
              .filter(([, name]) => name),
          );
        } catch {
          // Names are decorative.
        }

        if (cancelled) return;
        setData({ rows: shown, names, total, extra: all.length - shown.length });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load balances.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
        <CardDescription>
          Per-token breakdown via{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            sdk.rpc.balance.getTokenBalances(address)
          </code>{' '}
          — a Circles balance is a basket of many avatars&apos; tokens, not one number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!isConnected && (
          <p className="text-muted-foreground">
            Connect inside the Circles host to see the user&apos;s holdings.
          </p>
        )}

        {isConnected && error && <p className="text-muted-foreground">{error}</p>}

        {isConnected && !data && !error && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-4 w-full max-w-xs" />
          </div>
        )}

        {isConnected && data && (
          <>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{fmt(data.total)}</div>
              <div className="text-xs text-muted-foreground">total CRC across all tokens</div>
            </div>

            {data.rows.length === 0 ? (
              <p className="text-muted-foreground">No token balances yet.</p>
            ) : (
              <ul className="divide-y">
                {data.rows.map((t, i) => (
                  <li
                    key={`${t.tokenOwner}-${t.tokenType}-${i}`}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span>{data.names[t.tokenOwner.toLowerCase()] || shortenAddress(t.tokenOwner)}</span>
                      <Badge variant="outline">{tokenLabel(t)}</Badge>
                    </div>
                    <span className="font-mono tabular-nums">{fmt(t.circles)}</span>
                  </li>
                ))}
              </ul>
            )}

            {data.extra > 0 && (
              <p className="text-xs text-muted-foreground">+{data.extra} more token{data.extra === 1 ? '' : 's'}.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
