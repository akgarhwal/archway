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
