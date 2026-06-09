'use client';

import { useEffect, useState } from 'react';

import { TxResult, type TxStatus } from '@/components/circles/TxResult';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSdk, submitViaHost, INDEFINITE_TRUST_EXPIRY } from '@/lib/circles';
import { shortenAddress } from '@/lib/utils';

import type { AggregatedTrustRelation, TrustRelationType } from '@aboutcircles/sdk';

// The RPC row carries `objectAvatarType` at runtime beyond the published type.
type TrustRow = AggregatedTrustRelation & { objectAvatarType?: string };

type Relations = {
  rows: TrustRow[];
  names: Record<string, string>;
  counts: Record<TrustRelationType, number>;
  total: number;
};

const SHOWN_LIMIT = 12;

const RELATION_LABEL: Record<TrustRelationType, string> = {
  mutuallyTrusts: 'mutual',
  trusts: 'you trust',
  trustedBy: 'trusts you',
};

const RELATION_ORDER: Record<TrustRelationType, number> = {
  mutuallyTrusts: 0,
  trusts: 1,
  trustedBy: 2,
};

const isAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value.trim());

export function TrustDemo() {
  const { address, isConnected } = useWallet();
  const [data, setData] = useState<Relations | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  // --- Read: the connected avatar's aggregated trust graph ---
  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    (async () => {
      setData(null);
      setLoadError(null);
      try {
        const sdk = await getSdk();
        // One RPC call returns every relation already classified as
        // mutuallyTrusts / trusts (outgoing) / trustedBy (incoming).
        const all = (await sdk.rpc.trust.getAggregatedTrustRelations(
          address as `0x${string}`,
        )) as TrustRow[];

        const counts: Record<TrustRelationType, number> = {
          mutuallyTrusts: 0,
          trusts: 0,
          trustedBy: 0,
        };
        for (const r of all) counts[r.relation]++;

        const rows = [...all]
          .sort(
            (a, b) =>
              RELATION_ORDER[a.relation] - RELATION_ORDER[b.relation] ||
              b.timestamp - a.timestamp,
          )
          .slice(0, SHOWN_LIMIT);

        // Hydrate display names for just the shown rows, in a single batch call.
        let names: Record<string, string> = {};
        try {
          const addrs = rows.map((r) => r.objectAvatar);
          const profiles = await sdk.rpc.profile.getProfileByAddressBatch(addrs);
          names = Object.fromEntries(
            profiles
              .map((p, i) => [addrs[i].toLowerCase(), p?.name ?? ''] as const)
              .filter(([, name]) => name),
          );
        } catch {
          // Names are decorative; fall back to addresses.
        }

        if (cancelled) return;
        setData({ rows, names, counts, total: all.length });
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load trust relations.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, refresh]);

  // --- Write: trust an address ---
  const [trustee, setTrustee] = useState('');
  const [status, setStatus] = useState<TxStatus>({ kind: 'idle' });
  const busy = status.kind === 'encoding' || status.kind === 'submitting';
  const canSubmit = isConnected && isAddress(trustee) && !busy;

  async function handleTrust() {
    setStatus({ kind: 'encoding' });
    try {
      const sdk = await getSdk();
      // Encode the Hub v2 `trust(trustReceiver, expiry)` call. Max-uint96 expiry =
      // indefinite trust; the host signs and broadcasts it from the user's Safe.
      const tx = sdk.core.hubV2.trust(
        trustee.trim() as `0x${string}`,
        INDEFINITE_TRUST_EXPIRY,
      );
      setStatus({ kind: 'submitting' });
      const hashes = await submitViaHost([tx]);
      setStatus({ kind: 'submitted', hashes });
      setTrustee('');
      setRefresh((n) => n + 1); // re-read once the new edge is indexed
    } catch (err) {
      setStatus({ kind: 'error', error: err instanceof Error ? err.message : 'Cancelled' });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Trust network</span>
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefresh((n) => n + 1)}
                disabled={!data && !loadError}
              >
                {!data && !loadError ? 'Loading…' : 'Refresh'}
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Classified in one call via{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              sdk.rpc.trust.getAggregatedTrustRelations(address)
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!isConnected && (
            <p className="text-muted-foreground">
              Connect inside the Circles host to read the user&apos;s trust graph.
            </p>
          )}

          {isConnected && loadError && <p className="text-destructive">{loadError}</p>}

          {isConnected && !data && !loadError && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
          )}

          {isConnected && data && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="mutual" value={data.counts.mutuallyTrusts} />
                <Stat label="you trust" value={data.counts.trusts} />
                <Stat label="trusts you" value={data.counts.trustedBy} />
              </div>

              {data.total === 0 ? (
                <p className="text-muted-foreground">
                  No trust connections yet. Trust someone below to start a network.
                </p>
              ) : (
                <>
                  <ul className="divide-y">
                    {data.rows.map((r) => {
                      const name = data.names[r.objectAvatar.toLowerCase()];
                      return (
                        <li
                          key={`${r.relation}-${r.objectAvatar}`}
                          className="flex items-center justify-between gap-3 py-1.5"
                        >
                          <div className="min-w-0">
                            <div className="truncate">{name || shortenAddress(r.objectAvatar)}</div>
                            {name && (
                              <div className="font-mono text-xs text-muted-foreground">
                                {shortenAddress(r.objectAvatar)}
                              </div>
                            )}
                          </div>
                          <Badge
                            variant={
                              r.relation === 'mutuallyTrusts'
                                ? 'default'
                                : r.relation === 'trusts'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {RELATION_LABEL[r.relation]}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                  {data.total > data.rows.length && (
                    <p className="text-xs text-muted-foreground">
                      Showing {data.rows.length} of {data.total} relations.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trust an address</CardTitle>
          <CardDescription>
            Encode{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              hubV2.trust(address, expiry)
            </code>{' '}
            with{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">@aboutcircles/sdk</code>{' '}
            and submit it through the host with{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">sendTransactions</code>.
            A max-uint96 expiry means trust never lapses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={trustee}
              onChange={(e) => setTrustee(e.target.value)}
              placeholder="0x… address to trust"
              spellCheck={false}
              autoComplete="off"
              disabled={!isConnected || busy}
            />
            <Button onClick={handleTrust} disabled={!canSubmit} className="sm:w-32">
              {busy ? 'Waiting…' : 'Trust'}
            </Button>
          </div>

          {!isConnected && (
            <p className="text-muted-foreground">
              Connect inside the Circles host to sign trust transactions.
            </p>
          )}
          {isConnected && trustee.length > 0 && !isAddress(trustee) && status.kind === 'idle' && (
            <p className="text-muted-foreground">Enter a full 0x-prefixed address (42 chars).</p>
          )}

          <TxResult status={status} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
