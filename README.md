# Archway

**Defend the Origin.** A browser game for learning **high-level system design**. You wire an AWS-shaped path, serve live traffic, and watch the bill.

Legitimate requests earn. Idle infrastructure burns. Attacks and DDoS that reach origin cost money. There is no backend.

## Play locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

## Modes

| Mode | What it is |
|---|---|
| **How a request works** | Animated packet path. The lesson before you build. |
| **Missions** | Eight problems, one idea each (first packet → Black Friday). |
| **Sandbox** | Lab. Pause, break things, no game over. |
| **Production** | Staging, then **Go live**. You cannot pause. Traffic breathes. Only a real architecture stays solvent. |

Every mode starts with **$7,200** — exactly ten EC2s, which is the trap.

## What you are learning

```
Users → Route 53 → Shield → WAF → CloudFront
          ├─ HIT  → done
          └─ MISS → ALB → EC2 / Lambda
                        ├─ ElastiCache HIT → done
                        ├─ miss → RDS / DynamoDB
                        ├─ static/upload → S3
                        └─ SQS → worker → RDS
CloudWatch watches. It is not a hop.
```

A cache hit never touches RDS. A WAF drop never becomes a breach. A DDoS that lands on Lambda is a bill you wrote yourself. SQS needs a **worker** (EC2/Lambda). RDS cannot poll a queue.

## Controls

| Input | Action |
|---|---|
| Drag catalog → canvas | Place a service |
| Drag a handle | Wire the request path |
| Click **×** on a wire | Disconnect |
| Double-click a wire | Disconnect |
| Space | Pause / resume (not in live Production) |
| 1 / 2 / 4 | Sim speed |
| Delete / Backspace | Sell selected node (50% refund) |
| Esc | Cancel placement / deselect |

## Stack

Vite · React · TypeScript · React Flow · Zustand. Saves are `localStorage` only.

## Deploy (GitHub Pages)

Push to `main`. GitHub Actions builds and publishes Pages.

1. Repo **Settings → Pages → Source**: GitHub Actions.
2. Merge to `main` (or run the **Deploy GitHub Pages** workflow).
3. Site URL: `https://akgarhwal.github.io/archway/`

Local production build:

```bash
npm run build
npm run preview
```

## Spec

Product requirements: [`REQUIREMENTS.md`](./REQUIREMENTS.md).
