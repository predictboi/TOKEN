# 개발자 인계 문서: 본드 런치 약속 시장

작성일: 2026-09-10
대상: 온체인·백엔드·프론트 개발자
기준: `docs/project-spec.md` v2. 이 문서는 스펙을 "무엇을 왜 만드는가"로 다시 쓴 것이며, 수치와 규칙이 충돌하면 이 문서가 우선한다.

---

## 0. 30초 요약

토큰을 런치한 팀이 **"러그 안 친다"는 약속 5가지에 자기 돈(본드)을 걸고**, 홀더는 **그 약속이 깨질 때 보상받는 보호를 산다**. 보호 가격은 수요에 따라 자동으로 오르내리고, 6개월 동안 약속을 지킨 기록이 **신용등급**이 된다.

Web2로 번역하면 이렇다.

| 우리 것 | Web2에서 이미 있는 것 |
|---|---|
| 팀이 거는 본드 | 건설사 계약이행 보증금, Airbnb 호스트 보증금 |
| 홀더가 사는 보호 | 전세보증보험(HUG), 쿠팡 안심케어 |
| 보험료율이 수요로 움직임 | Uber 서지 프라이싱, 항공권 다이내믹 프라이싱 |
| 약속 5가지 | GitHub 브랜치 보호 규칙(force-push 금지, 리뷰 필수). 사람이 아니라 시스템이 강제 |
| 스냅샷 | 렌터카 인수 시 찍는 차량 상태 사진 |
| 크랭커 | 아무나 실행할 수 있는 공개 cron job |
| 등급 계정 | NICE·KCB 신용점수 |
| 배지 SVG | Trustpilot 별점 위젯, 네이버 안심가게 배지 |
| 등급 API | 신용조회 API(NICE 평가정보 B2B) |
| 런치패드 | 네이버 스마트스토어·쿠팡 마켓플레이스. 우리는 그 위에 붙는 안전결제 모듈 |

한 줄로: **마켓플레이스 위에 붙는 에스크로 + 보증보험 모듈이고, 보험료는 서지 프라이싱으로 정해지며, 이력이 신용점수가 된다.**

---

## 1. 수익 구조와 그것을 위해 개발할 것

수익원마다 "돈이 실제로 우리 계좌에 들어오려면 코드 어디에 무엇이 있어야 하는가"를 적었다.

### 1.1 보험료 수수료 (Take rate)

| 항목 | 내용 |
|---|---|
| Web2 비유 | Airbnb 서비스 수수료, 앱스토어 30%. 거래가 일어날 때마다 플랫폼이 떼는 몫 |
| 요율 | 홀더가 낸 보험료의 10% (`premium_fee_bps = 1000`) |
| 발생 시점 | `buy_coverage` 실행 순간. 정산을 기다리지 않는다 |
| 개발할 것 | (a) `Protocol` 계정에 `premium_fee_bps`, `fee_vault` 주소. (b) `buy_coverage` 안에서 보험료를 두 갈래로 전송: 10%는 `fee_vault`, 90%는 해당 런치의 `bond_vault`. (c) 관리자만 `fee_vault`에서 출금하는 `withdraw_fees` 인스트럭션. (d) 인덱서에 일별 수수료 합계 테이블 |
| 왜 즉시 떼나 | 정산 시점에 떼면 Breach 케이스에서 분배 로직이 복잡해진다. 결제 시점에 떼는 것이 Stripe가 결제마다 2.9%를 떼는 것과 같은 단순함 |

### 1.2 슬래시 수수료 (Breach settlement fee)

| 항목 | 내용 |
|---|---|
| Web2 비유 | PayPal 분쟁 처리 수수료, 채권 추심 수수료. 나쁜 일이 생겨 우리가 정산을 대신 처리할 때 받는 몫 |
| 요율 | Breach 시 커버리지 지급 후 남은 본드의 10% (`slash_fee_bps = 1000`) |
| 발생 시점 | `resolve_epoch`가 Breached를 확정하는 순간 |
| 개발할 것 | (a) `resolve_epoch`의 Breached 분기에서 `remaining = bond_balance − coverage_sold` 계산 후 `remaining × 10%`를 `fee_vault`로 전송. (b) 나머지 90%를 커버리지 보유자에게 pro-rata 배분할 비율을 `Epoch`에 기록. (c) `claim`이 그 비율로 지급 |
| 주의 | 커버리지 지급이 먼저, 수수료가 그 다음. 순서가 바뀌면 홀더 보상이 줄어 신뢰가 깨진다 |

### 1.3 런치패드 통합 수수료 (Partner fee)

| 항목 | 내용 |
|---|---|
| Web2 비유 | 토스페이먼츠가 쇼핑몰 솔루션(카페24)에 붙어 결제 건마다 수수료를 나누는 구조. Stripe Connect의 플랫폼 수수료 |
| 요율 | 런치패드를 통해 등록된 런치는 본드의 0.5% (`partner_fee_bps = 50`), 또는 월정액 계약 |
| 발생 시점 | `register_launch` 시 본드 예치와 동시에 |
| 개발할 것 | (a) `Launch`에 `partner: Option<Pubkey>` 필드. (b) `register_launch`에 선택 인자 `partner_code`. (c) `Protocol`에 파트너 화이트리스트와 파트너별 분배율. (d) 파트너 몫은 파트너 지갑으로, 우리 몫은 `fee_vault`로. (e) 위젯이 `partner_code`를 URL 파라미터로 실어 보냄 |
| 해커톤 범위 | (a)(b)만. 화이트리스트와 분배는 v2. 필드만 미리 넣어두면 마이그레이션이 없다 |

### 1.4 등급 API 구독 (Data licensing)

| 항목 | 내용 |
|---|---|
| Web2 비유 | NICE·KCB가 은행에 신용조회 건당 과금. Clearbit·ZoomInfo의 데이터 API 구독 |
| 요율 | 월정액. 렌딩·지갑·애그리게이터 대상. 6개월 이력이 쌓인 뒤 |
| 개발할 것 (v1) | 공개 엔드포인트 3개와 배지 SVG. 인증 없음 |
| 개발할 것 (v2) | API 키 발급, 키별 rate limit, 사용량 집계 테이블, 무료 티어(배지)와 유료 티어(전체 이력 JSON) 분리 |
| 설계상 주의 | 원천 데이터는 전부 온체인 계정에 있다. 우리 서버가 죽어도 남이 등급을 계산할 수 있다. 우리가 파는 것은 "편의와 SLA"이지 "독점 데이터"가 아니다. Web2의 공공데이터 API 사업자와 같은 위치 |

### 1.5 받지 않는 것

**등록 수수료를 받지 않는다.** 팀은 돈을 내는 게 아니라 걸고, 약속을 지키면 보험료의 90%를 가져간다. 개발상 의미: `register_launch`에는 수수료 전송이 없다(파트너 경유 시 1.3만 예외).

### 1.6 수익 흐름 한눈에

```
홀더 → buy_coverage → 보험료 100
                         ├─ 10 → fee_vault (수익원 1)
                         └─ 90 → bond_vault (팀 적립)

Breach → resolve_epoch → bond_vault 잔액
                         ├─ coverage_sold → 홀더 (claim)
                         └─ 나머지 R
                              ├─ R×10% → fee_vault (수익원 2)
                              └─ R×90% → 홀더 (claim, pro-rata)

파트너 경유 register_launch → 본드 × 0.5%
                         ├─ 파트너 몫 → 파트너 지갑
                         └─ 우리 몫 → fee_vault (수익원 3)
```

---

## 2. 시스템 구성 (Web2 대응)

```
┌─ 프론트 (Next.js) ─────────────────────────────┐   Web2: 쇼핑몰 프론트 + Trustpilot 위젯
│ 목록 · 상세 · 보호 구매 · 팀 등록 · 임베드 위젯       │
└──────────────┬────────────────────┬────────────┘
               │ RPC + 지갑 서명      │ REST
┌──────────────▼──────────┐  ┌──────▼─────────────┐
│ 온체인 프로그램 (Anchor)   │  │ 인덱서 + API (TS)    │
│ = 백엔드 + DB + 결제 처리기 │  │ = 읽기 리플리카 + ETL  │
│   (Stripe + Postgres)     │  │   + 공개 API          │
└──────────────┬──────────┘  └────────────────────┘
               │ 누구나 호출
┌──────────────▼──────────┐
│ 크랭커 (스크립트)          │   Web2: 공개 cron. 우리도 돌리고 남도 돌릴 수 있음
└─────────────────────────┘
```

| 구성요소 | Web2 대응 | 개발 비중 | 담당 |
|---|---|---|---|
| 온체인 프로그램 | 백엔드 서버 + DB + 결제. 단, 코드가 공개되고 누구나 호출한다 | 55% | Rust/Anchor |
| 인덱서 + API | 읽기 전용 리플리카 + 배치 ETL + 공개 REST | 15% | TS/Node |
| 프론트 + 위젯 | 쇼핑몰 프론트 + 임베드 위젯 | 25% | Next.js |
| 크랭커 | cron job | 5% | TS 스크립트 |

온체인 프로그램을 백엔드에 빗대되 세 가지가 다르다. (1) 함수 호출마다 호출자가 지갑으로 서명한다. 세션이나 JWT가 없다. (2) DB 행(계정) 생성에 보증금(rent)이 들고 호출자가 낸다. (3) 코드가 배포되면 누구나 읽고 호출할 수 있어 "관리자만 호출" 같은 제한은 코드 안에서 서명자 검사로 해야 한다.

---

## 3. 온체인 프로그램 상세

### 3.1 데이터 모델 (계정 = 테이블 행)

PDA(Program Derived Address)는 "시드로 결정되는 기본키"다. `Launch`의 키는 토큰 민트 주소이므로 한 토큰당 런치 하나가 보장된다.

**Protocol** (싱글턴, 시드 `["protocol"]`) — Web2: 설정 테이블 + 관리자 계정

| 필드 | 타입 | 설명 |
|---|---|---|
| admin | Pubkey | 수수료 출금·파라미터 변경 권한 |
| fee_vault | Pubkey | 수수료 USDC 토큰 계정 |
| premium_fee_bps | u16 | 1000 |
| slash_fee_bps | u16 | 1000 |
| partner_fee_bps | u16 | 50 |
| r_min_bps | u16 | 50 (월 0.5%) |
| r_max_bps | u16 | 1500 (월 15%) |
| epoch_slots | u64 | 에포크 길이. 30일 ≈ 6,480,000 slot. 데모는 1,500 slot(약 10분) |
| total_epochs | u8 | 6 |
| min_bond | u64 | 최소 본드 (USDC 6 decimals) |

**Launch** (시드 `["launch", mint]`) — Web2: 가맹점 계정 + 보증금 잔액 + 신용점수 원천 데이터

| 필드 | 타입 | 설명 |
|---|---|---|
| team | Pubkey | 팀 지갑. 본드 회수 권한 |
| mint | Pubkey | 토큰 민트 |
| partner | Option<Pubkey> | 런치패드 (수익원 3) |
| bond_vault | Pubkey | 본드 USDC 토큰 계정 (프로그램이 authority) |
| bond_balance | u64 | 본드 + 적립 보험료 |
| covenants | CovenantSet | 5종 활성 플래그 + 파라미터 (3.3 참조) |
| current_epoch | u8 | 0..6 |
| status | enum | Active / Completed / Breached |
| passed_epochs | u8 | 등급 입력 1 |
| rate_sum_bps | u32 | 에포크 마감 r 합계. 평균 = rate_sum / passed_epochs (등급 입력 2) |
| active_covenant_count | u8 | 등급 입력 3 |
| breached_at_epoch | Option<u8> | 파기 에포크 |

**Epoch** (시드 `["epoch", launch, index]`) — Web2: 월별 보험 계약 + 인수 사진

| 필드 | 타입 | 설명 |
|---|---|---|
| launch | Pubkey | |
| index | u8 | |
| start_slot, end_slot | u64 | |
| snapshot | Snapshot | 약속 5종 기준값 (3.3) |
| coverage_sold | u64 | 팔린 커버리지 합계 |
| premium_collected | u64 | 이 에포크 보험료 합계 (수수료 제외 전) |
| result | enum | Open / Passed / Breached |
| payout_per_unit | u64 | Breached 시 커버리지 1당 지급액 (1e6 스케일). 커버리지 원금 + 잔여 본드 배분 |
| closing_rate_bps | u16 | 마감 시점 r. 등급용 |

**Coverage** (시드 `["coverage", epoch, buyer]`) — Web2: 보험 증권

| 필드 | 타입 | 설명 |
|---|---|---|
| epoch | Pubkey | |
| buyer | Pubkey | |
| amount | u64 | 커버리지 |
| premium_paid | u64 | |
| claimed | bool | |

같은 사람이 같은 에포크에 두 번 사면 `amount`와 `premium_paid`를 누적한다. 증권을 여러 장 발급하지 않는다.

### 3.2 인스트럭션 (= API 엔드포인트)

| # | 인스트럭션 | 서명자 | 전제 조건 | 하는 일 | Web2 대응 |
|---|---|---|---|---|---|
| 0 | `initialize_protocol` | admin | 1회 | Protocol 계정 생성, 파라미터 설정 | 서비스 초기 설정 |
| 1 | `register_launch` | team | mint당 1회, bond ≥ min_bond | Launch 생성, 본드 USDC 전송, 파트너 수수료 분리, Epoch 0 생성 + 스냅샷 | 가맹점 가입 + 보증금 납부 + 첫 달 계약 |
| 2 | `open_epoch` | 누구나 | 이전 Epoch이 Passed, current_epoch < total | 새 Epoch 생성 + 스냅샷 | 다음 달 계약 갱신 |
| 3 | `buy_coverage` | buyer | Epoch Open, 현재 slot < end_slot, coverage_sold + amount ≤ bond_balance | r 계산, 보험료 징수(10% fee_vault, 90% bond_vault), Coverage 생성/누적 | 보험 가입 + 결제 |
| 4 | `resolve_epoch` | 누구나 | Epoch Open, 현재 slot ≥ end_slot | 약속 5종 검증 → Passed 또는 Breached. Breached면 payout_per_unit 계산, 슬래시 수수료 전송 | 월말 정산 배치 |
| 5 | `claim` | buyer | Epoch Breached, Coverage.claimed == false | amount × payout_per_unit 지급 | 보험금 청구 |
| 6 | `withdraw_bond` | team | Launch Completed (6 에포크 Passed) | bond_balance 전액 팀에게 전송 | 보증금 반환 |
| 7 | `withdraw_fees` | admin | | fee_vault → admin 지정 계좌 | 정산 출금 |

권한 검사는 전부 코드 안에서 한다. Web2의 미들웨어 `requireRole('admin')`에 해당하는 것이 Anchor의 `has_one = admin` 제약이다.

### 3.3 약속 5종 검증 로직

Web2 비유는 GitHub 브랜치 보호 규칙이다. 규칙을 켜두면 사람이 감시하지 않아도 시스템이 막는다. 차이는 우리는 막는 게 아니라 **위반을 사후에 판정하고 돈으로 정산**한다는 것이다. 그래서 "인수 사진"(스냅샷)이 필요하다.

| # | 약속 | 파라미터 | 스냅샷에 저장 | resolve에서 비교 | 전달할 계정 |
|---|---|---|---|---|---|
| 1 | 업그레이드 권한 불변 | program_id, expected_authority | 없음 (등록 시 expected 고정) | ProgramData.upgrade_authority == expected | 프로그램의 ProgramData |
| 2 | 민트 권한 없음 | 없음 | 없음 | Mint.mint_authority == None | Mint |
| 3 | 트레저리 유출 상한 | treasury_ata, max_outflow | treasury 잔고 | snapshot − current ≤ max_outflow | 트레저리 토큰 계정 |
| 4 | 팀 지갑 무매도 | team_atas[≤4], unlock_slot | 각 잔고 | current ≥ snapshot (unlock_slot 이전이면) | 팀 토큰 계정들 |
| 5 | LP 락 유지 | lp_ata | 잔고 | current ≥ snapshot | LP 토큰 계정 |

구현 규칙:
- 활성화된 약속만 검사한다. 비활성 약속의 계정은 전달하지 않아도 된다(`remaining_accounts`로 받고 인덱스를 covenants 플래그 순서로 고정).
- 전달된 계정의 주소가 Launch에 등록된 주소와 같은지 반드시 검사한다. 안 하면 크랭커가 가짜 계정을 넣어 판정을 조작할 수 있다. Web2로 치면 "클라이언트가 보낸 user_id를 믿지 말고 세션에서 꺼내라"와 같은 원칙이다.
- 하나라도 위반이면 Breached. 부분 파기 가중치는 v2.
- 약속 4의 unlock_slot이 에포크 중간에 오면 그 에포크는 검사하지 않는다(보수적으로 Pass 처리).

### 3.4 가격 공식 (서지 프라이싱)

```
u_bps = coverage_sold × 10_000 / bond_balance            (구매 직전 값, 0..10_000)
r_bps = r_min_bps + (r_max_bps − r_min_bps) × u_bps² / 10_000²
premium = amount × r_bps / 10_000
fee     = premium × premium_fee_bps / 10_000
to_bond = premium − fee
```

- 전부 정수 연산. `u_bps²`는 u128로 계산한다. 나눗셈은 내림.
- 검증: u=0.3 → r=0.5%+14.5%×0.09=1.805% → `r_bps=180`(내림). u=0.8 → 9.78% → `r_bps=978`.
- 대량 구매가 u를 크게 올려도 구매 직전 u로만 계산한다(v1 단순화). Web2의 "장바구니에 담을 때 가격 고정"과 같다. 구간 적분은 v2.
- `coverage_sold + amount > bond_balance`면 거부. 좌석보다 많이 팔지 않는 항공사와 같다.

### 3.5 정산 공식

**Passed**: 돈이 움직이지 않는다. 보험료는 이미 bond_vault에 있다. `passed_epochs += 1`, `rate_sum_bps += closing_rate_bps`. 6번째면 `status = Completed`.

**Breached**:
```
remaining   = bond_balance − coverage_sold
slash_fee   = remaining × slash_fee_bps / 10_000
bonus_pool  = remaining − slash_fee
payout_per_unit = (coverage_sold + bonus_pool) × 1_000_000 / coverage_sold
```
`claim`: `payout = amount × payout_per_unit / 1_000_000`. 마지막 청구자의 반올림 오차는 남겨두고 admin이 회수한다. `coverage_sold == 0`이면 `bonus_pool` 전액이 fee_vault로 간다(보호를 산 사람이 없으면 배분 대상이 없다).

### 3.6 상태 머신

```
Launch:  Active ──(6× Passed)──▶ Completed ──(withdraw_bond)──▶ [끝]
           └──(Breached)──▶ Breached ──(claim ×N)──▶ [끝]

Epoch:   Open ──(resolve, 전부 통과)──▶ Passed
           └──(resolve, 하나라도 위반)──▶ Breached
```
Web2로는 주문 상태 `결제완료 → 배송중 → 배송완료 / 환불` 흐름과 같다. 역방향 전이는 없다.

### 3.7 에러 케이스 (반드시 테스트)

| 코드 | 상황 |
|---|---|
| BondTooSmall | bond < min_bond |
| LaunchExists | 같은 mint로 두 번 등록 |
| EpochNotOpen | 닫힌 에포크에 구매 |
| EpochNotEnded | end_slot 전에 resolve |
| EpochAlreadyResolved | resolve 두 번 |
| CoverageExceedsBond | 좌석 초과 판매 |
| TeamCannotBuy | 팀 지갑이 자기 런치 보호 구매 |
| AccountMismatch | resolve에 전달된 계정이 등록된 주소와 다름 |
| NotBreached | Passed 에포크에 claim |
| AlreadyClaimed | claim 두 번 |
| LaunchNotCompleted | 6 에포크 전에 withdraw_bond |
| Unauthorized | admin 아닌 자가 withdraw_fees |

---

## 4. 인덱서 + 등급 API

Web2 비유: 결제 DB의 읽기 리플리카에서 배치로 집계해 공개 API를 내는 것. 원천은 온체인이고 우리는 편의를 판다.

### 4.1 파이프라인

1. Helius RPC `getProgramAccounts`로 `Launch`, `Epoch` 전체를 폴링(1분). 데모 규모에서는 충분하다. v2에서 웹훅.
2. Postgres(또는 SQLite) 테이블: `launches`, `epochs`, `coverages`, `fees_daily`.
3. 등급 계산은 조회 시점에 한다. 캐시 60초.

### 4.2 등급 공식

```
score = 50 × passed_epochs / 6
      + 35 × (1 − avg_rate_bps / r_max_bps)
      + 15 × active_covenant_count / 5
grade = AAA(≥85) AA(≥75) A(≥65) BBB(≥55) BB(≥45) B(≥35) CCC(≥20) 
      breached_at_epoch가 있으면 무조건 D
```
avg_rate_bps = rate_sum_bps / passed_epochs (passed_epochs = 0이면 r_max로 간주).

### 4.3 엔드포인트

| 메서드 | 경로 | 응답 | Web2 비유 |
|---|---|---|---|
| GET | `/launches` | 목록: mint, name, grade, current_rate_bps, bond_balance, utilization_bps, passed_epochs | 상품 목록 API |
| GET | `/launches/:mint` | 상세 + epochs[] + covenants + 현재 온체인 값 | 상품 상세 |
| GET | `/launches/:mint/badge.svg` | 등급 배지. `Cache-Control: max-age=300` | Trustpilot 위젯 이미지 |
| GET | `/fees/daily` | 수익 대시보드용 (admin) | 정산 리포트 |

### 4.4 완료 조건

- devnet에 런치 3개가 있을 때 목록이 60초 내 갱신된다.
- 배지 SVG가 GitHub README와 트위터 카드에서 렌더된다.
- 온체인 값과 API 값이 불일치하면 API 응답에 `stale: true`를 붙인다.

---

## 5. 프론트 + 위젯

Web2 비유: 결제가 붙은 쇼핑몰 프론트. 지갑 연결이 로그인이고, 트랜잭션 서명이 결제 확인 팝업이다.

| 화면 | 보여줄 것 | 호출 | 완료 조건 |
|---|---|---|---|
| 런치 목록 | 등급 배지, r, 본드, 이용률 게이지, 지킨 에포크 | API | 등급순 정렬, 3초 내 로드 |
| 런치 상세 | 약속 5개 각각 "기준값 / 현재값 / 상태", 에포크 타임라인, 곡선 위 현재 위치 | API + RPC 실시간 | 현재값은 RPC로 직접 읽어 API보다 신선 |
| 보호 구매 | 금액 입력 → 보험료·파기 시 수령액 미리보기 → 서명 | `buy_coverage` | 미리보기 수식이 온체인과 1 단위 이내 일치 |
| 팀 등록 | mint, program, treasury, team ATAs, LP ATA, 약속 토글, 본드 | `register_launch` | 잘못된 주소는 서명 전에 RPC로 검증해 거부 |
| 임베드 위젯 | 배지 + "보호 구매" 버튼. iframe. `?partner=` 파라미터 | 상세 페이지로 링크 | 런치패드 페이지에 한 줄로 삽입 |

지갑: Phantom, Solflare. 트랜잭션에 priority fee를 붙인다(Superteam 가이드 권장). 실패 시 에러 코드를 3.7의 한국어 메시지로 매핑한다.

---

## 6. 크랭커

Web2 비유: 월말 정산 cron. 다른 점은 아무나 돌릴 수 있고, 우리는 그중 하나일 뿐이다.

- 1분마다 모든 `Epoch(Open)` 중 `end_slot ≤ 현재 slot`인 것을 찾아 `resolve_epoch` 호출. Passed면 이어서 `open_epoch`.
- 필요한 계정 목록은 Launch.covenants에서 조립한다.
- 실패한 트랜잭션은 로그로 남기고 다음 주기에 재시도. 멱등성은 온체인의 `EpochAlreadyResolved`가 보장한다.

---

## 7. 테스트 계획

Anchor 테스트(litesvm 또는 bankrun). 두 경로를 끝까지 돌린다.

**경로 A: 6개월 전부 Pass**
1. initialize → register(본드 50,000) → 홀더 3명 buy(합계 40,000) → 보험료·수수료 금액 검증
2. slot 전진 → resolve → Passed, passed_epochs=1, rate_sum 갱신
3. open_epoch ×5, 각각 resolve Passed
4. withdraw_bond → 팀 잔고 = 50,000 + 적립 보험료
5. fee_vault 잔고 = 총 보험료의 10%

**경로 B: 2개월째 트레저리 초과 인출**
1. 경로 A의 1~2
2. open_epoch → 홀더 buy → 트레저리에서 max_outflow 초과 전송
3. resolve → Breached, payout_per_unit 검증
4. 홀더 3명 claim → 합계 = coverage_sold + bonus_pool (오차 ≤ 3)
5. fee_vault 증가분 = remaining × 10%
6. withdraw_bond 실패(LaunchNotCompleted)

**경로 C: 3.7의 에러 12개 각각 1회**

**경로 D: 가격 공식 단위 테스트**. u = 0, 0.3, 0.5, 0.8, 1.0에서 r_bps가 각각 50, 180, 412, 978, 1500.

---

## 8. 데모 시나리오 (제출 영상 3분)

1. 팀이 devnet에서 토큰 런치 후 본드 5,000 USDC 예치, 약속 5종 켬. (20초)
2. 지갑 3개가 보호 구매. 곡선 위 점이 오르는 것을 상세 화면에서 보여줌. (30초)
3. 10분 에포크 종료. 크랭커 로그에 resolve → PASS. 보험료가 본드에 쌓임. (20초)
4. 2번째 에포크 중 팀이 트레저리에서 상한 초과 인출. 상세 화면의 약속 3이 빨간색으로. (15초)
5. resolve → BREACH. 홀더 3개 지갑 잔고 증가, 카드가 D로. (30초)
6. 옆에 6개월 지킨 런치의 AAA 배지와 `/launches/:mint` JSON 응답. (20초)

---

## 9. 스택과 환경

- Anchor 0.31+, Solana CLI v3, Rust stable
- `create-solana-dapp` `nextjs-anchor` 템플릿
- Helius devnet RPC (무료 키)
- 인덱서: Node 20, TypeScript, Postgres 또는 SQLite
- 테스트: litesvm 또는 bankrun
- USDC devnet 민트는 우리가 만든 테스트 민트 사용. 프로그램은 민트 주소를 Protocol에 저장해 어떤 SPL 토큰이든 받게 한다.

---

## 10. 4주 일정과 담당

| 주 | 온체인 | 인덱서/API | 프론트 | 완료 기준 |
|---|---|---|---|---|
| 1 | 인스트럭션 0~7, 약속 검증, 테스트 A·B·C·D | 스키마, 폴링 | 지갑 연결, 목록 뼈대 | 로컬 테스트 전부 통과 |
| 2 | devnet 배포, 크랭커 | 등급 API, 배지 SVG | 상세, 보호 구매 | devnet 런치 3개가 10분 에포크로 자동 정산 |
| 3 | 버그 수정, 파트너 필드 | fees/daily | 팀 등록, 위젯 | 외부인이 devnet에서 보호 구매 가능 |
| 4 | 동결 | 동결 | 동결 | 영상, 덱, 제출 |

---

## 11. 결정이 필요한 것 (개발 시작 전 확정)

1. `min_bond` 초기값. 제안: 5,000 USDC.
2. 약속 4의 팀 지갑 최대 개수. 제안: 4개 (계정 수 제한 때문).
3. Breach 시 `coverage_sold == 0`인 경우 잔여 본드 전액을 fee_vault로 보낼지, 팀에게 돌려줄지. 제안: fee_vault(약속을 깬 팀에게 돌려주지 않는다).
4. 데모 에포크 길이. 제안: 1,500 slot.
5. 파트너 수수료 분배율. 제안: 파트너 50 / 우리 50. v2.

---

## 12. 용어 한 줄 사전

| 용어 | 뜻 | Web2 |
|---|---|---|
| PDA | 시드로 결정되는 계정 주소 | 자연키 기반 기본키 |
| ATA | 지갑의 특정 토큰 잔고 계정 | 통화별 하위 계좌 |
| slot | 약 400ms 단위 블록 시간 | 서버 타임스탬프 |
| bps | 1/10,000 | 0.01% |
| CPI | 프로그램이 다른 프로그램 호출 | 내부 서비스 간 API 호출 |
| rent | 계정 유지 보증금 | 스토리지 요금 선납 |
| remaining_accounts | 가변 길이 계정 목록 | 가변 인자 |
