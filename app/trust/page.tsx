import { PageNav } from '@/components/layout/PageNav';
import { TrustDemo } from '@/components/trust/TrustDemo';

export default function TrustPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trust</h1>
        <p className="text-sm text-muted-foreground">
          Trust is the social fabric Circles value flows through. Read the connected
          avatar&apos;s graph with{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">sdk.rpc.trust</code>,
          then extend it — the write encodes{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">hubV2.trust()</code>{' '}
          and submits through the host. This is the simplest end-to-end write: one
          encoded call, signed by the user&apos;s Safe.
        </p>
      </div>

      <TrustDemo />

      <PageNav />
    </div>
  );
}
