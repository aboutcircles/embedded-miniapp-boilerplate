'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getSdk } from '@/lib/circles';
import { shortenAddress } from '@/lib/utils';

// `searchProfiles` returns SearchResultProfile[] — unlike searchByAddressOrName it
// includes the avatar `address`, which is what makes each result selectable.
type SearchRow = {
  address: string;
  name: string;
  previewImageUrl?: string;
  imageUrl?: string;
  avatarType?: string;
};

const TYPE_LABEL: Record<string, string> = {
  CrcV2_RegisterHuman: 'Human',
  CrcV2_RegisterGroup: 'Group',
  CrcV2_RegisterOrganization: 'Organisation',
  CrcV1_Signup: 'Human (v1)',
  CrcV1_OrganizationSignup: 'Organisation (v1)',
};

export function ProfileSearch({ onSelect }: { onSelect: (address: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    // Debounced; all state updates live inside the timeout callback so none run
    // synchronously in the effect body.
    const timer = setTimeout(() => {
      if (q.length < 2) {
        setResults(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      (async () => {
        try {
          const sdk = await getSdk();
          // Full-text over names/descriptions, or address-prefix when q looks like one.
          const res = await sdk.rpc.profile.searchProfiles(q, 8);
          if (!cancelled) setResults(res as SearchRow[]);
        } catch {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <Input
        aria-label="Search avatars by name or address"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search avatars by name or address…"
        spellCheck={false}
        autoComplete="off"
      />

      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}

      {results && results.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">No avatars matched “{query.trim()}”.</p>
      )}

      {results && results.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {results.map((r) => {
            const img = r.previewImageUrl ?? r.imageUrl;
            const initials = (r.name || '??').slice(0, 2).toUpperCase();
            return (
              <li key={r.address}>
                <button
                  type="button"
                  onClick={() => onSelect(r.address)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-accent/50 focus-visible:bg-accent/50"
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={r.name} className="size-8 shrink-0 rounded-full border object-cover" />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-medium text-muted-foreground">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{r.name || 'Unnamed avatar'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{shortenAddress(r.address)}</div>
                  </div>
                  {r.avatarType && TYPE_LABEL[r.avatarType] && (
                    <Badge variant="secondary">{TYPE_LABEL[r.avatarType]}</Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
