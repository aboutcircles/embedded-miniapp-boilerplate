'use client';

import { useEffect, useState } from 'react';

import { TxResult, type TxStatus } from '@/components/circles/TxResult';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useWallet } from '@/components/wallet/WalletProvider';
import { fromAtto, getSdk, submitViaHost, toAtto } from '@/lib/circles';

const isAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value.trim());

type MaxFlow =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; atto: bigint }
  | { kind: 'error' };

export function SendDemo() {
  const { address, isConnected } = useWallet();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<TxStatus>({ kind: 'idle' });
  const [maxFlow, setMaxFlow] = useState<MaxFlow>({ kind: 'idle' });

  const toValid = isAddress(to);

  // Read: the most that can reach `to` routed through the trust network. This is the
  // max-flow problem the indexer solves server-side; it makes the transitive nature
  // of Circles transfers visible before the user commits.
  useEffect(() => {
    let cancelled = false;
    // Debounced; all state updates live inside the timeout callback so none run
    // synchronously in the effect body.
    const timer = setTimeout(() => {
      if (!address || !toValid) {
        setMaxFlow({ kind: 'idle' });
        return;
      }
      setMaxFlow({ kind: 'loading' });
      (async () => {
        try {
          const sdk = await getSdk();
          const atto = await sdk.rpc.pathfinder.findMaxFlow({
            from: address as `0x${string}`,
            to: to.trim() as `0x${string}`,
          });
          if (!cancelled) setMaxFlow({ kind: 'ready', atto });
        } catch {
          if (!cancelled) setMaxFlow({ kind: 'error' });
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, to, toValid]);

  const busy = status.kind === 'encoding' || status.kind === 'submitting';
  const canSubmit = isConnected && toValid && amount.trim() !== '' && !busy;

  async function handleSend() {
    if (!address) return;

    let atto: bigint;
    try {
      atto = toAtto(amount);
    } catch (err) {
      setStatus({ kind: 'error', error: err instanceof Error ? err.message : 'Invalid amount.' });
      return;
    }
    if (atto <= 0n) {
      setStatus({ kind: 'error', error: 'Amount must be greater than zero.' });
      return;
    }
    if (maxFlow.kind === 'ready' && atto > maxFlow.atto) {
      setStatus({
        kind: 'error',
        error: `Only ${fromAtto(maxFlow.atto)} CRC can reach this address through your trust network.`,
      });
      return;
    }

    setStatus({ kind: 'encoding' });
    try {
      const sdk = await getSdk();
      const { TransferBuilder } = await import('@aboutcircles/sdk-transfers');
      // Pathfinding + flow-matrix encoding, all without a signer: returns the ordered
      // `{ to, data, value }[]` (an operateFlowMatrix call, plus any unwrap steps).
      const builder = new TransferBuilder(sdk.circlesConfig);
      const txs = await builder.constructAdvancedTransfer(
        address as `0x${string}`,
        to.trim() as `0x${string}`,
        atto,
      );
      if (txs.length === 0) {
        throw new Error('No transfer path found through the trust network.');
      }
      setStatus({ kind: 'submitting' });
      const hashes = await submitViaHost(txs);
      setStatus({ kind: 'submitted', hashes });
      setAmount('');
    } catch (err) {
      setStatus({ kind: 'error', error: err instanceof Error ? err.message : 'Cancelled' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Circles</CardTitle>
        <CardDescription>
          Value routes through the trust graph. Max flow comes from{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            sdk.rpc.pathfinder.findMaxFlow
          </code>
          , the transfer is encoded by{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            TransferBuilder.constructAdvancedTransfer
          </code>
          , and the host signs and broadcasts it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Recipient</span>
          <Input
            aria-label="Recipient address"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x… recipient avatar"
            spellCheck={false}
            autoComplete="off"
            disabled={!isConnected || busy}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Amount (CRC)</span>
            {maxFlow.kind === 'ready' && maxFlow.atto > 0n && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => setAmount(fromAtto(maxFlow.atto))}
              >
                max {fromAtto(maxFlow.atto)}
              </button>
            )}
          </div>
          <Input
            aria-label="Amount in CRC"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            disabled={!isConnected || busy}
          />
        </div>

        {isConnected && toValid && (
          <p className="text-muted-foreground">
            {maxFlow.kind === 'loading' && 'Finding a path through the trust network…'}
            {maxFlow.kind === 'ready' &&
              (maxFlow.atto > 0n
                ? `Up to ${fromAtto(maxFlow.atto)} CRC can reach this address through your trust network.`
                : 'No path to this address yet — they need to trust a token you hold (directly or transitively).')}
            {maxFlow.kind === 'error' && 'Could not compute a path right now.'}
          </p>
        )}

        <Button onClick={handleSend} disabled={!canSubmit}>
          {busy ? 'Waiting for host…' : 'Send'}
        </Button>

        {!isConnected && (
          <p className="text-muted-foreground">
            Connect inside the Circles host to send Circles.
          </p>
        )}

        <TxResult status={status} />
      </CardContent>
    </Card>
  );
}
