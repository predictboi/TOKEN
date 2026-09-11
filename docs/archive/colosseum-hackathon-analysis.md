# Solana Colosseum 해커톤 분석 및 아이디어 검토

작성일: 2026-09-09
대상: 다가오는 Colosseum 해커톤 참가 준비 (온체인 신용등급 × 예측시장 아이디어)

---

## 1. 다가오는 해커톤 팩트 시트

| 항목 | 내용 |
|---|---|
| 이름 | Crypto World's Fair (Colosseum 최초의 멀티 체인 해커톤) |
| 기간 | 2026-09-14 ~ 2026-10-12 (4주, 온라인) |
| 참여 생태계 | Solana, Ethereum, Hyperliquid, Base, Tempo, Arbitrum, Zcash, Robinhood Chain |
| Solana 트랙 상금 | 총 $100,000, Solana 통합 상위 10팀에 배분 (Solana Foundation 후원) |
| 액셀러레이터 | 선발 시 Colosseum 벤처 부문에서 $250,000 프리시드 투자, 8주 하이브리드 프로그램 |
| 자격 | 아직 의미 있는 외부 자금을 조달하지 않은 신생 스타트업. 기존 코드 사용 가능하나 사전 개발 내역 공개 필수 |
| 제출물 | 제품 설명, 팀 배경, GitHub 저장소, 2~3분 피치 영상, 3분 제품 데모, GTM 전략 |
| 심사 기준 (공식) | ① 창업자-시장 정합성과 동기 ② 고유한 인사이트와 경쟁 우위 ③ 제품 품질과 실행 속도 ④ 시장 규모와 성장성 ⑤ 커뮤니케이션 명확성 ⑥ 사업 타당성 ⑦ 유저 트랙션과 매출 |

심사 방식에 대해 알려진 사실:
- 심사위원은 프로젝트당 3~5분을 씁니다. 60초 안에 무엇을 만들었는지 이해되지 않으면 탈락입니다.
- 데모 영상이 곧 제출물입니다. devnet 배포가 필수이고 localhost 데모는 감점입니다.
- 풀타임으로 창업할 의지와 실현 가능한 비즈니스 모델이 있는 팀에게 상을 줍니다.
- 기능은 하나만 잘 만들고 UX를 완성하라는 조언이 반복됩니다. 스마트컨트랙트는 2~3개 인스트럭션 수준의 스코프를 권장합니다.

---

## 2. 역대 우승작 및 액셀러레이터 코호트 분석

### 2.1 그랜드 챔피언 계보

| 해커톤 | 시기 | 제출 수 | 그랜드 챔피언 | 분야 |
|---|---|---|---|---|
| Renaissance | 2024 상반기 | 1,071 | Ore (PoW 채굴 토큰) | 인프라/통화 |
| Radar | 2024 하반기 | 1,359 | Reflect (헤지 담보 스테이블코인 환전) | DeFi |
| Breakout | 2025 상반기 | 1,412 | TapeDrive (탈중앙 스토리지) | 인프라 |
| Cypherpunk | 2025 하반기 | 1,576 | Unruggable (하드웨어 지갑) | 보안/인프라 |
| Frontier | 2026 상반기 | 2,857 | CrowdBrain (로봇 원격조작 DePIN) | DePIN |

그랜드 챔피언 5개 중 4개가 인프라·DePIN·보안입니다. DeFi 단독 앱이 최상위를 차지한 경우는 Reflect 하나뿐입니다. 상금 최상위를 노리기보다 Solana 트랙 상위 10 진입과 액셀러레이터 선발이 현실적인 목표입니다.

### 2.2 액셀러레이터 코호트 (투자 대상) 전체 목록

**Cohort 1 (Renaissance, 10팀)**: Ore, Urani(MEV 보호 스왑), DBunker(DePIN 파생상품), DeCharge(EV 충전), Torque(온체인 유저 획득), Legends of the Sun(게임), MeshMap(3D 매핑 DePIN), BlockMesh(대역폭 DePIN), Banger(트윗 마켓), Rakurai(밸리데이터 클라이언트)

**Cohort 2 (Radar, 13팀)**: GreenKWh(에너지 DePIN), AlphaFC(팬 운영 축구단), Darklake(ZK 다크풀), Supersize(온체인 게임), Tokamai(개발 모니터링), Txtx(인프라 런북), The Arena(PvP 트레이딩 게임), Reflect(스테이블코인), Hylo(LST 담보 스테이블코인), **Trenches.top(애널리스트 평판 토큰화)**, AdX(광고 거래소), Watt(변동성 파밍), Pregame(P2P 스포츠 베팅)

**Cohort 3 (Breakout, 10팀)**: CargoBill(공급망 결제), Crypto Fantasy League, Decal(가맹점 결제·로열티), LocalPay(신흥국 스테이블코인 결제), MetEngine(LP 자동화), Slant(온체인 분석), TapeDrive, Tempo(트레이딩 봇), **Trepa(정밀 예측시장)**, TypeX(키보드 지갑)

**Cohort 4 (Cypherpunk, 11팀)**: MCPay(x402 에이전트 결제), **Synthesis(예측시장 집계 트레이딩)**, Unruggable, Rekt(게임화 트레이딩), Cloak(ZK 프라이버시), Credible(인도 송금), **Yumi Finance(온체인 BNPL)**, Superfan(아티스트-팬 금융), Kormos(부분지급준비 수익), **Capitola(예측시장 메타 애그리게이터)**, Archer(배치 옥션 거래소)

**Cohort 5 (Frontier, 21팀)**: CrowdBrain, **Cesto(RWA+예측시장 테마 바스켓)**, Flovia(에이전트 결제 분석), **Senthos(예측시장 구조화 상품)**, DashX(신흥국 스테이블코인 결제), Dropset(온체인 FX), WeLikeSports(판타지 스포츠), ODL(RWA 청산), Housd(부동산 토큰화), JK Index(TCG 마켓), Fraudsworth(마켓 인텔리전스 게임), Clawpump(에이전트 금융), One Arena(TCG), Stablecorp(원격 창업자 인프라), The Syndicate(마피아 카드게임), Nomu(공급망), Mana(디아스포라 네오뱅크), Traded.gg(TCG 집계), Peaks(에이전트 포트폴리오), Laso(프라이버시 결제), Zoneless(USDC Stripe Connect 대체)

### 2.3 코호트에서 읽히는 패턴 7가지

1. **예측시장은 3개 코호트 연속 선발.** Trepa(3기) → Synthesis, Capitola(4기) → Senthos, Cesto, Peaks(5기). 단, 선발된 팀은 전부 "예측시장 그 자체"가 아니라 **예측시장 위에 올라가는 레이어**입니다. 집계(Capitola, Synthesis), 구조화·트랜치(Senthos), 정밀 예측(Trepa), 바스켓(Cesto). Polymarket 클론은 뽑히지 않습니다.
2. **스테이블코인·결제가 가장 두꺼운 카테고리.** 매 코호트 2~4팀. 신흥국 코리더, 공급망, 디아스포라 등 구체적 세그먼트가 있는 팀만 뽑힙니다.
3. **신용·대출 계열은 소수지만 꾸준히 존재.** Yumi Finance(BNPL, Cypherpunk DeFi 트랙 1위), Kormos, Split Finance, Pye(스테이킹 수익 선매도), attn.markets(온체인 매출 토큰화, Cypherpunk Undefined 트랙 1위), 액셀러레이터 외부로는 Huma, Credix.
4. **평판·투명성 계열은 있으나 아직 대표 승자가 없음.** Trenches.top(애널리스트 평판), Attest Protocol(Public Good), Sudont(보안), Watchtower(RWA 준우승). Colosseum이 Cypherpunk 때 직접 공개한 RFP에 "**Onchain transparency ratings: 정상 프로젝트와 스캠을 구분하는 등급**"과 "**Permissionless prediction markets**"가 나란히 들어 있습니다. 이 자리는 아직 비어 있습니다.
5. **그랜드 챔피언은 인프라·DePIN·하드웨어 편향.** 심사위원단이 "Solana 생태계 전체를 전진시키는 것"을 최상위로 봅니다. DeFi 앱은 트랙 상위 진입 + 액셀러레이터 선발이 현실적 경로입니다.
6. **비즈니스 모델이 명확한 팀만 살아남음.** 코호트 소개문에는 예외 없이 수익 구조가 한 줄로 적혀 있습니다("이자 기반 수익", "수수료", "프리미엄").
7. **5기에서 게임·수집품(TCG)이 급증(4팀).** Solana Foundation의 소비자 앱 밀어주기와 맞물린 흐름이라 DeFi 팀은 오히려 경쟁이 상대적으로 덜한 구간입니다.

---

## 3. 아이디어 분석: 예측시장 기반 온체인 프로젝트 신용등급

### 3.1 아이디어 재정의 (제출문 기준으로 정리)

- 프로젝트가 등급 평가 수수료를 내고 등록한다.
- 매월 프로젝트가 충족해야 할 온체인 요건을 정하고, 인덱스가 그 달의 Pass / Default를 판정한다.
- 각 달마다 Pass/Default 예측시장이 열린다. Default 베팅자는 고위험 고수익, Pass 베팅자는 패시브 인컴을 노린다.
- 스테이크된 자금은 Meteora 등 LP에 예치되어 수익을 만든다.
- 연속 Pass가 누적될수록 신용등급이 올라간다. Moody's, S&P 같은 역할을 시장이 대신한다.

한 줄로 하면 "**시장이 가격을 매기는 Solana 프로젝트 신용등급**"입니다. 이 한 줄은 심사위원이 60초 안에 이해할 수 있습니다.

### 3.2 강점

- **Colosseum RFP와 직접 정합.** "Onchain transparency ratings"와 "Permissionless prediction markets" 두 RFP를 하나의 제품으로 묶습니다. 심사위원이 이미 원한다고 말한 물건입니다.
- **예측시장 트렌드에 올라타되 레이어가 다름.** 2.3의 1번 패턴처럼 "예측시장을 도구로 쓰는 새 시장(신용)"이라 클론이 아닙니다. Senthos, Cesto, Capitola와 경쟁이 아니라 이들이 소비할 수 있는 원천 시장입니다.
- **수요의 근거가 실재함.** 2026년 DeFi TVL이 매월 하락하고 상반기 해킹 121건, 손실 $9.4억. Polymarket도 3개월간 두 번 해킹. "투자자가 똑똑해진다"는 전제가 뉴스로 뒷받침됩니다.
- **기존 온체인 신용점수와 차별화.** Spectral, Cred Protocol은 **지갑** 신용점수입니다. Credora는 **전문가 합의** 등급, Exponential·DeFiSafety는 **기관식 체크리스트**입니다. **프로젝트 단위, 시장 가격 기반, 월간 롤링, 누적 이력**이라는 조합은 비어 있습니다.
- **수익 모델이 두 갈래.** 프로젝트 등록·평가 수수료 + 정산 시 스프레드/수익 수수료. 코호트 소개문에 적을 한 줄이 이미 있습니다.
- **Solana 네이티브인 이유가 있음.** 월간 시장 수천 개를 저비용으로 굴리고, 온체인 지표를 실시간 검증하려면 저수수료·고속 체인이 필요합니다.

### 3.3 구조적 약점과 리스크 (심사위원이 반드시 물어볼 것)

1. **판정(Resolution) 문제가 제품의 전부입니다.** Colosseum의 예측시장 가이드가 정확히 이 질문을 던집니다. "오늘 믿음에 가격을 매기고, 내일 진실은 누가 결정하는가." TVL, 거래량, 활성 지갑은 워시가 쉽습니다. 프로젝트가 수수료를 내고 자기 시장을 만든 뒤 지표를 부풀리면 Default 베팅자가 항상 지는 구조가 됩니다. 요건을 "조작 비용이 큰 온체인 사실"로 제한하지 않으면 시장은 신뢰를 잃습니다.
2. **인센티브가 양방향으로 왜곡됩니다.** 프로젝트 팀은 내부 정보로 자기 Pass 측에 베팅할 수 있습니다. 반대로 Default 측 대형 포지션은 프로젝트를 공격할(덤핑, 거버넌스 공격, FUD) 유인이 생깁니다. Polymarket의 정치 시장과 달리 결과에 개입 가능한 당사자가 시장 안에 있습니다.
3. **"Default = 도박, Pass = 패시브 인컴" 프레이밍은 수학적으로 성립하지 않습니다.** 확률이 가격에 반영되면 대부분 Pass하는 프로젝트의 Pass 측 수익률은 거의 0에 수렴하고, Default 측은 거의 항상 잃습니다. 유동성이 한쪽으로 쏠리고 시장이 죽습니다. 이 구조는 실제로는 **보험 또는 CDS**입니다. Default 측 스테이크는 보험료, Pass 측 스테이크는 인수 자본입니다. 그리고 CDS 스프레드가 곧 시장 기반 신용등급입니다. 이 사실을 숨기지 말고 피치의 중심에 두는 것이 좋습니다.
4. **신용등급의 순환성.** 시장 가격이 곧 부도 확률이면 별도의 "등급"이 왜 필요한지 물어볼 것입니다. 답은 "등급 = 시장 확률의 시계열 요약 + 이력 + 스테이크 규모(신뢰도)"이고, 다른 프로토콜(렌딩, 런치패드)이 읽을 수 있는 **온체인 어테스테이션**이라는 점입니다.
5. **Meteora LP 운용은 "패시브 인컴"과 충돌합니다.** 변동성 자산 풀에 넣으면 비영구 손실로 원금이 줄어듭니다. Pass 측이 원금 손실을 보면 제품 약속이 깨집니다. 스테이블 풀, 렌딩(Kamino), Meteora DAMM v2의 vault-backed 유휴자산 렌딩 같은 저위험 소스로 제한해야 합니다.
6. **규제.** 특정 기업의 부도에 베팅하는 시장은 CDS·보험·이벤트 컨트랙트 규제와 맞닿습니다. 미국 유저 차단 정책과 "프로젝트 자기 참여 금지" 규칙을 문서에 넣어야 합니다.
7. **콜드 스타트.** 초기 프로젝트가 수수료를 낼 이유가 없습니다. 무료 등급 + 자체 리스팅으로 시작하고, 런치패드·렌딩이 등급을 요구하기 시작하면 유료화하는 순서가 필요합니다.
8. **경쟁·대체재.** MetaDAO futarchy(의사결정 시장, Drift·Sanctum·Marinade 채택), Credora, Exponential.fi, DeFiSafety, Trenches.top, attn.markets, Polymarket 임의 이벤트 시장. 각각과 한 줄 비교표가 피치 덱에 있어야 합니다.

### 3.4 구조 개선 제안

**요건을 온체인에서 직접 검증 가능한 것으로 제한합니다.** 오프체인 지표는 v2로 미룹니다.

| 요건 유형 | 예시 | 검증 방법 | 조작 난이도 |
|---|---|---|---|
| 프로그램 권한 | 업그레이드 권한 미변경, 멀티시그 서명자 유지 | 계정 상태 직접 읽기 | 높음 |
| 트레저리 | 지정 지갑 잔고 ≥ 기준, 대량 유출 없음 | 계정 잔고·전송 기록 | 높음 |
| 토큰 언락 | 베스팅 계약 위반 없음, 팀 지갑 매도 없음 | 토큰 계정 추적 | 높음 |
| 온체인 매출 | 수수료 계정 유입 ≥ 기준 | 계정 유입 합산 | 중간 |
| 유동성 | 지정 풀 유동성 ≥ 기준 | 풀 계정 읽기 | 중간 (워시 가능) |
| 사용량 | 고유 지갑 수 | 인덱서 필요 | 낮음 (Sybil) |

**수수료를 "의무 셀프 스테이크"로 바꿉니다.** 프로젝트가 현금 수수료를 내는 대신 자기 Pass 측에 일정 금액을 의무 예치합니다. Default 시 슬래시되어 Default 측에 분배됩니다. 이렇게 하면 (a) 프로젝트가 skin in the game을 갖고, (b) "프로젝트가 돈 내고 좋은 등급 사는 것 아니냐"는 Moody's 식 이해상충 비판을 정면으로 피하며, (c) 콜드 스타트 시 수수료 없이 등록이 가능합니다.

**시장을 보험 구조로 명시합니다.** Default 측 = 보험료 납부(상한 손실, 고배율 보상). Pass 측 = 인수 자본(원금 + 운용 수익 + 보험료 배분). 운용 수익은 저위험 소스에서만 발생시키고, 심사위원에게는 "온체인 CDS 스프레드가 등급이다"라고 말합니다.

**등급 산식을 공개합니다.** 예: 연속 Pass 개월 수, 최근 6개월 시장 내재 부도확률 평균, 총 스테이크 규모(신뢰 구간), 셀프 스테이크 비율. 결과는 AAA~D 등급으로 온체인 어테스테이션에 기록해서 렌딩 LTV, 런치패드 게이팅, 지갑 경고 UI가 읽게 합니다.

**첫 고객을 좁힙니다.** 프로젝트 전체가 아니라 "최근 12개월 내 런치된 Solana 토큰 프로젝트"로 시작합니다. MetaDAO, Meteora DBC 출신 토큰이 후보입니다. 투자자와 런치패드가 명확한 구매자입니다.

### 3.5 해커톤 4주 스코프 (권장 MVP)

온체인 프로그램은 인스트럭션 4개로 제한합니다.

1. `register_project`: 요건 세트와 셀프 스테이크 예치
2. `open_epoch_market`: 월간 Pass/Default 시장 생성 (단순 풀 방식, 오더북 없음)
3. `stake`: Pass 또는 Default 측 예치
4. `resolve_and_settle`: 오라클 판정 후 정산, 등급 어테스테이션 갱신

오프체인 컴포넌트:
- 판정기: 온체인 계정을 읽어 요건 충족 여부를 계산하고 Switchboard 커스텀 피드 또는 서명된 결과로 제출
- 인덱서: 등급 계산, 프로젝트별 이력 페이지
- 프론트: 프로젝트 목록, 등급 카드, 시장 참여 화면 하나

Meteora 통합은 v1에서 인터페이스만 두고 실제 예치는 스테이블 vault 하나로 시연합니다. 데모에는 실제 Solana 프로젝트 3~5개를 등록해 devnet에서 한 에포크가 끝까지 도는 것을 보여줍니다.

주차별:
- 1주: 프로그램 4개 인스트럭션 + 테스트, 요건 3종(권한, 트레저리, 언락)만 구현
- 2주: 판정기와 인덱서, 등급 산식, devnet 배포
- 3주: 프론트, 실제 프로젝트 데이터로 시연 에포크, 피드백 공개 빌드
- 4주: 영상, 덱, GTM 문서, 버그 수정. 새 기능 추가 금지

### 3.6 심사 기준 7개에 대한 대응

| 기준 | 현재 상태 | 보완할 것 |
|---|---|---|
| 창업자-시장 정합성 | 투자자 관점 동기는 있음 | 팀에 리스크·신용 또는 DeFi 리서치 경력이 있으면 전면에 배치 |
| 고유 인사이트 | "시장이 등급을 매긴다" | "CDS 스프레드 = 등급, 셀프 스테이크 = 이해상충 제거"를 인사이트로 명문화 |
| 제품 품질·속도 | 미착수 | devnet에서 1 에포크 완주 데모 필수 |
| 시장 규모 | 수치 없음 | Solana 앱 연매출 $17억(attn.markets 인용치), 예측시장 프로젝트 450개 이상, 2026 해킹 손실 $9.4억을 근거로 제시 |
| 커뮤니케이션 | 현재 설명은 길고 프레이밍이 흔들림 | 한 줄 정의 + 보험 구조 도식 1장 |
| 사업 타당성 | 수수료 언급만 있음 | 셀프 스테이크 슬래시 수수료 + 정산 수수료 + 등급 API 구독의 3단 모델 |
| 트랙션 | 없음 | 4주 동안 실제 프로젝트 3~5개를 등록시키고 트위터에 공개 빌드 |

### 3.7 결론

아이디어의 방향은 Colosseum이 공개적으로 원한다고 말한 두 RFP의 교차점에 있고, 코호트 흐름(예측시장 레이어 + 투명성)과도 맞습니다. 다만 현재 형태로는 판정 조작, 이해상충, 한쪽으로 쏠리는 시장이라는 세 가지 구조적 질문에 답이 없습니다. "온체인 검증 가능한 요건만 사용", "수수료 대신 셀프 스테이크 슬래시", "보험 구조로 명시"라는 세 가지 변경으로 셋 다 해소됩니다. 이 변경을 반영한 4개 인스트럭션 MVP를 devnet에서 완주시키는 것이 Solana 트랙 상위 10과 액셀러레이터 인터뷰로 가는 가장 짧은 경로입니다.

---

## 출처

- [Crypto World's Fair Hackathon - Colosseum](https://colosseum.com/worldsfair)
- [Hackathon - Colosseum (심사 기준, 자격, 제출물)](https://colosseum.com/hackathon)
- [Colosseum on X: Crypto World's Fair 발표](https://x.com/colosseum/status/2095574551841112180)
- [How to Win a Colosseum Hackathon](https://blog.colosseum.com/how-to-win-a-colosseum-hackathon/)
- [SuperteamCanada: how-to-win-colosseum-hackathon](https://github.com/SuperteamCanada/how-to-win-colosseum-hackathon)
- [Colosseum Codex: Cypherpunk Hackathon, Project RFPs, Prediction Markets](https://blog.colosseum.com/cypherpunk-hackathon-project-rfps-prediction-markets/)
- [Announcing the Winners of the Solana Frontier Hackathon](https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/)
- [Announcing the Winners of the Solana Cypherpunk Hackathon](https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/)
- [Announcing the Winners of the Solana Breakout Hackathon](https://blog.colosseum.com/announcing-the-winners-of-the-solana-breakout-hackathon/)
- [Announcing the Winners of the Solana Radar Hackathon](https://blog.colosseum.com/announcing-the-winners-of-the-solana-radar-hackathon/)
- [Announcing the Winners of the Solana Renaissance Hackathon](https://blog.colosseum.com/announcing-the-winners-of-the-solana-renaissance-hackathon/)
- [Colosseum Accelerator Cohort 1](https://blog.colosseum.com/introducing-colosseum-accelerator-cohort-1/) · [Cohort 2](https://blog.colosseum.com/introducing-colosseum-accelerator-cohort-2/) · [Cohort 3](https://blog.colosseum.com/introducing-colosseum-accelerator-cohort-3/) · [Cohort 4](https://blog.colosseum.com/announcing-colosseums-accelerator-cohort-4/) · [Cohort 5](https://blog.colosseum.com/announcing-colosseums-accelerator-cohort-5/)
- [Solana Compass: Cohort 5 분석](https://solanacompass.com/news/colosseum-admits-21-startups-to-its-5th-accelerator-cohort-drawn-from-the-frontier-hackathon-and-eternal-sprint)
- [Trepa 소개](https://www.web3researchglobal.com/p/trepa)
- [Credora Consensus Ratings Protocol](https://www.prnewswire.com/news-releases/credora-unveils-the-credora-network-consensus-ratings-for-defi-302373640.html)
- [Exponential.fi Risk Rating](https://exponential.fi/learn/risk-rating) · [DeFiSafety](https://www.defisafety.com/)
- [ChainAware: DeFi 신용점수 플랫폼 비교](https://chainaware.ai/blog/defi-credit-score-comparison/)
- [MetaDAO futarchy - Blockworks](https://blockworks.com/news/understanding-futarchy-on-solana)
- [Huma Finance on Solana](https://blog.huma.finance/huma-finance-launches-on-solana)
- [Meteora DLMM / DAMM v2 개요](https://www.dextools.io/tutorials/what-is-meteora-dlmm-dynamic-bonding-curve-2026)
- [DefiLlama: Solana 예측시장](https://defillama.com/protocols/prediction-market/solana)
- [Solana 예측시장 현황 2026](https://sailgp.com/prediction-markets/crypto/solana)
- [Polymarket 2026년 6월 해킹](https://www.secureworld.io/industry-news/polymarket-hack-frontend-vulnerabilities)
- [DeFi TVL 2026 하락 및 해킹 손실](https://finance.yahoo.com/markets/crypto/articles/defi-total-value-locked-slides-072657247.html)
