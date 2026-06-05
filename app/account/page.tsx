import { PageNav } from '@/components/layout/PageNav';
import { CreateAccountDemo } from '@/components/wallet/CreateAccountDemo';

export default function AccountPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          Prompt the host to create or connect a Circles account with{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            requestCreateAccount
          </code>
          .
        </p>
      </div>

      <CreateAccountDemo />

      <PageNav />
    </div>
  );
}
