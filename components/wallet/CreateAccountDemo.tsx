'use client';

import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/components/wallet/WalletProvider';
import { shortenAddress } from '@/lib/utils';

type MiniappSdk = typeof import('@aboutcircles/miniapp-sdk');

type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'done'; authenticated: boolean; address: string }
  | { kind: 'error'; error: string };

export function CreateAccountDemo() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const sdkRef = useRef<MiniappSdk | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Pre-load the host bridge on mount and gate the button on `sdkReady`, so the
  // click handler calls requestCreateAccount straight from sdkRef.current — no
  // dynamic import awaited mid-click, keeping the call inside the user gesture
  // the host's passkey prompt requires.
  useEffect(() => {
    let active = true;
    import('@aboutcircles/miniapp-sdk').then((sdk) => {
      if (!active) return;
      sdkRef.current = sdk;
      setSdkReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreateAccount() {
    const sdk = sdkRef.current;
    if (!sdk) return; // button stays disabled until the pre-loaded SDK is ready
    setStatus({ kind: 'pending' });
    try {
      // Opens the host's passkey "create account / log in" popup and resolves
      // once the user has a Circles account (immediately if already connected).
      // Rejects if the user cancels. onWalletChange listeners also fire on success.
      const { authenticated, address } = await sdk.requestCreateAccount();
      setStatus({ kind: 'done', authenticated, address });
    } catch (err) {
      setStatus({
        kind: 'error',
        error: err instanceof Error ? err.message : 'Cancelled',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>
          Ask the host to open its passkey account-creation flow via{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            requestCreateAccount
          </code>
          . It resolves with{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {'{ authenticated, address }'}
          </code>{' '}
          once the user has a Circles account, or rejects if they cancel. This is the
          only sanctioned way for a miniapp to proactively prompt connection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Button
          onClick={handleCreateAccount}
          disabled={!isMiniappHost || !sdkReady || status.kind === 'pending'}
        >
          {status.kind === 'pending'
            ? 'Waiting for host…'
            : isConnected
              ? 'Create or switch account'
              : 'Create Circles account'}
        </Button>

        {!isMiniappHost && (
          <p className="text-muted-foreground">
            The host owns the account-creation UI, so this is disabled standalone. Open
            the miniapp inside the Circles host to try it.
          </p>
        )}

        {isMiniappHost && isConnected && status.kind === 'idle' && (
          <p className="text-muted-foreground">
            Already connected as{' '}
            <span className="font-mono">{shortenAddress(address!)}</span>.{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              requestCreateAccount()
            </code>{' '}
            resolves immediately for connected users.
          </p>
        )}

        {status.kind === 'done' && (
          <div className="flex items-center gap-2">
            <Badge variant={status.authenticated ? 'default' : 'secondary'}>
              {status.authenticated ? 'authenticated' : 'unauthenticated'}
            </Badge>
            <span className="font-mono break-all">{status.address}</span>
          </div>
        )}

        {status.kind === 'error' && (
          <p className="text-destructive">Account creation failed: {status.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
