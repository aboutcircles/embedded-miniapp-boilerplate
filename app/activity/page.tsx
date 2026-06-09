import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { PageNav } from '@/components/layout/PageNav';

export default function ActivityPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          A ready-to-render history feed. One enriched call returns transfers and mints
          already joined with the other party&apos;s profile, plus a cursor for{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Load more</code> —
          no client-side event decoding or N+1 profile lookups.
        </p>
      </div>

      <ActivityFeed />

      <PageNav />
    </div>
  );
}
