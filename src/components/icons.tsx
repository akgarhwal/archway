import type { ReactElement, SVGProps } from 'react';
import type { ServiceId } from '../types';

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const ICONS: Record<ServiceId, (p: P) => ReactElement> = {
  internet: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" {...stroke} />
      <path d="M4 12h16M12 4c2.5 2.8 2.5 13.2 0 16M12 4c-2.5 2.8-2.5 13.2 0 16" {...stroke} />
    </Svg>
  ),
  route53: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" {...stroke} />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" {...stroke} />
    </Svg>
  ),
  shield: (p) => (
    <Svg {...p}>
      <path d="M12 3l8 3v6c0 5-3.5 8.2-8 9.5C7.5 20.2 4 17 4 12V6l8-3z" {...stroke} />
      <path d="M9 12l2 2 4-4" {...stroke} />
    </Svg>
  ),
  waf: (p) => (
    <Svg {...p}>
      <path d="M4 8h16v10H4z" {...stroke} />
      <path d="M8 8V6a4 4 0 018 0v2" {...stroke} />
      <path d="M9 13h6" {...stroke} />
    </Svg>
  ),
  cloudfront: (p) => (
    <Svg {...p}>
      <path d="M7 17h10a4 4 0 00.4-8 5.5 5.5 0 00-10.5 1.5A3.5 3.5 0 007 17z" {...stroke} />
      <path d="M9 13h6M10 15h4" {...stroke} />
    </Svg>
  ),
  apigateway: (p) => (
    <Svg {...p}>
      <path d="M4 12h6M14 12h6" {...stroke} />
      <rect x="9" y="8" width="6" height="8" rx="1" {...stroke} />
      <path d="M4 9v6M20 9v6" {...stroke} />
    </Svg>
  ),
  alb: (p) => (
    <Svg {...p}>
      <path d="M12 4v4M12 8L6 14M12 8l6 6M6 14v4M18 14v4M12 8l0 0" {...stroke} />
      <circle cx="12" cy="6" r="2" {...stroke} />
      <circle cx="6" cy="20" r="1.6" {...stroke} />
      <circle cx="18" cy="20" r="1.6" {...stroke} />
    </Svg>
  ),
  ec2: (p) => (
    <Svg {...p}>
      <rect x="5" y="5" width="14" height="14" rx="2" {...stroke} />
      <path d="M8 9h8M8 12h8M8 15h5" {...stroke} />
    </Svg>
  ),
  lambda: (p) => (
    <Svg {...p}>
      <path d="M5 19l5-14h2l5 14" {...stroke} />
      <path d="M8.5 12h7" {...stroke} />
    </Svg>
  ),
  cache: (p) => (
    <Svg {...p}>
      <rect x="4" y="6" width="16" height="4" rx="1" {...stroke} />
      <rect x="4" y="12" width="16" height="6" rx="1" {...stroke} />
      <path d="M8 15h2" {...stroke} />
    </Svg>
  ),
  rds: (p) => (
    <Svg {...p}>
      <ellipse cx="12" cy="7" rx="7" ry="3" {...stroke} />
      <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" {...stroke} />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" {...stroke} />
    </Svg>
  ),
  dynamodb: (p) => (
    <Svg {...p}>
      <path d="M6 6h12v12H6z" {...stroke} />
      <path d="M6 10h12M10 6v12" {...stroke} />
    </Svg>
  ),
  s3: (p) => (
    <Svg {...p}>
      <path d="M5 9l7-4 7 4-7 4-7-4z" {...stroke} />
      <path d="M5 9v6l7 4 7-4V9" {...stroke} />
      <path d="M12 13v6" {...stroke} />
    </Svg>
  ),
  sqs: (p) => (
    <Svg {...p}>
      <rect x="3" y="7" width="6" height="10" rx="1" {...stroke} />
      <rect x="9.5" y="7" width="5" height="10" rx="1" {...stroke} />
      <rect x="15" y="7" width="6" height="10" rx="1" {...stroke} />
    </Svg>
  ),
  cloudwatch: (p) => (
    <Svg {...p}>
      <path d="M4 16l4-5 3 3 4-6 5 8" {...stroke} />
      <path d="M4 19h16" {...stroke} />
    </Svg>
  ),
};

export function ServiceIcon({ id, className }: { id: ServiceId; className?: string }) {
  const C = ICONS[id];
  return <C className={className} />;
}
