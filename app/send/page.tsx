import { PageNav } from '@/components/layout/PageNav';
import { SendDemo } from '@/components/send/SendDemo';

export default function SendPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Send</h1>
        <p className="text-sm text-muted-foreground">
          Circles transfers are <em>transitive</em>: you rarely hold the recipient&apos;s
          token, so value is routed across the trust graph via pathfinding. The amount,
          the path, and the encoded{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">operateFlowMatrix</code>{' '}
          call are all computed client-side with no keys; only the final submission goes
          through the host&apos;s Safe.
        </p>
      </div>

      <SendDemo />

      <PageNav />
    </div>
  );
}
