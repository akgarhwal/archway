export type Quote = {
  text: string;
  author: string;
  note?: string;
};

/** Rotates once per hour (UTC), stable across refresh. */
export const QUOTES: Quote[] = [
  {
    text: 'A distributed system is one in which the failure of a computer you didn’t even know existed can render your own computer unusable.',
    author: 'Leslie Lamport',
  },
  {
    text: 'Everything fails, all the time.',
    author: 'Werner Vogels',
    note: 'Amazon CTO',
  },
  {
    text: 'You build it, you run it.',
    author: 'Werner Vogels',
  },
  {
    text: 'The network is reliable. Latency is zero. Bandwidth is infinite. The network is secure. Topology doesn’t change. There is one administrator. Transport cost is zero. The network is homogeneous.',
    author: 'Peter Deutsch',
    note: 'Eight fallacies of distributed computing — all false',
  },
  {
    text: 'You can have at most two of consistency, availability, and partition tolerance.',
    author: 'Eric Brewer',
    note: 'CAP theorem',
  },
  {
    text: 'There are only two hard things in Computer Science: cache invalidation and naming things.',
    author: 'Phil Karlton',
  },
  {
    text: '100% is the wrong reliability target for basically everything.',
    author: 'Betsy Beyer, Chris Jones, Jennifer Petoff & Niall Richard Murphy',
    note: 'Site Reliability Engineering (Google)',
  },
  {
    text: 'Hope is not a strategy.',
    author: 'Google SRE',
  },
  {
    text: 'If you can’t distinguish a failure from a slow response, you have to treat them the same.',
    author: 'Pat Helland',
  },
  {
    text: 'Memories, guesses, and apologies — that is how independent systems cooperate.',
    author: 'Pat Helland',
    note: 'Life beyond distributed transactions',
  },
  {
    text: 'You have to design for failure, and nothing will fail.',
    author: 'James Hamilton',
    note: 'Amazon VP / Distinguished Engineer',
  },
  {
    text: 'If you can keep it in one place, don’t distribute it.',
    author: 'Martin Kleppmann',
    note: 'Designing Data-Intensive Applications',
  },
  {
    text: 'Your availability is the product of the availability of every component on the critical path.',
    author: 'Coda Hale',
  },
  {
    text: 'The tail at scale: rare events become common when you fan out to enough machines.',
    author: 'Jeff Dean & Luiz André Barroso',
  },
  {
    text: 'If there is a partition, you choose availability or consistency. Else you choose latency or consistency.',
    author: 'Daniel Abadi',
    note: 'PACELC',
  },
  {
    text: 'One size fits all is an idea whose time has come and gone.',
    author: 'Michael Stonebraker',
  },
  {
    text: 'Do the simplest thing that could possibly work — then stop before you distribute it.',
    author: 'Butler Lampson',
    note: 'Hints for Computer System Design',
  },
  {
    text: 'Timeouts are not knowledge. They are a bet about the future.',
    author: 'Pat Helland',
  },
  {
    text: 'Observability is being able to ask new questions of your system without shipping new code.',
    author: 'Charity Majors',
  },
  {
    text: 'Caches are a performance optimization until they become a consistency problem.',
    author: 'Martin Kleppmann',
  },
  {
    text: 'Eventual consistency is not an excuse. It is a contract about when the truth arrives.',
    author: 'Werner Vogels',
  },
  {
    text: 'A distributed transaction is not a feature. It is a last resort.',
    author: 'Pat Helland',
  },
  {
    text: 'The first principle of successful scalability is to batter the data into a shape that can be handled by as many machines as possible independently.',
    author: 'James Hamilton',
  },
  {
    text: 'Premature distribution is the root of a great deal of evil.',
    author: 'after Knuth',
    note: 'Distribute only when one box is honestly not enough',
  },
];

export function quoteForHour(now = Date.now()): Quote {
  const hour = Math.floor(now / 3_600_000);
  const i = ((hour % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[i];
}

export type EndKind = 'win' | 'bankrupt' | 'sla' | 'nopath' | 'loss';

const WIN_KICKS = [
  'That path held. The next one will not grade on a curve.',
  'Cleared. Production is the same packets with worse manners.',
  'You felt it. Run the next one before the feeling fades.',
  'Good. Now do it when you cannot pause.',
  'Architecture held. The catalog still has a trap with your name on it.',
];

const BANKRUPT_KICKS = [
  'Ten EC2s is still the trap. Draw less. Survive more.',
  'The fortress was pretty. The lull invoiced it anyway.',
  'Idle boxes do not care that you meant to right-size later.',
  'You bought the catalog. The bill bought you.',
  'Bankrupt is just opex with better copy. Retry smaller.',
];

const SLA_KICKS = [
  'Users left. They do not wait for the diagram to finish.',
  'Refunds are not a growth strategy. Headroom is.',
  'Past 80% utilization, latency is not linear. You found the cliff.',
  'Failed customers are an invoice. Protect the happy path, then decorate.',
  'The SLA did not collapse. You dropped it. Run it again with two targets.',
];

const NOPATH_KICKS = [
  'A path that does not exist is not an architecture. Wire something.',
  'Packets only travel edges you draw. Draw one.',
  'The Internet node is not a product. Connect it to compute.',
];

const LOSS_KICKS = [
  'The packets did not care about your feelings. Same grant. New diagram.',
  'Incident review is free. The next run is the apology.',
  'Hope is not a strategy. Retry is.',
];

export function classifyEnd(won: boolean, loseReason: string | null): EndKind {
  if (won) return 'win';
  const r = loseReason ?? '';
  if (r.includes('Bankrupt')) return 'bankrupt';
  if (r.includes('SLA')) return 'sla';
  if (r.includes('path that does not exist') || r.includes('Nothing useful')) return 'nopath';
  return 'loss';
}

function mixIndex(seed: number, simTime: number, salt: number, n: number): number {
  const x = Math.abs(Math.floor(seed + simTime * 13 + salt * 997));
  return n ? x % n : 0;
}

/** Stable for a run (seed + sim time). Random across runs. */
export function quoteForEnd(
  won: boolean,
  loseReason: string | null,
  seed: number,
  simTime: number,
): { quote: Quote; kick: string; kind: EndKind } {
  const kind = classifyEnd(won, loseReason);
  const kicks =
    kind === 'win'
      ? WIN_KICKS
      : kind === 'bankrupt'
        ? BANKRUPT_KICKS
        : kind === 'sla'
          ? SLA_KICKS
          : kind === 'nopath'
            ? NOPATH_KICKS
            : LOSS_KICKS;
  const quote = QUOTES[mixIndex(seed, simTime, 1, QUOTES.length)];
  const kick = kicks[mixIndex(seed, simTime, 7, kicks.length)];
  return { quote, kick, kind };
}
