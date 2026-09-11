# INFINITE BOND — Product and Engineering Specification

Version 3.2 (final for hackathon build) · 2026-09-10
Target: Colosseum Crypto World's Fair, Solana track · Submission 2026-10-12
Status: This document is the single source of truth. Earlier documents are archived under `docs/archive/` and are superseded wherever they differ.

---

## 1. Summary

INFINITE BOND is a tradable covenant market for newly launched Solana tokens. A launching team posts a bond in a liquid staking token (INF or JitoSOL) behind a set of on-chain covenants: a treasury outflow cap, a team sell cap, a liquidity floor, and a deployment milestone. Two tokenized positions trade against that bond:

- **Default side, the coverage token.** Pays the holder in full, plus a share of the team's forfeited bond, if a covenant is breached. Priced by a utilization curve, bought from and sold back to the pool at any time, and transferable on any DEX.
- **Pass side, the backing share.** A vault share that earns premiums, trade fees, and staking yield while the team keeps its covenants, sitting senior to the team's bond.

The program checks every covenant by reading accounts directly. A breach settles the moment anyone proves it on-chain, not at month end. Six clean 30-day epochs produce an on-chain rating account.

What changed from v3.1: positions are SPL tokens instead of wallet-bound records, coverage can be sold back to the pool on the same curve, premiums are priced by the integral of the curve with time decay, breaches settle early, protocol revenue comes mainly from trading, and JitoSOL joins INF as a bond asset. Regulatory mitigations (geo-blocking, wording) are dropped for the hackathon build.

---

## 2. Roles and incentives

| Role | Does | Gets | Risks |
|---|---|---|---|
| Team | Passes the gate, picks covenants and parameters, posts the bond, may sponsor free coverage | Rating, less early sell pressure, most of the premiums and 30% of trade fees, staking yield on the bond | Entire bond on any breach |
| Backer (pass side) | Deposits the bond asset, receives backing shares | Share of premiums, trade fees, and staking yield; can sell shares on a DEX or redeem from the pool | At most 30% of principal, and only after the bond is exhausted |
| Protection buyer (default side) | Buys coverage tokens from the pool, holds or trades them | On breach: coverage plus bonus, 7× to 200× the premium; without breach: sells back higher if fear rises | Premium; coverage pays only while the launch token is still held |
| Trader | Buys and sells coverage tokens and backing shares on the pool curve or a DEX | Price moves driven by on-chain covenant signals | Ordinary trading loss |
| Cranker | Proves breaches and resolves epochs | Fixed reward per resolve | None |
| Launchpad | Embeds the widget, passes a partner code | Partner fee share, "bonded launch" badge | None |

Why it works: the team is first-loss, so posting the bond is the signal; coverage pays only to holders, so protection reduces selling; every covenant is an on-chain fact, so prices move on information the whole market can see; and both sides are tokens, so the market is live between settlements rather than a monthly lottery.

---

## 3. Mechanism

### 3.1 Units and bond assets

All program amounts are in the launch's bond asset, chosen at registration from `allowed_mints` (INF and JitoSOL at launch). Backing, coverage, premiums, and payouts use the same mint, so no price oracle is needed. Both assets accrete against SOL, so staking yield needs no accounting. The frontend converts to USD for display only and states the denomination on every screen.

### 3.2 Registration gate

Accepted only if, at `register_launch`: mint authority is `None`, freeze authority is `None`, program upgrade authority is a declared multisig or timelock (or `None`), and token metadata is immutable. These are filters, not covenants, and carry no rating weight.

### 3.3 Covenants

Each is verified by reading accounts passed to `resolve_epoch` and compared against the snapshot taken at epoch open. The team chooses which to enable; stricter parameters raise the weight.

| # | Covenant | Check | Default | Weight | Checkable |
|---|---|---|---|---|---|
| 1 | Treasury outflow cap with whitelist | `snapshot − current ≤ cap`; any outflow to a non-whitelisted account breaches | 5% per epoch, ≤ 8 whitelisted | 2 (3 if ≤ 2%) | Any time |
| 2 | Team sell cap, including post-unlock | Decreases across declared team ATAs ≤ cap; transfers to the declared vesting program exempt | 1% of circulating per epoch, ≤ 4 ATAs | 2 (3 if ≤ 0.5%) | Any time |
| 3 | LP depth floor | LP token account balance ≥ floor × initial | 80% | 1 | Any time |
| 4 | Deployment milestone | `ProgramData.last_modified_slot > registration_slot` by the milestone epoch | Epoch 2 | 2 | Epoch end only |

Any single failure breaches the launch. Performance covenants (revenue, buyback, runway) and Creator LST covenants are v2.

### 3.4 Capital stack and capacity

```
bond       B   team's deposit + credited premiums + yield        first loss
backing    K   backers' deposits + credits, K ≤ B                 senior, loss capped at 30%
capacity   C = B + 0.3 × K                                        max coverage outstanding
```

Only 30% of backing counts toward capacity, and that 30% is the most a backer can lose. This bounds what a malicious team could extract by buying its own coverage through other wallets and breaching: at most `0.3K − premiums`, which is less than the liquidity it could pull directly, at the cost of its rating and its token (§8).

The team may reserve up to 20% of capacity as sponsored coverage that holders claim for free.

### 3.5 Epochs and early breach

Six epochs of `epoch_slots` (30 days; test runs use 1,500 slots ≈ 10 minutes). Each epoch has its own coverage token mint.

```
register_launch       gate, bond in, covenants set, backing share mint, epoch 0 + coverage mint 0
during epoch N        deposit/redeem backing, buy/sell coverage, claim sponsored, trade on DEX
resolve_epoch         (a) slot ≥ end_slot, or (b) any covenant currently failing → early breach
   Passed             escrow + pool fees credited to bond and backing; open_epoch N+1
   Breached           waterfall; coverage tokens of epoch N become claimable; launch closes
after epoch 6         withdraw_bond; redeem backing
```

Early breach is what makes the market fair: a treasury withdrawal over the cap is visible in the same slot it happens, and anyone can settle it immediately, so last-minute buyers cannot free-ride on a breach that already occurred. The cranker polls every 10 seconds; anyone may call.

### 3.6 Two-way pricing

The premium rate rises with utilization `u = coverage_outstanding / capacity`:

```
r(u)       = r_min + (r_max − r_min) × u²                 r_min 0.5%, r_max 15% per epoch
R(u0, u1)  = r_min × (u1 − u0) + (r_max − r_min) × (u1³ − u0³) / 3     (integral of r)
t          = (end_slot − now) / epoch_slots               remaining fraction of the epoch

buy  Δ:  premium = C × R(u, u + Δ/C) × t;   fee = premium × 10%;   buyer pays premium + fee
sell Δ:  refund  = C × R(u − Δ/C, u) × t;   fee = refund  × 10%;   seller receives refund − fee
```

Premiums go to the epoch's escrow; refunds come out of it. Because buys and sells use the same integral and `t` only falls within an epoch, escrow always covers every possible refund. Fees split 70% protocol, 30% pool; the pool's share is credited with the escrow at settlement. Integer math: `u` in bps, cubes in u128, `t` in slots, division floors. Reference values at C = 1,000 and t = 1: R(0, 0.3) = 2.805; R(0.3, 0.5) = 5.737; R(0.5, 0.8) = 20.205; R(0.8, 1.0) = 24.587; R(0, 1) = 53.333.

The price a buyer sees on the frontend is `premium / Δ`, an average rate over the band bought. The marginal rate `r(u)` is shown on the curve chart.

### 3.7 Tokenized positions

| Token | Mint | Minted / burned by | Transferable | Represents |
|---|---|---|---|---|
| Coverage token `CVR` | one per epoch, seeds `["cov", epoch]`, Token-2022, decimals of the bond asset, 0.3% transfer fee | `buy_coverage` / `sell_coverage`, `claim` | Yes, any DEX | 1 unit = 1 unit of coverage in the current epoch |
| Backing share `BKR` | one per launch, seeds `["bkr", launch]`, Token-2022, 0.3% transfer fee | `deposit_backing` / `redeem_backing` | Yes, any DEX | Pro-rata claim on the backing vault (principal + credits) |
| Sponsored record | PDA `["sponsored", epoch, holder]` | `claim_sponsored`, `claim` | No | Free coverage; cannot be sold back or transferred, so it cannot drain the bond |

**Holding rule.** Coverage pays only to a wallet that still holds the launch token: `claim` requires `launch_token_balance ≥ coverage_amount / coverage_per_token`, where `coverage_per_token` is fixed at registration. A transferred coverage token keeps this requirement; the buyer on a DEX must hold the launch token to claim.

**Backing shares.** Share price = backing vault value ÷ shares outstanding; it rises as credits accrue and never falls except on a breach. `redeem_backing` is allowed at any time while the launch is active, provided `B + 0.3 × (K − out) ≥ coverage_outstanding`; after settlement it is unconditional.

**Secondary market.** The pool is the primary venue and is always liquid. Because both tokens are ordinary SPL mints, anyone can open a pool on a DEX that supports Token-2022 transfer fees (Meteora DLMM, Raydium CPMM); the frontend links to it. Transfer fees on those trades are withheld by the token program and harvested to the protocol.

### 3.8 Settlement

At `resolve_epoch`, escrow plus the pool's fee share are credited first: `B += credit × B / C`, `K += credit × 0.3K / C`. Then:

**Passed.** `passed_epochs += 1`, `rate_sum += r(u_close)`, coverage tokens of the epoch expire worthless. After epoch 6, `status = Completed`.

**Breached.**

```
P             = coverage_outstanding + sponsored_outstanding
from_bond     = min(P, B)
from_backing  = min(P − from_bond, 0.3 × K)        (cannot exceed the loss cap by construction)
remainder     = B − from_bond
slash_fee     = remainder × 10%
bonus_pool    = remainder − slash_fee
payout_per_unit = (P + bonus_pool) / P
```

`claim` burns coverage tokens (or consumes the sponsored record) and pays `amount × payout_per_unit`, bond vault first, then backing vault. The team's bond is always fully consumed on a breach: coverage, then slash fee, then bonus.

### 3.9 Buyer economics

Coverage is a face amount, not a deposit; the buyer pays only the premium. Two ways to earn:

**Hold to breach.** From the §4.2 example (breach in epoch 2, bonus pool 207 on coverage 292.5): a holder who bought 30 of coverage at u ≈ 0.44 paid a premium of 1.08 plus a fee of 0.11 and receives 30 + 21.2 = 51.2, about 47× the premium. Net of the token's own move: +20.0 if the token goes to zero, +35.0 if it halves, +50.0 if unchanged. Ignoring the bonus, the multiple is `1 / r` at the rate paid: 200× at u = 0, 55× at 0.3, 17× at 0.6, 10× at 0.8, 7× at 1.0. Buyers who buy when nobody fears a breach are paid the most. Market-wide figures divide total payout by all premiums ever collected and are always lower than an individual purchase's multiple.

**Trade the fear.** Buy 100 of coverage at u = 0.20 at the start of an epoch (premium 1.64, fee 0.16). Halfway through the epoch, after a suspicious treasury movement pushes u to 0.70, sell back: refund 3.08, fee 0.31, received 2.77. Net +0.97 on 1.80 spent, with no breach. This is what makes the default side a position rather than a lottery.

If nothing happens, premiums are spent: buying at the start of every epoch on the §4.2 path costs about 9% of average coverage over six months.

### 3.10 Rating

Computed off-chain from `Launch` fields so anyone can recompute:

```
score = 45 × passed_epochs / 6 + 30 × (1 − avg_close_rate / r_max) + 15 × weight_sum / max_weight + 10 × min(K / B, 1)
AAA ≥ 85 · AA ≥ 75 · A ≥ 65 · BBB ≥ 55 · BB ≥ 45 · B ≥ 35 · CCC ≥ 20 · D if breached
```

---

## 4. Revenue model

### 4.1 Streams

| # | Stream | Rate | Where |
|---|---|---|---|
| 1 | Pool trade fee | 10% of every premium and every refund; 70% to protocol, 30% to the pool | `buy_coverage`, `sell_coverage`, `claim_sponsored` (notional) |
| 2 | Transfer fee | 0.3% of every DEX or wallet transfer of `CVR` and `BKR` (Token-2022 extension) | `harvest_transfer_fees` |
| 3 | Slash fee | 10% of the team's remaining bond after coverage on a breach | `resolve_epoch` |
| 4 | Partner fee | 0.5% of the bond when registered through a partner code | `register_launch` |
| 5 | Rating API | Subscription for lenders, wallets, aggregators | Backend, v2 |

No listing fee. Streams 1 and 2 scale with volume, which is the point of v3.2: revenue follows activity, not launch count.

### 4.2 Worked example

Bond 500, backing 500, capacity 650. Each epoch, buyers push utilization 0.2 above the closing level at the start, and that 0.2 is sold back halfway through. Closing utilization falls as launch fear fades.

| Epoch | u close | r close | Premiums | Refunds | Fees | Protocol | Credit to pool | Team | Backers |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.60 | 5.72% | 18.7 | 5.0 | 2.4 | 1.7 | 14.4 | 11.1 | 3.3 |
| 2 | 0.45 | 3.44% | 10.7 | 3.2 | 1.4 | 1.0 | 8.0 | 6.1 | 1.8 |
| 3 | 0.30 | 1.80% | 5.6 | 1.9 | 0.7 | 0.5 | 3.9 | 3.0 | 0.9 |
| 4 | 0.20 | 1.08% | 3.3 | 1.2 | 0.5 | 0.3 | 2.2 | 1.7 | 0.5 |
| 5 | 0.12 | 0.71% | 2.1 | 0.8 | 0.3 | 0.2 | 1.3 | 1.0 | 0.3 |
| 6 | 0.08 | 0.59% | 1.6 | 0.7 | 0.2 | 0.2 | 1.0 | 0.8 | 0.2 |
| Total | | | 42.0 | 12.7 | 5.5 | 3.8 | 30.9 | 23.7 | 7.1 |

Staking yield over six months at about 6.4% APY: 16.0 on the bond, 16.0 on backing.

- **Six passes.** Team withdraws 500 + 23.7 + 16.0 = 539.7 (7.9%). Backing vault holds 500 + 7.1 + 16.0 = 523.1 (4.6%), realized through the share price. Protocol: 3.8 from pool fees plus transfer fees on DEX volume.
- **Breach at end of epoch 2.** P = 292.5. B = 500 + 17.2 (credits) + 5.3 (yield) = 522.6. `from_bond` 292.5, `from_backing` 0, remainder 230.1, slash fee 23.0, bonus 207.1. Covered holders receive 499.6 on 292.5 of coverage. Backers lose nothing. Protocol earns 2.7 + 23.0.
- **Large breach.** Coverage at full capacity (650) in epoch 1: `from_bond` ≈ 514, `from_backing` ≈ 136, backers lose 27% of principal, close to the 30% cap. The Back screen shows this worst case next to every deposit.

### 4.3 Scenarios

Per-launch lifetime revenue is about 6 in the bond asset with no secondary volume, and rises with DEX volume of `CVR` and `BKR`. Assumptions: 5% breach rate, half of launches through partners, secondary volume expressed as multiples of capacity per month.

| Launches / month | Avg bond | Avg capacity | Secondary 2× | Secondary 5× |
|---|---|---|---|---|
| 20 | 300 | 345 | ≈ 315 / month | ≈ 690 / month |
| 100 | 400 | 490 | ≈ 2,200 / month | ≈ 4,900 / month |
| 300 | 500 | 650 | ≈ 8,900 / month | ≈ 19,400 / month |

Figures are in the bond asset (roughly SOL). Stream 5 is excluded.

---

## 5. Tests, test run, and demo

### 5.1 Program tests (litesvm)

| Path | Scenario | Assertions |
|---|---|---|
| A | Six passes | Fee vault = 70% of fees; team withdrawal = principal + credits; backing share price = vault ÷ shares; `status = Completed` |
| B | Breach at end of epoch 2, bond covers | `from_backing = 0`; claims sum to `P + bonus_pool` within 3 units; `withdraw_bond` fails with `LaunchNotCompleted` |
| C | Breach in epoch 1, bond insufficient | `from_backing > 0` and ≤ 0.3K; share price drops accordingly; total paid = `P + bonus_pool` |
| D | Early breach | Treasury outflow over cap mid-epoch; `resolve_epoch` succeeds before `end_slot`; a `buy_coverage` in a later slot fails with `EpochNotOpen` |
| E | Two-way pricing | Buy then immediate sell returns `premium − 2 × fee`; escrow never negative across a random sequence of 200 buys and sells with decreasing `t`; reference values in §3.6 |
| F | Tokenized claim | Coverage transferred to a second wallet; claim succeeds only if that wallet holds the launch token; original wallet's claim fails with `InsufficientCoverage` |
| G | Sponsored | Record non-transferable; `sell_coverage` on sponsored amount fails; fee taken from bond; counts toward utilization |
| H | Backing redeem | Redeem while active succeeds only if the solvency rule holds; fails with `BackingLocked` otherwise |
| I | Transfer fee | DEX-style transfer withholds 0.3%; `harvest_transfer_fees` moves it to `fee_vault` |
| J | Gate and errors | Each gate condition; one test per error code |

### 5.2 Devnet test run

Deploy with `epoch_slots = 1500`, `total_epochs = 3`, a test bond mint. A script drives six wallets and checks balances against an expected table after every step.

1. Deploy the program and three dummy launches (mock program with `ProgramData`, treasury ATA, two team ATAs, LP ATA, gate-passing token mint).
2. Wallet T registers each launch with bond 50, all four covenants, 10% sponsored reserve.
3. B1 and B2 back launch 1 with 25 each; the script checks share price = 1.0.
4. H1 claims sponsored coverage; H2 and H3 buy coverage; H3 sells half back; H2 transfers half to H4 over a plain SPL transfer. The script logs `u`, average rate, escrow, and fees after each step.
5. Epoch 0 resolves Passed; credits appear; share price rises.
6. During epoch 1, T withdraws over the treasury cap on launch 1; the cranker resolves Breached within 10 seconds, before `end_slot`.
7. H1–H4 claim (H4 must hold the launch token); B1 and B2 redeem; T's `withdraw_bond` fails. Verify the waterfall.
8. Launches 2 and 3 run clean to epoch 3; T withdraws bond plus credits; B1 sells some `BKR` on a devnet DEX pool and the harvest moves the fee.
9. The indexer shows launch 1 as D and the others graded within 60 seconds; the badge renders.

Run twice: clean deploy, then re-run for idempotence (`EpochAlreadyResolved`, `AlreadyClaimed`).

### 5.3 Demo (3 minutes, recorded from the devnet run)

1. Team registers, posts the bond, enables covenants, sponsors free coverage. 20 s
2. Backers deposit; buyers buy coverage; the curve and the price chart move; one buyer sells back at a profit after another buyer pushes utilization up. 40 s
3. Epoch resolves Passed; share price ticks up. 15 s
4. Team withdraws over the treasury cap; within seconds the launch turns D. 25 s
5. Holders claim; a coverage token bought on the DEX also claims; backers redeem intact. 30 s
6. Second launch with an AAA badge and the API response; one slide on the Sanctum and Jito angle. 20 s

---

## 6. Development scope

Three developers using Claude Code; each track owns its full scope within four weeks. Stretch items are listed last and are cut first.

### 6.1 Contract (Anchor, Rust)

**Accounts**

| Account | Seeds | Key fields |
|---|---|---|
| `Protocol` | `["protocol"]` | admin, fee_vault, allowed_mints[4], trade_fee_bps, pool_fee_share_bps, transfer_fee_bps, slash_fee_bps, partner_fee_bps, r_min_bps, r_max_bps, epoch_slots, total_epochs, min_bond, backing_cap_bps, backing_loss_cap_bps, sponsor_cap_bps, crank_reward |
| `Launch` | `["launch", mint]` | team, mint, bond_mint, partner, bond_vault, backing_vault, backing_share_mint, bond_balance, backing_total, backing_shares, sponsor_reserved, sponsor_used, coverage_per_token, covenants[4] {enabled, params}, current_epoch, status, passed_epochs, rate_sum_bps, covenant_weight_sum, breached_at_epoch |
| `Epoch` | `["epoch", launch, index]` | start_slot, end_slot, snapshot {treasury, team_atas[4], lp, program_last_modified}, coverage_mint, coverage_outstanding, sponsored_outstanding, escrow, pool_fee_credit, result, payout_per_unit, closing_rate_bps |
| `Sponsored` | `["sponsored", epoch, holder]` | amount, claimed |

Coverage and backing positions are token balances; no per-wallet PDA is needed for them.

**Instructions**

| # | Instruction | Signer | Preconditions | Effect |
|---|---|---|---|---|
| 0 | `initialize_protocol` | admin | once | Create `Protocol` |
| 1 | `register_launch` | team | gate; bond ≥ min_bond; mint allowed | Create `Launch`, vaults, `BKR` mint; transfer bond; partner split; epoch 0 with snapshot and `CVR` mint |
| 2 | `open_epoch` | anyone | previous Passed; index < total | Create `Epoch`, snapshot, `CVR` mint |
| 3 | `deposit_backing` | backer | active; K + amount ≤ B | Transfer in; mint `BKR` at share price |
| 4 | `redeem_backing` | backer | solvency rule, or settled | Burn `BKR`; pay share of vault |
| 5 | `buy_coverage` | anyone | epoch open; outstanding + Δ ≤ C | Charge premium + fee; escrow; mint `CVR` |
| 6 | `sell_coverage` | anyone | epoch open; holds Δ `CVR` | Burn `CVR`; refund − fee from escrow |
| 7 | `sponsor_coverage` | team | epoch open; ≤ sponsor cap | Set `sponsor_reserved` |
| 8 | `claim_sponsored` | holder | reserve remaining; holding rule; per-wallet cap | Create `Sponsored`; notional fee from bond |
| 9 | `resolve_epoch` | anyone | end reached, or a covenant fails now; accounts match `Launch` | Credit escrow and pool fees; verify; waterfall; reward |
| 10 | `claim` | holder | Breached; holding rule | Burn `CVR` and/or consume `Sponsored`; pay `amount × payout_per_unit` |
| 11 | `withdraw_bond` | team | Completed | Pay bond + credits |
| 12 | `harvest_transfer_fees` | anyone | | Withdraw withheld Token-2022 fees from listed accounts to `fee_vault` |
| 13 | `withdraw_fees` | admin | | `fee_vault` → admin |

**Rules**

- Every account passed to `resolve_epoch` is compared to the address stored in `Launch`; mismatch is `AccountMismatch`.
- Covenant checks are pure reads of `ProgramData`, `Mint`, and token accounts. No oracle, no CPI outside the token programs.
- Buy and sell use the same `R` function and the same `t`; escrow is only ever debited by `sell_coverage` and `resolve_epoch`.
- `CVR` and `BKR` mint authority is the `Launch` PDA; the transfer-fee config authority is the `Protocol` PDA; withdraw-withheld authority is the `Protocol` PDA.
- Bond and backing live in separate vaults so the waterfall order holds by construction.
- All arithmetic is checked integer math.

**Error codes**: BondTooSmall, BondMintNotAllowed, GateFailed, LaunchExists, EpochNotOpen, EpochNotEnded, EpochAlreadyResolved, CoverageExceedsCapacity, CoverageExceedsHolding, HoldingReduced, InsufficientCoverage, BackingCapExceeded, BackingLocked, SponsorCapExceeded, SponsoredNotSellable, AccountMismatch, NotBreached, AlreadyClaimed, LaunchNotCompleted, Unauthorized.

**Stretch**: `register_launch_with_swap` (SOL → INF via Sanctum Router CPI, or SOL → JitoSOL via the Jito stake pool); partner whitelist in `Protocol`.

### 6.2 Backend (TypeScript, Node 20)

| Component | Scope |
|---|---|
| Indexer | Helius webhooks on the program ID plus a 60-second `getProgramAccounts` fallback. Tables: launches, epochs, trades (buy/sell/claim with `u`, rate, fee), backing_events, holders (token accounts of `CVR` and `BKR`), fees_daily. Idempotent upserts keyed by signature |
| Price history | Curve price and share price per launch sampled on every trade and every 60 s; served as OHLC-style series for the chart |
| Rating | §3.10 on read, 60-second cache, raw inputs in the response |
| Public API | `GET /launches`, `GET /launches/:mint`, `GET /launches/:mint/epochs`, `GET /launches/:mint/trades`, `GET /launches/:mint/prices`, `GET /launches/:mint/badge.svg`, `GET /fees/daily` (admin) |
| Cranker | Every 10 s: for each open epoch, simulate the covenant checks off-chain; if any fails or `end_slot` passed, call `resolve_epoch`, then `open_epoch` on Passed. Every hour: `harvest_transfer_fees` over indexed `CVR`/`BKR` accounts |
| Test-run script | The §5.2 driver: fixtures, six wallets, expected-vs-actual table, non-zero exit on mismatch |
| Stretch | API keys and usage table; Discord webhook on Breached |

Done when: the §5.2 run passes twice; the badge renders; every response carries `stale` and `as_of_slot`.

### 6.3 Frontend (Next.js, create-solana-dapp `nextjs-anchor`)

| Screen | Contents | Calls |
|---|---|---|
| Launch list | Grade, current rate, bond, backing, utilization, epochs passed, sponsored remaining, 24h volume | API |
| Launch detail | Four covenants with baseline / current / status read live over RPC; epoch timeline; utilization curve with current point; capital stack; price chart of `CVR` and `BKR` | API + RPC |
| Trade (default side) | Buy: amount capped by holdings, premium + fee preview, average rate; Sell: refund − fee preview; position card with entry rate, mark, P&L; "claim free coverage" when reserve remains; DEX link | `buy_coverage`, `sell_coverage`, `claim_sponsored`, `claim` |
| Back (pass side) | Deposit with share price, projected APY from rate history and staking yield, worst-case loss (30%); Redeem with solvency status; DEX link | `deposit_backing`, `redeem_backing` |
| Register (team) | Gate pre-check over RPC; covenant toggles with sliders and resulting weight; bond asset select (INF / JitoSOL) with a swap link; sponsor reserve; partner code | `register_launch`, `sponsor_coverage`, `withdraw_bond` |
| Embed widget | iframe: badge, rate, Trade and Back buttons deep-linking with `?partner=` | none |
| Admin | Fees by stream and day, cranker health, pending harvests | API |

Wallets: Phantom, Solflare. Priority fees on every transaction. Error codes mapped to plain messages. Stretch: register with SOL via the swap CPI; mobile layout for the widget.

### 6.4 Four-week plan

| Week | Contract | Backend | Frontend | Exit criterion |
|---|---|---|---|---|
| 1 | Accounts, instructions 0–11, Token-2022 mints, integral pricing, four covenant checks, early breach; test paths A–H green locally | Schema, indexer with polling, price history, API skeleton | Wallet connect, list and detail on mock data, curve chart, design system | Local tests green; API serves fixtures |
| 2 | Devnet deploy; instructions 12–13; transfer-fee harvest; path I–J | Webhooks, rating, badge, cranker with early-breach polling, test-run script v1 | Trade and Back live on devnet with the price chart | §5.2 run passes once on devnet |
| 3 | Hardening; devnet DEX pool for `CVR`/`BKR`; stretch: swap CPI | Admin endpoints, trades API; stretch: API keys, Discord | Register with gate pre-check, widget, admin; stretch: register with SOL | §5.2 passes twice; two or three real teams on devnet; widget on one partner page |
| 4 | Freeze; bug fixes only | Freeze | Polish | Video, deck, submission on 2026-10-12 |

One shared IDL published at the end of week 1; backend and frontend generate clients from it. Weekly demo on Friday against devnet.

---

## 7. Parameters

| Parameter | Value |
|---|---|
| allowed_mints | INF, JitoSOL; test mint on devnet |
| min_bond | 50 SOL worth |
| backing_cap_bps / backing_loss_cap_bps | 10,000 (K ≤ B) / 3,000 |
| sponsor_cap_bps | 2,000 |
| trade_fee_bps / pool_fee_share_bps | 1,000 (10% of premium or refund) / 3,000 (30% of fees to the pool) |
| transfer_fee_bps | 30, on `CVR` and `BKR` |
| slash_fee_bps / partner_fee_bps | 1,000 / 50 |
| r_min_bps / r_max_bps | 50 / 1,500 |
| epoch_slots / total_epochs | 6,480,000 / 6 (test: 1,500 / 3) |
| Covenant defaults | Treasury 5% per epoch, whitelist ≤ 8; team sell 1% of circulating per epoch, ≤ 4 ATAs; LP floor 80%; milestone at epoch 2 |
| Crank reward | 0.01 per resolve, from `fee_vault` |
| Cranker poll | 10 s for covenants, 60 min for fee harvest |

---

## 8. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Team self-deals: buys its own coverage via other wallets, then breaches | Backers pay out to the team | Loss cap 30% of backing and K ≤ B bound the gain to `0.3K − premiums`; the team forfeits its rating and token to get it; shown on the Back screen |
| Team front-runs its own breach | Team buys coverage cheaply, then breaches | Same bound; early breach removes the window between the breaching transaction and settlement |
| Escrow shortfall | Refunds exceed escrow | Buy and sell use the same integral with non-increasing `t`; fees are charged on top; property test in path E |
| Thin DEX liquidity for `CVR` / `BKR` | Secondary trading small at first | The pool curve is always liquid; DEX pools are optional and revenue upside only |
| Honest team trips a covenant | False breach | Team sets parameters; treasury whitelist; the frontend simulates each covenant against the last 30 days before signing |
| Bond asset depeg (INF, JitoSOL) | Payout value falls | Payouts stay in the bond asset; both have instant unstake paths; allowed-mint list can add a stable |
| Cranker outage | Breach settles late; buyers front-run | Resolution is permissionless and rewarded; anyone running the open-source cranker can settle |
| Large breach at full capacity | Backers lose up to 30% | Cap stated on every deposit |

---

## 9. Sanctum and Jito

**Bond asset choice.** INF (Sanctum) and JitoSOL (Jito) both accrete, both have deep liquidity, and their yields are within about one percentage point of each other, so the choice is about partnerships rather than returns. INF is the featured asset for the Sanctum track and the launch page; JitoSOL is enabled from day one because it is the deepest LST on DEXes, which matters once `CVR` and `BKR` trade against it, and because Jito Restaking is the natural v2 for backing.

1. Sanctum (hackathon): INF as bond asset; ask for confirmation, a joint line for the launch page, and a quote for the deck. Creator LST issuers as a second market later.
2. Jito (hackathon): JitoSOL as bond asset; ask for a mention.
3. Jito Restaking (v2): backing vault as an NCN vault where a covenant breach is the slashing condition and premiums are the restaking reward.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| Bond | Team's deposit in INF or JitoSOL; first loss on breach |
| Backing / `BKR` | Senior deposits alongside the bond; tokenized as backing shares; loss capped at 30% |
| Capacity | `B + 0.3K`; maximum coverage outstanding |
| Coverage / `CVR` | Protection amount, tokenized per epoch; pays on breach to a wallet still holding the launch token |
| Sponsored coverage | Free coverage the team pre-funds; a non-transferable record |
| Covenant | A behavioral commitment the program verifies from accounts |
| Epoch | 30-day settlement period; six per launch; may end early on breach |
| Utilization | Coverage outstanding ÷ capacity; sets the marginal rate |
| Escrow | Premiums held during an epoch to fund sell-backs; credited to the pool at settlement |
| Waterfall | Breach payout order: bond, then backing up to the cap; team remainder split fee / bonus |
