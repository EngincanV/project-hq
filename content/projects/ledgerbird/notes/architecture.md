# Architecture

- Next.js app on Vercel, Postgres (managed), Stripe for billing
- PDFs rendered on the server from the same React components as the preview

```ts
// one invoice = one immutable snapshot once it is sent
type Invoice = {
  id: string;
  number: string;          // "2026-0042"
  status: 'draft' | 'sent' | 'paid' | 'void';
  lines: { description: string; qty: number; unitPrice: number }[];
};
```

## Decisions
1. Invoice numbers are per user and never reused, even for void invoices.
2. Amounts are stored in cents as integers.
