# Defend the Origin — Product Requirements

**Working title:** Defend the Origin  
**Console brand:** Archway  
**Type:** Single-player, frontend-only educational game  
**Domain:** High-level system design (HLD) on an AWS-like cloud  
**Version:** 1.0  
**Status:** Approved for implementation  
**Last updated:** 2026-09-07

---

## 1. Problem

System design is usually taught as static diagrams. Learners memorize “add a cache” and “put a WAF in front” without ever feeling *why*. Real production systems have a live request path, a bill, an SLA, and attackers. The gap is experiential:

- Successful legitimate requests should **make money**.
- Capacity, latency, and idle infrastructure should **cost money**.
- Malicious and DDoS traffic that reaches origin should **hurt** (compute burn, SLA, possible data damage).
- The same request should look completely different if it hits CloudFront vs. a naked EC2 box.

Archway is a **production-grade system you can play**: a continuous traffic simulator with an AWS-shaped component catalog, a live bill, and random bad traffic — all in the browser, no backend.

---

## 2. Research summary (what already exists, and the gap)

Researched 2026-09-07. Sources are listed so design choices are traceable.

### 2.1 Educational architecture games & sims

| Product | What it does well | Gap vs. this product |
|---|---|---|
| [Sr. Architect / system-design-simulator](https://github.com/000Sushant/system-design-simulator) | 74 AWS services, live cost engine, bottleneck sim, challenge scoring | Heavy sketchbook; not a tycoon loop of “serve = earn, attack = burn” |
| [Breakscale](https://github.com/xevrion/breakscale) | Honest discrete-event sim (p99, queues, retry storms) | Engineer’s lab, not a game economy or AWS console feel |
| [System Design Simulator](https://www.systemdesignsimulator.in/) | Drag-drop CDN/LB/cache/queue/DB, trace + Monte Carlo | No money loop, no DDoS-as-gameplay, limited pedagogy framing |
| [SystemForge](https://github.com/vijaygupta18/system-design-simulator) | Interview scoring, benchmarked QPS | Traffic is a slider, not a living business |
| [Server Survival](https://github.com/gen0sec/security-survival) | Closest analog: earn on legit traffic, WAF/ALB/SQS/compute/cache/DB/S3, DDoS, budget | 3D toy; weak HLD teaching, rigid flow, not AWS-console UX |
| [Server Farm Tycoon](https://grazulex.itch.io/server-farm-tycoon) | Garage→hyperscaler economy, random DDoS/outages | Physical datacenter, not application architecture |
| AWS Card Clash / BuilderCards / Cloud Quest | Official AWS pedagogy, Well-Architected language | Cards/quests, not a live request pipeline you operate |

### 2.2 How a real AWS web request actually travels

Canonical path from AWS reference architectures and the [Web Application Hosting on AWS](https://docs.aws.amazon.com/whitepapers/latest/web-application-hosting-best-practices/key-components-of-an-aws-web-hosting-architecture.html) whitepaper:

```
User
  → Amazon Route 53          (DNS, health checks, failover)
  → AWS Shield               (L3/L4 volumetric DDoS)
  → AWS WAF                  (L7: SQLi, XSS, bots, rate limits)
  → Amazon CloudFront        (CDN edge cache, origin shield)
       ├─ cache HIT  → return
       └─ cache MISS
  → Amazon S3                (static / uploads)
     or
  → ALB / API Gateway        (routing, TLS, throttle)
  → EC2 / ECS / Lambda       (compute)
       ├─ ElastiCache HIT  → return
       ├─ ElastiCache MISS → RDS / DynamoDB
       └─ async writes     → SQS → workers → DB / S3
  → CloudWatch               (metrics, alarms — not on the data path)
```

Perimeter guidance ([AWS SRA — perimeter security](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/perimeter-security.html)): WAF belongs **on CloudFront**, so attacks die at the edge instead of the VPC. Shield Standard is on by default for CloudFront / Route 53 / ALB; Shield Advanced is the paid absorb layer.

This path **is the game**.

### 2.3 Teaching points that must be felt, not told

From Grokking / system-design-primer, Well-Architected, and CDN/DDoS literature:

1. **Edge before origin.** A CDN cache hit never touches EC2 or RDS. Hit ratio is the most important number after availability.
2. **WAF is not a load balancer.** It inspects and *drops*. Without it, SQLi/XSS that reach the database are a data-breach cost.
3. **DDoS is a bill attack as much as an availability attack.** Unfiltered flood scales your compute and you pay for the privilege.
4. **Caches have misses.** A cache stampede (invalidation + spike) sends everyone to the database.
5. **Queues absorb writes.** Synchronous write spikes melt the DB; SQS turns a 201 into “accepted, processed soon.”
6. **Load balancers need something to balance.** One EC2 behind an ALB is a single point of failure with extra latency.
7. **Databases must not be public.** Internet → RDS is legal in the sandbox and catastrophic in the sim.
8. **Observability is a component.** Without CloudWatch you see coarse numbers; with it you get early saturation warnings.
9. **Well-Architected is a score, not a poster.** Six pillars, computed from the live topology + traffic, not a quiz.
10. **Cost is an architecture decision.** Over-provisioning survives DDoS and goes bankrupt on a quiet Tuesday.

---

## 3. Goals and non-goals

### Goals (v1)

- A **beautiful, AWS-console-inspired** single-page app that is fully playable in the browser.
- **No backend.** All simulation, persistence, and scoring run client-side. `localStorage` for saves.
- Continuous request stream with mixed **good / bad / DDoS** traffic and random events.
- Player **places and wires** real AWS-named components; packets visibly travel the graph.
- Economy: start with a grant; **legit served requests earn**; **infra burns**; **bad traffic that reaches origin costs**.
- Missions that teach HLD in order, plus a sandbox / endless mode.
- An in-game **Architect Coach** that explains *why* something just happened, in Well-Architected language.

### Non-goals (v1)

- Multiplayer, accounts, leaderboards-as-a-service, or any API.
- 70+ AWS services, real AWS Price List accuracy, or region maps.
- Packet-level discrete-event fidelity (Breakscale’s job). This is a **didactic tick engine** that is honest about queues, hits, drops, and bills, not a queueing-theory lab.
- Low-level networking (BGP, RSTP, cabling, power, thermodynamics).
- Exact reproduction of the AWS Management Console (trademark/look-alike). Inspired, not cloned.

---

## 4. Personas

1. **Junior engineer prepping HLD interviews** — needs to *see* CDN vs origin, cache aside, queue buffering.
2. **Self-taught developer who has never paid an AWS bill** — needs the money loop.
3. **Student in a distributed-systems class** — needs missions with a debrief, not a toy.

Session length: 8–25 minutes per mission; sandbox is open-ended.

---

## 5. Product narrative

You are the first architect at a startup on **Archway**, a lab that maps 1:1 onto AWS services. The company gave you a seed budget. Users are already hitting the Internet gateway. Every successful response is revenue. Every idle box is rent. Attackers are on the same wire as customers.

Win by designing a system that stays fast, cheap, and boring under chaos.

---

## 6. Core game loop

```
spawn traffic  →  route through the player’s graph  →  each hop inspects / caches / queues / computes
       ↑                                                        ↓
  random events                                      success / block / drop / breach
       ↑                                                        ↓
  spend on components  ←  money, SLA, coach, Well-Architected score  ←  bill & metrics
```

1. Player starts with money, an **Internet** node, and an empty VPC canvas.
2. Player buys components from a catalog (capex) and pays upkeep (opex).
3. Requests spawn continuously from the Internet with a shifting mix.
4. Requests follow **wired edges**, with type-aware next-hop choice when a node has multiple outlets.
5. Outcomes settle the ledger and SLA.
6. Random events (DDoS, flash sale, cache stampede, noisy neighbor) force redesign.
7. Missions complete when objectives + SLA hold; endless mode ends on bankruptcy or SLA collapse.

---

## 7. Simulation model

### 7.1 Request kinds

| Kind | Color | Typical destination | Earns if | Costs if it reaches origin unprotected |
|---|---|---|---|---|
| `static` | Sky | CloudFront / S3 | Cache hit or S3 200 | Extra origin compute |
| `read` | Green | Cache → DB | 200 from cache or DB | Slow DB under load |
| `write` | Amber | Queue or DB | 201/200 | DB saturation |
| `upload` | Violet | S3 | S3 200 | Compute proxying binaries |
| `search` | Cyan | Compute → DB | 200 | CPU-heavy, melts small instances |
| `malicious` | Rose | Should die at WAF | **Blocked at WAF** (small bounty) | **Breach tax** if it hits compute/DB |
| `ddos` | Red | Should die at Shield / WAF / CloudFront | Absorbed at edge | **Bandwidth + compute burn** at origin |

Baseline mix (sandbox start): static 38%, read 28%, write 12%, upload 8%, search 6%, malicious 6%, ddos 2%. Missions and events override this.

### 7.2 Node behaviour (v1 catalog)

Each component has: **capex**, **opex / min**, **RPS capacity**, **base latency**, **role**.

| ID | AWS name | Role | What it does to a packet |
|---|---|---|---|
| `internet` | Users / Internet | Source | Spawns traffic. Not purchasable. |
| `route53` | Amazon Route 53 | DNS | Tiny latency, enables health-based skip of `down` nodes. |
| `shield` | AWS Shield | L3/L4 DDoS | Absorbs most `ddos`. Weak vs `malicious` (application layer). |
| `waf` | AWS WAF | L7 firewall | Blocks most `malicious`, rate-limits `ddos`. Inspect cost on every request. |
| `cloudfront` | Amazon CloudFront | CDN | High chance to terminate `static` (and a small slice of `read`) at the edge. Absorbs a fraction of `ddos`. Origin pull on miss. |
| `apigateway` | Amazon API Gateway | Front door | Throttle, route API traffic, small auth latency. Not for heavy static. |
| `alb` | Elastic Load Balancing (ALB) | L7 LB | Splits evenly across healthy compute targets. Does **not** block attacks. |
| `ec2` | Amazon EC2 | Compute | General origin. Saturates. Upgradeable size. |
| `lambda` | AWS Lambda | Serverless compute | Scales with concurrency; expensive under DDoS (this is the lesson). |
| `cache` | Amazon ElastiCache | L2 cache | `read` hit/miss. Misses must reach a DB. Stampede event slams hit ratio. |
| `rds` | Amazon RDS | SQL | Source of truth for read/write/search. Low RPS, high opex, disaster if public. |
| `dynamodb` | Amazon DynamoDB | NoSQL | Higher RPS than RDS, higher per-request cost, still needs a cache for hot keys. |
| `s3` | Amazon S3 | Object store | Terminates `static` / `upload`. Cheap, high RPS, not a database. |
| `sqs` | Amazon SQS | Queue | Accepts `write`/`upload` quickly (202). Workers (EC2/Lambda) drain. Overflow drops. |
| `cloudwatch` | Amazon CloudWatch | Observability | Not on the data path. Unlocks early saturation warnings, X-Ray style traces, better coach. |

**Upgrade path:** EC2 and RDS have sizes T1 → T2 → T3 (capacity ×2, opex ×1.8, capex to upgrade). Lambda concurrency is a slider.

### 7.3 Routing rules

Packets only travel **existing edges**. When multiple outgoing edges exist, the engine scores next hops by (role × request kind) and picks the best *connected* candidate. If nothing suitable is connected, the request **fails with a specific reason** (this is the teaching moment).

Illegal-but-allowed topologies (with coach + penalty):

- Internet → RDS / DynamoDB / ElastiCache (data store on the public internet).
- S3 as an API for `write` of relational data.
- ALB with zero healthy targets.
- SQS with no consumer.

Preferred edge order from the Internet: `route53 → shield → waf → cloudfront → apigateway → alb → compute`. Skipping layers is allowed and is how early missions start.

### 7.4 Capacity, latency, drops

Per node, each tick:

```
utilization = processedThisWindow / rpsCapacity
latency     = baseLatency * (1 + 2.5 * max(0, utilization - 0.70))
dropProb    = clamp(utilization - 1.0, 0, 0.95)
```

Sustained utilization > 1.15 for several seconds marks the node **saturated** (red). SLA is the rolling 60s success rate of *legitimate* requests. Timeouts count as failures.

Visual layer draws at most ~100 in-flight packets; the ledger uses the full logical RPS.

### 7.5 Time

- Sim tick: 100 ms.
- Speeds: pause, 1×, 2×, 4×.
- Wall-clock and sim-clock both displayed.

---

## 8. Economy

| Item | v1 value (tunable constants) |
|---|---|
| Starting grant | **$7,200** (all modes — ten EC2s, the trap) |
| `static` served | +$0.10 |
| `read` served | +$0.18 |
| `write` served | +$0.42 |
| `upload` served | +$0.48 |
| `search` served | +$0.24 |
| Attack blocked at edge (WAF/Shield/CloudFront) | +$0.04 bounty |
| Legit request failed / timed out | −$0.55 SLA credit |
| `malicious` reached compute | −$2.40 breach tax |
| `malicious` reached DB | −$8.00 breach tax |
| `ddos` reached origin (compute/ALB/DB) | −$0.22 burn each |
| Sell-back | 50% of capex |
| Bankruptcy | Money < $0 for 8 consecutive seconds |
| SLA collapse | Rolling SLA < 35% |

Capex / opex are listed in the catalog implementation (`src/data/catalog.ts`) and must stay internally consistent: a correct small architecture is **slightly profitable** at baseline mix; a naked EC2 is profitable until the first DDoS; an over-provisioned fortress bleeds on a quiet night.

---

## 9. Random events

Spawn on a 25–50 s jitter (faster in later missions).

| Event | Effect | What it teaches |
|---|---|---|
| **DDoS wave** | 12–20 s, mix shifts to ~55% `ddos` + 15% `malicious`, RPS ×3 | Shield + WAF + CloudFront at the edge, not more EC2 |
| **Flash sale** | 15 s, `write` ×4, RPS ×2 | SQS + autoscale, not a bigger RDS |
| **Cache stampede** | 10 s, cache hit ratio → 8% | Stampede, TTL, request coalescing (explained by coach) |
| **Traffic spike** | 15 s, RPS ×2.5, mix unchanged | Headroom, ALB + second instance |
| **Noisy neighbor** | One EC2 degraded 40% capacity | Multi-AZ / more than one instance |
| **Poison packet** | Burst of `malicious` with WAF-bypass flavour (10% sneak) | Defense in depth, don’t skip WAF |

Active event is shown on a top ticker with countdown.

---

## 10. Missions (curriculum)

Played in order. Each has a briefing, live objectives, fail conditions, and a debrief that names the HLD idea.

| # | ID | Title | Player learns |
|---|---|---|---|
| 0 | `boot` | First Packet | Place EC2, wire Internet → EC2, serve a read. The request path exists. |
| 1 | `balance` | One Box Is Not an Architecture | Traffic grows. Add ALB + a second EC2. Single point of failure. |
| 2 | `bad-neighbors` | Bad Neighbors | Malicious mix rises. Place WAF *in front*. Blocking is revenue-protecting. |
| 3 | `flood` | The Flood | DDoS wave. Shield and/or CloudFront. Scaling origin to eat the flood is a trap. |
| 4 | `edge` | Edge First | Static-heavy mix. CloudFront + S3. Watch origin RPS collapse on hits. |
| 5 | `cache-is-king` | Cache Is King | Read-heavy. ElastiCache in front of RDS. Then a stampede event. |
| 6 | `async` | Don’t Block the Hot Path | Write spike. SQS between API and workers. 202 vs 500. |
| 7 | `production` | Black Friday | Combined architecture, all event types, 90 s hold, Well-Architected ≥ 70. |

**Sandbox** unlocks after mission 0. Endless survival: RPS grows on a curve; game over on bankruptcy or SLA collapse; debrief with tips.

---

## 11. Learning system (not a quiz overlay)

### 11.1 Architect Coach

Contextual, interruptive but dismissible, max one card at a time:

- First time a DB is public.
- First time DDoS hits EC2.
- First cache hit ratio shown.
- First queue overflow.
- First Lambda bill shock under DDoS.
- First time ALB has no targets.

Each card: **what just happened**, **why it matters**, **what seniors do**, **AWS service name**.

### 11.2 Request X-Ray

Click a packet or a sampled log line → hop list with per-hop latency and decision (`HIT`, `MISS`, `BLOCK`, `THROTTLE`, `ENQUEUE`, `DROP`). Unlocks richer samples when CloudWatch is placed.

### 11.3 Well-Architected score (0–100)

Computed live from topology + last 30 s of traffic, six equal pillars:

| Pillar | Signals |
|---|---|
| Operational excellence | CloudWatch present, coach alerts acknowledged, no silent drops |
| Security | WAF on path, DB not public, Shield or CloudFront for edge |
| Reliability | ≥2 compute behind ALB, queue for writes, no single-node origin |
| Performance | CDN for static, cache for reads, utilization < 80% |
| Cost | Profit positive, no oversized idle, Lambda not eating a DDoS |
| Sustainability | Cache/CDN origin-offload ratio (fewer origin cycles) |

Shown as a six-spoke radar in the inspector.

### 11.4 Catalog copy

Every service in the palette has a 2-line “what it is” and a 2-line “when you actually use it.” This is the textbook, in the place the player is looking.

---

## 12. UI / UX requirements

### 12.1 Visual identity

- Dark operations console. Not a pastel “learn to code” toy, not a 1:1 AWS clone.
- Background: deep ink `#070b10`. Surfaces: `#101820`. Hairline borders `#243044`.
- Accent: amber `#f5a524` (action) + cyan `#5ce1e6` (telemetry).
- Status: green healthy, amber warm, red saturated, rose attack.
- Type: **DM Sans** for UI, **JetBrains Mono** for money, RPS, traces.
- Service nodes use category color bars and simple geometric icons (S3 bucket, cylinder DB, hex compute) — readable at 120×72 px.

### 12.2 Layout

```
┌─ top bar: brand, mission, money, burn/s, SLA, RPS, event, pause/speed ─┐
│ left catalog (grouped) │     React Flow canvas + packets      │ inspector │
│                        │                                      │ coach     │
└─ bottom: request log (filterable by kind) + mission objectives ──────────┘
```

Title screen first: product name, one-sentence promise, **New mission**, **Sandbox**, **Continue**. Subtle packet animation in the background.

### 12.3 Canvas interaction

- Drag from catalog onto canvas (or click-to-place).
- Drag handle to wire. Cycle-safe.
- Click node → inspector (metrics, upgrade, delete, lesson).
- Delete / Backspace removes selection (50% refund).
- Space pause, `1` `2` `4` speed, `Esc` deselect.
- Minimap.
- Fit view on first place.

### 12.4 Feedback

- Packets are colored dots on edges; blocks dissolve in rose; hits flash cyan.
- Node utilization bar always visible.
- Money ticks with a tiny +/− float (sampled, not per-packet at high RPS).
- Event ticker is impossible to miss.
- Game-over / mission-complete is a full debrief, not an alert().

### 12.5 Accessibility & quality bar

- Keyboard for pause/speed/delete.
- Contrast ≥ WCAG AA for body text.
- Reduced-motion: hide packet dots, keep metrics.
- 1280×800 usable; 1440×900 comfortable. Catalog collapses on narrow widths.
- 60 fps with ≤100 visible packets on a typical laptop.

---

## 13. Technical requirements

| Item | Choice |
|---|---|
| Runtime | Static SPA, no server |
| Stack | Vite, React, TypeScript |
| Graph | `@xyflow/react` (React Flow) |
| State | Zustand + a pure `tick(state, dt)` engine |
| Persistence | `localStorage` key `buildsystem-save-v1` |
| Icons | Inline SVG, no icon CDN required at runtime |
| Fonts | Google Fonts (DM Sans, JetBrains Mono) |
| Tests | Optional engine unit tests; not a gate for v1 |

### 13.1 Architecture of the code

```
src/
  data/       catalog, missions, events, copy   (pure data)
  sim/        tick, routing, economy            (pure functions)
  store/      zustand store                     (thin)
  components/ UI
  App.tsx     shell
```

The simulator must be deterministic given a seeded RNG so missions can be replayed fairly. Visual packet IDs may be sampled non-deterministically.

### 13.2 Performance budget

- Tick work O(nodes + edges + visiblePackets).
- Logical RPS can go to ~400; visible packets capped.
- No backend round trips.

---

## 14. Information architecture (screens)

1. **Title** — continue / new / sandbox / how it works.
2. **Mission briefing** — story, objectives, recommended services, Start.
3. **Operations console** — the game.
4. **Debrief** — win/lose, charts, Well-Architected, next mission.
5. **How it works** — 60-second illustrated request path (also linked from title).

---

## 15. Analytics & privacy

None. No telemetry. Save data never leaves the machine.

---

## 16. Acceptance criteria (v1)

- [ ] `REQUIREMENTS.md` exists and matches the shipped game.
- [ ] `npm install && npm run dev` opens a playable title screen.
- [ ] Player can complete mission 0 without reading external docs.
- [ ] Packets visibly travel wired edges; colors match request kinds.
- [ ] Serving legit traffic increases money; WAF-less malicious-to-DB decreases it sharply.
- [ ] A DDoS event without edge protection spikes origin utilization and the bill.
- [ ] CloudFront static hits do not increment origin RPS.
- [ ] ElastiCache hits do not increment RDS RPS.
- [ ] SQS accepts writes above DB capacity without immediate 500s, until the queue overflows.
- [ ] Internet → RDS is allowed and triggers coach + breach risk.
- [ ] Pause / 1× / 2× / 4× work.
- [ ] Refresh restores the last save.
- [ ] Sandbox never game-overs on “mission fail”; bankruptcy/SLA still apply unless the player disables fail-out (sandbox flag: no game over, warning only).
- [ ] UI is coherent at 1280×800 and 1440×900.
- [ ] No network calls except font CSS.

---

## 17. v1 out of scope / later

- IAM, VPC subnets, security groups as placeable nodes (explained in copy only).
- Multi-region active-active, Route 53 latency policies as a full sim.
- Kafka / Kinesis vs SQS distinction beyond a catalog note.
- Real AWS pricing API.
- User accounts, cloud saves, PvP DDoS (Server Survival-style).
- Mobile-first layout (usable on iPad landscape is a stretch goal).

---

## 18. Open constants

Balance numbers in §8 and catalog opex are **initial**. They live in `src/data/catalog.ts` and `src/sim/economy.ts` so they can be tuned without UI rewrites. Tuning goal: a competent player finishes mission 7 on the first or second try; a “more EC2” player fails *The Flood* for the right reason.

---

## 19. Decision log

| Decision | Choice | Why |
|---|---|---|
| Backend | None | Requested; also keeps the sim honest and shareable as static files |
| Graph vs grid | Free-form graph (React Flow) | HLD is drawn as graphs; AWS architecture diagrams are graphs |
| AWS names vs fictional | Real AWS names on the Archway console | Transfer of learning to interviews and the real console |
| Fidelity | Didactic tick engine | Fun + correct qualitative behaviour beats a slow DES in v1 |
| Economy | Serve = earn, origin-attack = burn | The user-requested core loop; missing from most HLD sims |
| Curriculum | 8 missions + sandbox | Matches how people actually learn these patterns |
| Visual tone | Dark ops console | Feels like production, not a children’s cloud quiz |

---

## 20. References

1. Amazon Web Services, *Web Application Hosting in the AWS Cloud* — key components (Route 53, CloudFront, ELB, Auto Scaling, RDS, ElastiCache, S3, WAF).  
2. AWS Prescriptive Guidance, *Security Reference Architecture — Perimeter security* (CloudFront + WAF at the edge).  
3. AWS Well-Architected Framework — six pillars; Game Day concept.  
4. AWS WAF + Shield documentation — L7 vs L3/L4 split.  
5. donnemartin/system-design-primer — CDN, LB, cache, queue patterns.  
6. Breakscale, Sr. Architect, System Design Simulator, SystemForge — prior art in browser HLD sims.  
7. Server Survival / security-survival — prior art in “traffic tycoon + DDoS” gameplay.  
8. Cloudflare / CDN interview literature — edge DDoS absorption, cache hit ratio as a first-class KPI.
