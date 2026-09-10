# INFINITE BOND — Product and Engineering Specification

Version 3.1.1 (final for hackathon build) · 2026-09-10
Target: Colosseum Crypto World's Fair, Solana track · Submission 2026-10-12
Status: This document supersedes `project-spec.md` appendices A–C. Where numbers differ, this document wins.

---

## 1. Summary

INFINITE BOND is a covenant market for newly launched Solana tokens. A launching team posts a bond in INF (Sanctum's multi-LST token) behind a set of on-chain covenants. Token holders can either buy protection against a covenant breach or back the team by depositing INF alongside the bond. Every 30 days the program checks the covenants directly against on-chain accounts and settles: on a pass, premiums and staking yield flow to the team and its backers; on a breach, the team's bond is consumed first to pay covered holders, and only then do backers absorb any shortfall. Six clean epochs produce an on-chain rating account that launchpads, wallets, and lenders can read.

Three properties make the market work:

- **The team is first-loss.** Backers sit senior to the team's bond, so backing is a yield position shielded by the team's own capital. Posting a junior bond is itself the signal.
- **Protection is tied to holding.** Coverage is capped by the buyer's token balance and pays only if the balance is still there at settlement. Selling voids the protection, which reduces early sell pressure for the team.
- **The bond earns while locked.** INF accrues Sanctum's staking yield (about 6.4% APY at the time of writing), so the bond is a productive asset rather than dead capital.

No oracle, indexer, or vote decides outcomes. Every covenant is checked inside the program by reading the relevant accounts.

---

## 2. Roles and incentives

| Role | What they do | What they get | What they risk |
|---|---|---|---|
| Team (issuer) | Passes the registration gate, selects covenants and parameters, posts an INF bond, optionally sponsors free coverage | Rating account, reduced early sell pressure, premiums (their share of 90%), INF staking yield on the bond, community capital via backers | Entire bond on any breach, including accrued premiums and yield |
| Backer (holder, pass side) | Deposits INF alongside the team bond, up to a cap | Pro-rata share of premiums and INF yield, senior to the team bond | Loses only the shortfall after the team bond is exhausted |
| Protection buyer (holder, default side) | Buys coverage priced by utilization, capped by token holdings; may claim sponsored coverage for free | On breach: full coverage plus a share of the team's remaining bond; payout ÷ premium runs from 7× to 200× depending on the rate at purchase (§3.9) | Premium paid; protection voids if tokens are sold |
| Cranker | Calls `resolve_epoch` and `open_epoch` after each epoch ends | Small fixed reward from protocol fees | None |
| Launchpad (partner) | Embeds the widget and passes a partner code at registration | Share of partner fee, a "bonded launch" badge for its listings | None |
| Rating consumer | Reads the `Launch` account or the rating API | A single risk number per launch | None |

Why each side shows up:

- Holders who are bullish back the team and earn a yield shielded by the team's bond. Holders who are cautious buy protection that is free for the first tranche and voids if they sell. Speculators who expect a breach buy protection and hold the token through settlement.
- Teams get a growth tool, not a compliance check: protected holders sell less, backers add capacity, the bond compounds, and the rating feeds launchpad tiers and listing due diligence. The direct cost of sponsoring free coverage is the protocol fee only, because 90% of the notional premium returns to the team's own bond.

---

## 3. Mechanism

### 3.1 Units

All amounts inside the program are INF token units. Coverage, premiums, bond, backing, and payouts are INF. The frontend converts to USD for display only (Sanctum price API, Jupiter as fallback) and shows the sentence "This protection is denominated in SOL value" on every purchase screen. Because INF accretes (its price in SOL rises; token count does not change), staking yield needs no special accounting.

### 3.2 Registration gate (no market, no rating weight)

A launch is accepted only if all of the following hold at `register_launch`:

- Mint authority is `None`.
- Freeze authority is `None`.
- Program upgrade authority is a declared multisig or timelock (or `None`).
- Token metadata is immutable.

These are table stakes that static scanners already check. They are a filter, not a covenant.

### 3.3 Covenants (market and rating weight)

Behavioral covenants, all verifiable by reading accounts passed to `resolve_epoch`. The team selects which to enable and sets the parameters; stricter parameters raise the covenant's rating weight.

| # | Covenant | Team gives up | Verification | Default parameter | Weight |
|---|---|---|---|---|---|
| 1 | Treasury outflow cap with recipient whitelist | Arbitrary withdrawals | `snapshot_balance − current_balance ≤ cap`; any outflow to a non-whitelisted account is a breach | 5% of treasury per epoch; whitelist ≤ 8 accounts | 2 (3 if cap ≤ 2%) |
| 2 | Team wallet sell cap, including post-unlock | Dumping unlocked tokens | Sum of decreases across declared team ATAs ≤ cap; transfers to the declared vesting program are exempt | 1% of circulating supply per epoch; ≤ 4 ATAs | 2 (3 if cap ≤ 0.5%) |
| 3 | LP depth floor | Pulling liquidity | LP token account balance ≥ floor × initial | 80% | 1 |
| 4 | Deployment milestone | Missing the roadmap | `ProgramData.last_modified_slot > registration_slot` by the milestone epoch | Epoch 2 (about day 60) | 2 |

Performance covenants (v2, require the indexer): monthly on-chain revenue ≥ X; X% of revenue used for buyback; runway ≥ N months; community allocation distributed by a deadline. Weight 3. Creator LST issuer covenants (commission cap, no delinquency, stake pool authority unchanged) also live here.

Any single failed covenant makes the epoch **Breached**. Partial-breach weighting is deferred to v2.

### 3.4 Bond, backing, and capacity

- The team posts `bond ≥ min_bond` (50 SOL worth of INF) into `bond_vault`.
- Backers deposit INF into `backing_vault` up to `backing_cap_bps × bond` (default 100%, i.e. backing ≤ bond).
- `capacity = bond_balance + backing_total`. Coverage sold in an epoch cannot exceed capacity.
- The team may reserve up to `sponsor_cap_bps × capacity` (default 20%) as sponsored coverage that holders claim for free.

### 3.5 Epochs

Six epochs of `epoch_slots` (30 days ≈ 6,480,000 slots; test runs use 1,500 slots ≈ 10 minutes).

```
register_launch   gate checks, bond in, covenants set, epoch 0 snapshot
epoch N open      backers deposit, holders buy or claim sponsored coverage
epoch N end       anyone calls resolve_epoch
   Passed         premiums credited pro-rata to bond and backing; open_epoch N+1
   Breached       waterfall below; market closes
after epoch 6     withdraw_bond, withdraw_backing
```

### 3.6 Pricing

```
u_bps    = coverage_sold × 10_000 / capacity                     (0..10_000)
r_bps    = r_min_bps + (r_max_bps − r_min_bps) × u_bps² / 10_000²
premium  = amount × r_bps / 10_000
fee      = premium × premium_fee_bps / 10_000                    (10%)
credit   = premium − fee, split bond : backing by balance
```

Defaults: `r_min_bps = 50` (0.5%/epoch), `r_max_bps = 1500` (15%/epoch). Integer math throughout; `u_bps²` in u128; division floors. Reference values: u = 0.3 → 180 bps; u = 0.8 → 978 bps. Utilization is read before the purchase (price locked at cart time); segment integration is v2.

Sponsored coverage: the holder pays nothing; the program computes the notional premium at the current `r`, transfers `fee` from `bond_vault` to `fee_vault`, and counts the coverage toward `coverage_sold`.

### 3.7 Holding-tied coverage

At registration the team declares `coverage_per_token` (INF units of coverage per token unit, set from the launch price). Then:

- `buy_coverage`: `amount ≤ holder_token_balance × coverage_per_token − existing_coverage`. The program records `covered_tokens = amount / coverage_per_token`.
- `claim`: requires `holder_token_balance ≥ covered_tokens`; otherwise `HoldingReduced` and no payout.

No price oracle is needed because the ratio is fixed at registration.

### 3.8 Settlement waterfall

**Passed.** No transfers. `passed_epochs += 1`; `rate_sum_bps += closing_rate_bps`; premiums already sit in the vaults. After epoch 6, `status = Completed`.

**Breached.**

```
P  = coverage_sold                          (owed to covered holders)
B  = bond_balance (team, incl. accrued premiums and yield)
K  = backing_total (backers, incl. accrued premiums)

from_bond     = min(P, B)
from_backing  = P − from_bond               (0 if bond covers it)
remainder     = B − from_bond               (team's leftover, if any)
slash_fee     = remainder × slash_fee_bps / 10_000     (10%)
bonus_pool    = remainder − slash_fee       (to covered holders pro-rata)
backing_loss  = from_backing                (pro-rata across backers)

payout_per_unit = (P + bonus_pool) × 1e6 / P
```

The team's bond is fully consumed on any breach: coverage first, then slash fee, then bonus to holders. Backers lose only `from_backing`. If `P = 0`, `bonus_pool` goes entirely to `fee_vault`.

### 3.9 Protection buyer economics (how the multiple is computed)

Coverage is a face amount, not a deposit. A protection buyer pays only the premium; the coverage amount is what they receive on a breach. The multiple is therefore payout divided by premium, and it is the insurance ratio, not a return on capital at risk.

Example from the epoch-2 breach in §4.2 (rate 3.44%, bonus pool 63.7 on 450 of coverage):

| Item | One holder with coverage 30 |
|---|---|
| Premium paid | 30 × 3.44% = 1.03 |
| Coverage principal received | 30.0 |
| Bonus share (63.7 × 30 / 450) | 4.2 |
| Total received | 34.2 |
| Payout ÷ premium | ≈ 33× |

Net profit depends on what happens to the token, because the buyer must still hold `covered_tokens` at claim time:

| Token outcome at breach | Net result |
|---|---|
| Token goes to zero | 34.2 − 1.03 − 30 = +3.2 |
| Token loses half | 34.2 − 1.03 − 15 = +18.2 |
| Token unchanged | 34.2 − 1.03 = +33.2 |

So for a holder who covers their full position, the product is a hedge that preserves principal and adds the bonus. Speculative multiples arise only from sponsored coverage (premium 0) or from covering a large position relative to what is actually at risk, and both are bounded by the holding cap.

The multiple depends on the rate at purchase, i.e. on utilization at that moment. Ignoring the bonus, payout ÷ premium = 1 / r:

| Utilization u | Rate r | Payout ÷ premium (before bonus) |
|---|---|---|
| 0.0 | 0.50% | 200× |
| 0.3 | 1.81% | 55× |
| 0.6 | 5.72% | 17× |
| 0.8 | 9.78% | 10× |
| 1.0 | 15.0% | 7× |

Buyers who purchase when nobody fears a breach are paid the most. Market-wide figures such as "10.3×" in §4.2 divide the total breach payout by all premiums collected across every epoch and every buyer, including buyers whose epochs passed; individual multiples are always computed per purchase at that purchase's rate.

If no breach occurs, premiums are simply spent. Over a full six-month run at the §4.2 utilization path, a buyer who keeps coverage every epoch spends about 12% of their coverage amount. The default side is structurally a frequent small loss and an occasional large gain.

### 3.10 Rating

Computed off-chain from on-chain fields; raw inputs live in the `Launch` account so anyone can recompute.

```
score = 45 × passed_epochs / 6
      + 30 × (1 − avg_rate_bps / r_max_bps)
      + 15 × covenant_weight_sum / max_weight_sum
      + 10 × min(backing_total / bond, 1)
grade: AAA ≥ 85 · AA ≥ 75 · A ≥ 65 · BBB ≥ 55 · BB ≥ 45 · B ≥ 35 · CCC ≥ 20 · D if breached
```

---

## 4. Revenue model

### 4.1 Streams

| # | Stream | Rate | When | Where in code |
|---|---|---|---|---|
| 1 | Premium fee | 10% of every premium, including the notional premium on sponsored coverage | `buy_coverage`, `claim_sponsored` | Split at purchase; `fee_vault` |
| 2 | Slash fee | 10% of the team's remaining bond after coverage on a breach | `resolve_epoch` (Breached) | Waterfall step 3 |
| 3 | Partner fee | 0.5% of the bond when registered through a partner code | `register_launch` | Split to partner wallet and `fee_vault` |
| 4 | Rating API | Monthly subscription for lenders, wallets, aggregators | After six-month histories exist | Backend, v2 keys |
| 5 | Staking yield share | 0% in v1; up to 20% of INF yield later | `resolve_epoch` | Parameter only in v1 |

No listing fee. Teams post risk, not fees.

### 4.2 Worked example (INF, shown in SOL value)

Team bond 500, backers 500, capacity 1,000. Coverage sold 600 in epoch 1 (u = 0.6, r = 5.72%), declining as launch fear fades.

| Epoch | u | r | Premium | Fee (10%) | Team credit | Backer credit |
|---|---|---|---|---|---|---|
| 1 | 0.60 | 5.72% | 34.3 | 3.4 | 15.5 | 15.5 |
| 2 | 0.45 | 3.44% | 15.5 | 1.5 | 7.0 | 7.0 |
| 3 | 0.30 | 1.81% | 5.4 | 0.5 | 2.4 | 2.4 |
| 4 | 0.20 | 1.08% | 2.2 | 0.2 | 1.0 | 1.0 |
| 5 | 0.12 | 0.71% | 0.9 | 0.1 | 0.4 | 0.4 |
| 6 | 0.08 | 0.59% | 0.5 | 0.0 | 0.2 | 0.2 |
| Total | | | 58.8 | 5.9 | 26.5 | 26.5 |

INF staking yield over six months at 6.4% APY: 16.0 on the bond, 16.0 on backing.

**All six epochs pass.** Team withdraws 500 + 26.5 + 16.0 = 542.5 (8.5% over six months). Backers withdraw 500 + 26.5 + 16.0 = 542.5. Protocol earns 5.9 in premium fees plus 2.5 partner fee if applicable.

**Breach in epoch 2** (treasury cap exceeded). Coverage owed P = 450 (u = 0.45 of 1,000). Bond B = 500 + 15.5 + 5.3 (yield) = 520.8. `from_bond = 450`, `from_backing = 0`, remainder 70.8, slash fee 7.1, bonus 63.7. Covered holders receive 450 + 63.7 = 513.7. Against the 49.8 of premiums collected across epochs 1 and 2 from all buyers, that is a market-wide 10.3×; an individual buyer in epoch 2 receives about 33× their own premium (see §3.9). Team loses everything. Backers lose nothing and keep 15.5 + 7.0 in credits. Protocol earns 4.9 + 7.1 = 12.0.

**Larger breach** (coverage 900 in epoch 1, u = 0.9). `from_bond = 500 + credits`, `from_backing ≈ 380`, backers lose about 76% of principal. The senior position is protection against ordinary breaches, not a guarantee; the frontend states this on the backing screen.

### 4.3 Scenarios

Assumptions: fees from streams 1–3 only; 5% breach rate; half of launches arrive through partners; average lifetime premiums 12% of capacity.

| New launches / month | Avg bond | Avg capacity | Protocol revenue / month |
|---|---|---|---|
| 20 | 300 | 500 | ≈ 100 SOL |
| 100 | 400 | 700 | ≈ 700 SOL |
| 300 | 500 | 900 | ≈ 2,700 SOL |

Streams 4 and 5 are excluded. At 100 launches per month the rating API becomes the larger business once six-month histories exist.

---

## 5. Test plan and test run

### 5.1 Program tests (litesvm or bankrun)

| Path | Scenario | Assertions |
|---|---|---|
| A | Six passes | Fee vault = 10% of all premiums; team and backer withdrawals equal principal + pro-rata credits; `passed_epochs = 6`; `status = Completed` |
| B | Breach in epoch 2, bond covers | `from_backing = 0`; holder claims sum to `P + bonus_pool` within 3 units; team `withdraw_bond` fails with `LaunchNotCompleted`; backers withdraw principal + credits |
| C | Breach in epoch 1, bond insufficient | `from_backing > 0`; backer losses pro-rata; total paid to holders = `P + bonus_pool` |
| D | Holding rules | Purchase above `holding × coverage_per_token` fails with `CoverageExceedsHolding`; selling before claim fails with `HoldingReduced` |
| E | Sponsored coverage | Fee transferred from bond; holder pays nothing; coverage counts toward utilization; per-wallet cap enforced |
| F | Gate | Registration with live mint authority, live freeze authority, EOA upgrade authority, or mutable metadata fails |
| G | Pricing table | u ∈ {0, 0.3, 0.5, 0.8, 1.0} → r_bps ∈ {50, 180, 412, 978, 1500} |
| H | Errors | One test per error code in §6.1 |

### 5.2 Devnet test run (the rehearsal for the demo)

Deploy with `epoch_slots = 1500` (about 10 minutes) and `total_epochs = 3`. A script drives five wallets and checks balances against an expected table after every epoch.

1. Deploy the program, the test INF mint (or real devnet INF if Sanctum provides one), and three dummy launches: a mock program with `ProgramData`, a treasury ATA, two team ATAs, an LP ATA, and a token mint that passes the gate.
2. Wallet T (team) registers each launch with bond 50, enables all four covenants, and sponsors 10% of capacity.
3. Wallets B1 and B2 back launch 1 with 25 each.
4. Wallets H1, H2, H3 hold tokens; H1 claims sponsored coverage; H2 and H3 buy coverage. The script logs `u` and `r` after each purchase and compares to §3.6.
5. The cranker resolves epoch 0 as Passed and opens epoch 1. Verify credits.
6. During epoch 1 wallet T withdraws more than the treasury cap on launch 1.
7. The cranker resolves epoch 1 as Breached. H1–H3 claim; B1 and B2 withdraw; T's `withdraw_bond` fails. Verify the waterfall.
8. Launches 2 and 3 run to epoch 3 clean; T withdraws bond plus credits.
9. The indexer shows launch 1 as grade D and launches 2 and 3 as their computed grades within 60 seconds; the badge SVG renders; the API returns `stale: false`.

Run the script twice: once from a clean deploy and once as a re-run to confirm idempotence (`EpochAlreadyResolved`, `AlreadyClaimed`).

### 5.3 Demo (3 minutes, recorded from the devnet run)

1. Team registers, posts an INF bond, enables four covenants, sponsors free coverage. 20 s
2. Two holders back the launch; two holders buy coverage; one claims free coverage. Utilization and rate rise on the curve. 30 s
3. Epoch resolves Passed; credits appear on the team and backer cards. 20 s
4. Team withdraws over the treasury cap; covenant 1 turns red on the detail page. 15 s
5. Epoch resolves Breached; holders' wallets receive INF; the launch card turns D; backers withdraw intact. 35 s
6. A second launch shows an AAA badge and the API response; one slide on the Sanctum track. 20 s

---

## 6. Development scope

Assumption: three developers using Claude Code, so each track can absorb its full scope inside four weeks. Stretch items are still listed last so they are the first to cut.

### 6.1 Contract (Anchor, Rust)

**Accounts (PDAs)**

| Account | Seeds | Key fields |
|---|---|---|
| `Protocol` | `["protocol"]` | admin, fee_vault, allowed_mints[4], premium_fee_bps, slash_fee_bps, partner_fee_bps, r_min_bps, r_max_bps, epoch_slots, total_epochs, min_bond, backing_cap_bps, sponsor_cap_bps, crank_reward |
| `Launch` | `["launch", mint]` | team, mint, bond_mint, partner, bond_vault, backing_vault, bond_balance, backing_total, sponsor_reserved, sponsor_used, coverage_per_token, covenants (4 × {enabled, params}), current_epoch, status, passed_epochs, rate_sum_bps, covenant_weight_sum, breached_at_epoch, team_credit, backer_credit_per_unit |
| `Epoch` | `["epoch", launch, index]` | start_slot, end_slot, snapshot {treasury, team_atas[4], lp, program_last_modified}, coverage_sold, premium_collected, result, payout_per_unit, closing_rate_bps |
| `Coverage` | `["coverage", epoch, buyer]` | amount, covered_tokens, premium_paid, sponsored, claimed |
| `Backing` | `["backing", launch, wallet]` | amount, credit_checkpoint, withdrawn |

**Instructions (12)**

| # | Instruction | Signer | Preconditions | Effect |
|---|---|---|---|---|
| 0 | `initialize_protocol` | admin | once | Create `Protocol`, set parameters |
| 1 | `register_launch` | team | gate passes; bond ≥ min_bond; mint allowed | Create `Launch`, transfer bond, partner fee split, create epoch 0 with snapshot |
| 2 | `open_epoch` | anyone | previous epoch Passed; current < total | Create next `Epoch`, snapshot |
| 3 | `deposit_backing` | backer | status Active; backing_total + amount ≤ cap | Transfer INF to `backing_vault`, create or update `Backing` |
| 4 | `buy_coverage` | holder | epoch Open; holding rule; capacity | Compute r, split fee, credit vaults, create or update `Coverage` |
| 5 | `sponsor_coverage` | team | epoch Open; reserved ≤ sponsor cap | Set `sponsor_reserved` |
| 6 | `claim_sponsored` | holder | reserve remaining; holding rule; per-wallet cap | Create `Coverage` with `sponsored = true`; fee from `bond_vault` |
| 7 | `resolve_epoch` | anyone | epoch Open; slot ≥ end_slot; account list matches registered addresses | Verify covenants → Passed or Breached; waterfall; crank reward |
| 8 | `claim` | holder | epoch Breached; holding rule; not claimed | Pay `amount × payout_per_unit` from vaults in waterfall order |
| 9 | `withdraw_backing` | backer | status Completed or Breached (after resolve) | Pay principal ± loss + credits |
| 10 | `withdraw_bond` | team | status Completed | Pay bond + credits |
| 11 | `withdraw_fees` | admin | | `fee_vault` → admin account |

**Rules that must not be skipped**

- Every account passed to `resolve_epoch` is compared to the address stored in `Launch`; mismatch is `AccountMismatch`.
- Covenant checks are pure reads of `ProgramData`, `Mint`, and token accounts. No CPI to any oracle.
- The team wallet cannot call `buy_coverage`, `claim_sponsored`, or `deposit_backing` on its own launch (`TeamCannotParticipate`).
- All arithmetic is checked integer math; `u_bps²` in u128.
- Bond and backing live in separate vaults so the waterfall order is enforceable by construction.

**Error codes**: BondTooSmall, BondMintNotAllowed, GateFailed, LaunchExists, EpochNotOpen, EpochNotEnded, EpochAlreadyResolved, CoverageExceedsCapacity, CoverageExceedsHolding, HoldingReduced, BackingCapExceeded, SponsorCapExceeded, TeamCannotParticipate, AccountMismatch, NotBreached, AlreadyClaimed, LaunchNotCompleted, Unauthorized.

**Stretch (week 3)**: `register_launch_with_swap` that accepts SOL and converts to INF via a Sanctum Router CPI; partner whitelist and split ratios in `Protocol`.

### 6.2 Backend (TypeScript, Node 20)

| Component | Scope |
|---|---|
| Indexer | Helius webhooks on the program ID with a 60-second `getProgramAccounts` polling fallback. Tables: launches, epochs, coverages, backings, fees_daily. Idempotent upserts keyed by PDA |
| Rating service | Computes §3.9 on read, 60-second cache; exposes raw inputs alongside the grade so consumers can recompute |
| Price service | INF/USD from Sanctum's price endpoint, Jupiter fallback, 30-second cache; returns `source` and `age_s` |
| Public API | `GET /launches`, `GET /launches/:mint`, `GET /launches/:mint/badge.svg` (`Cache-Control: max-age=300`), `GET /launches/:mint/epochs`, `GET /fees/daily` (admin token) |
| Cranker | Every 60 s: for each Open epoch with `end_slot ≤ now`, build the account list from `Launch.covenants`, call `resolve_epoch`, then `open_epoch` on Passed. Retries with backoff; relies on on-chain idempotence |
| Test-run script | The §5.2 driver: deploys fixtures, runs the five-wallet scenario, prints an expected-vs-actual table, exits non-zero on mismatch |
| Stretch | API keys with per-key rate limits and a usage table (stream 4 groundwork); Discord webhook on every Breached event |

Definition of done: the §5.2 run passes twice in a row; the badge renders on GitHub and in a Twitter card; every API response carries `stale` and `as_of_slot`.

### 6.3 Frontend (Next.js, create-solana-dapp `nextjs-anchor`)

| Screen | Contents | Calls |
|---|---|---|
| Launch list | Grade badge, current rate, bond, backing, utilization gauge, epochs passed, sponsored coverage remaining; sort by grade | API |
| Launch detail | Four covenants with baseline / current / status read live over RPC; epoch timeline; utilization curve with the current point; capital stack (backing over bond); USD conversions with the SOL-denomination notice | API + RPC |
| Protect | Amount input capped by holdings; premium and breach payout preview; "claim free coverage" button when reserve remains; sign | `buy_coverage`, `claim_sponsored`, `claim` |
| Back | Deposit input capped by remaining backing cap; projected yield from current rate and INF APY; senior-position explanation and the large-breach caveat; withdraw after settlement | `deposit_backing`, `withdraw_backing` |
| Register (team) | Gate pre-check over RPC before signing; covenant toggles with parameter sliders and the resulting weight; bond input with a Sanctum swap link; sponsor reserve; partner code | `register_launch`, `sponsor_coverage`, `withdraw_bond` |
| Embed widget | iframe: badge, rate, "Protect" and "Back" buttons deep-linking to the detail page with `?partner=` | none |
| Admin | Fees by day, cranker health, pending epochs | API |

Wallets: Phantom and Solflare. Priority fees on every transaction. Error codes mapped to plain-language messages. Stretch: "Register with SOL" flow using the swap CPI; mobile layout for the widget.

### 6.4 Four-week plan

| Week | Contract | Backend | Frontend | Exit criterion |
|---|---|---|---|---|
| 1 | All 12 instructions, four covenant checks, gate, waterfall; test paths A–H green locally | Schema, indexer with polling, price service, API skeleton | Wallet connect, list and detail against mock data, design system | Local test suite green; API serves fixtures |
| 2 | Devnet deploy; cranker integration; fix findings | Webhooks, rating, badge, cranker, test-run script v1 | Protect, Back, detail live against devnet | §5.2 run passes once on devnet |
| 3 | Sponsored coverage hardening; stretch: swap CPI, partner whitelist | Admin endpoints; stretch: API keys, Discord alerts | Register with gate pre-check, widget, admin; stretch: register-with-SOL | §5.2 passes twice; two or three real teams registered on devnet; widget embedded on one partner page |
| 4 | Freeze; only bug fixes | Freeze | Freeze; polish | Video, deck, GTM doc, submission on 2026-10-12 |

Coordination: one shared IDL published from the contract repo at the end of week 1; backend and frontend generate clients from it. Weekly demo on Friday against devnet.

---

## 7. Parameters (final)

| Parameter | Value |
|---|---|
| Allowed bond mints | INF; a test mint on devnet |
| min_bond | 50 SOL worth of INF |
| backing_cap_bps | 10,000 (backing ≤ bond) |
| sponsor_cap_bps | 2,000 (20% of capacity) |
| premium_fee_bps / slash_fee_bps / partner_fee_bps | 1,000 / 1,000 / 50 |
| r_min_bps / r_max_bps | 50 / 1,500 |
| epoch_slots / total_epochs | 6,480,000 / 6 (test: 1,500 / 3) |
| Covenant defaults | Treasury 5% per epoch, whitelist ≤ 8; team sell 1% of circulating per epoch, ≤ 4 ATAs; LP floor 80%; milestone at epoch 2 |
| Staking yield share to protocol | 0% (v1) |
| Price source | Sanctum, then Jupiter |
| Crank reward | 0.01 INF per resolve, from fee_vault |
| Geo | US IP blocked on the frontend; covenants named "commitments" in copy, not "insurance" |

---

## 8. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| SOL price decline | USD value of protection falls with it | INF denomination stated on every screen; the protected asset usually moves with SOL, so the mismatch is smaller than with a USDC bond |
| INF liquidity or depeg | Slippage when holders sell payouts | Payouts stay in INF; Sanctum Reserve allows instant unstake |
| Sanctum contract risk | Bond asset itself fails | Allowed-mint list keeps a USDC path available |
| Large breach | Backers lose principal | Cap backing at 1× bond; state the caveat on the Back screen; show worst-case loss per deposit |
| Honest team trips a covenant | False breach | Team sets parameters; whitelist for treasury; the frontend simulates each covenant against the last 30 days before signing |
| Regulatory | Insurance or CDS characterization | Payouts come from the team's own bond, not a third-party pool; no US users; copy avoids "insurance" |
| Cranker outage | Epochs not resolved on time | Anyone can crank; resolution is permissionless and rewarded |

---

## 9. Sanctum track

1. INF bond (hackathon). Ask: confirmation that INF may be listed as a bond asset; a joint line for the launch page; a quote for the deck.
2. Creator LST issuers as a second market (accelerator). Covenants: commission cap, no delinquency, stake-pool authority unchanged. Ask: introductions to two or three teams launching in October for the week-3 traction slot.
3. Restaked capital as senior backing (v2, Jito Restaking NCN). Covenant breach as the slashing condition; premiums as restaking rewards.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| Bond | INF the team posts; first-loss on breach |
| Backing | INF holders post alongside the bond; senior to it |
| Capacity | Bond + backing; maximum coverage sellable |
| Coverage | Protection amount a holder buys or claims; tied to token holdings |
| Sponsored coverage | Coverage the team pre-funds so holders claim it for free; team pays the protocol fee only |
| Covenant | A behavioral commitment the program verifies from accounts |
| Epoch | 30-day settlement period; six per launch |
| Utilization | Coverage sold ÷ capacity; sets the premium rate |
| Waterfall | Breach payout order: team bond, then backing; team remainder split fee / holders |
| PDA | Program-derived address; a deterministic account key |
