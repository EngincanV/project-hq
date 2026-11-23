// A local icon for a link, chosen from its host. No remote favicons (CSP + privacy).
import {
  Apple,
  ChartLine,
  Cloud,
  CreditCard,
  Flame,
  FolderGit2,
  Globe,
  Megaphone,
  Play,
  Search,
  Smartphone,
  Triangle,
  type LucideIcon,
} from 'lucide-react';
import { urlHost } from './url';

const RULES: [test: (host: string, url: string) => boolean, icon: LucideIcon][] = [
  [(h) => h === 'play.google.com', Play],
  [(h) => h.endsWith('apple.com'), Apple],
  [(h) => h === 'admob.google.com', Megaphone],
  [(h) => h.includes('firebase'), Flame],
  [(h) => h === 'analytics.google.com', ChartLine],
  [(h) => h === 'search.google.com', Search],
  [(h) => h === 'expo.dev' || h.endsWith('.expo.dev'), Smartphone],
  [(h) => ['github.com', 'gitlab.com', 'bitbucket.org'].some((d) => h === d || h.endsWith(`.${d}`)), FolderGit2],
  [(h) => h === 'vercel.com' || h.endsWith('.vercel.app'), Triangle],
  [(h) => h.endsWith('cloudflare.com'), Cloud],
  [(h) => h.endsWith('stripe.com'), CreditCard],
];

/** The lucide icon for a URL; a globe when nothing matches. */
export function linkIcon(url: unknown): LucideIcon {
  const host = urlHost(url);
  return RULES.find(([test]) => test(host, String(url)))?.[1] ?? Globe;
}
