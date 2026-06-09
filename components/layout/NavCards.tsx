import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Item = {
  href: string;
  title: string;
  description: string;
};

const ITEMS: Item[] = [
  {
    href: '/account',
    title: 'Account',
    description: 'Prompt the host to create or connect a Circles account via requestCreateAccount().',
  },
  {
    href: '/profile',
    title: 'Profile',
    description: 'Search the directory and inspect any avatar — name, balances, trust stats.',
  },
  {
    href: '/trust',
    title: 'Trust',
    description: 'Read the trust graph and trust an address — the simplest end-to-end write.',
  },
  {
    href: '/send',
    title: 'Send',
    description: 'Send Circles routed across the trust network via pathfinding.',
  },
  {
    href: '/activity',
    title: 'Activity',
    description: 'An enriched transfer + mint history feed with cursor pagination.',
  },
];

export function NavCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {item.title}
                <span aria-hidden className="text-muted-foreground">→</span>
              </CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground font-mono">
              {item.href}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
