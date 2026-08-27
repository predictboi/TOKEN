# Kaia 테스트넷 LS-LMSR 마켓 트레이딩 테스트 하네스

스테이징 퀘스트(`/quests/1787826370000044`)의 LMSR 마켓에 대해 **매수/매도 및
슬리피지 보호 동작**을 자동 검증하는 스크립트입니다.

- 마스터 지갑에서 **테스트 지갑 5개**를 결정적으로 파생 (재실행해도 동일 주소)
- 각 지갑에 **KAIA(가스) + USDF(담보)** 자동 배분 (멱등 — 이미 충분하면 건너뜀)
- 6가지 트레이딩 테스트 케이스 실행 후 PASS/FAIL 요약 출력

## 사용법

```bash
npm install
cp .env.example .env   # MASTER_PRIVATE_KEY, MARKET_ADDRESS 채우기

npm run discover       # (선택) 퀘스트 페이지에서 마켓 주소 자동 탐색
npm run fund           # 1) 5개 지갑에 KAIA/USDF 배분
npm run trade-test     # 2) 매수/매도 + 슬리피지 테스트
```

`MARKET_ADDRESS` 는 `npm run discover` 로 찾거나, 브라우저 개발자도구(네트워크
탭)에서 트레이드 트랜잭션의 `to` 주소를 확인해 넣으면 됩니다. `USDF_ADDRESS` 는
비워두면 마켓의 `collateralToken()` 에서 자동 조회를 시도합니다.

## 테스트 케이스

| ID | 시나리오 | 기대 결과 |
|----|---------|----------|
| T1 | 허용 슬리피지(기본 2%) 내 `maxCost` 로 매수 | 성공, 실지불 ≤ maxCost |
| T2 | `maxCost` 를 견적보다 1% 낮게 설정 후 매수 | **리버트** (슬리피지 보호) |
| T3 | 견적 후 타 지갑 대량 매수로 가격 상승 → 옛 견적으로 매수 | **리버트**, 새 견적 재시도는 성공 |
| T4 | 대량 매수 전후 한계가격 비교 | 가격 상승 (LMSR 단조성) |
| T5 | 보유분 절반을 허용 슬리피지 내 `minReturn` 으로 매도 | 성공, 실수취 ≥ minReturn |
| T6 | `minReturn` 을 견적보다 1% 높게 설정 후 매도 | **리버트** (슬리피지 보호) |

## 지원 마켓 인터페이스

바이트코드의 함수 셀렉터를 검사해 자동 감지합니다 (EIP-1967 프록시 지원):

- **A. Gnosis LMSR 계열** — `calcNetCost(int256[])` / `trade(int256[],int256)`
- **B. 커스텀 LS-LMSR 계열** — `calcBuyCost/calcSellReturn` + `buy(uint,uint,uint)` / `sell(uint,uint,uint)`

실제 컨트랙트가 다른 시그니처를 쓰면 감지 단계에서 명확한 에러가 출력됩니다.
그 경우 실제 ABI 를 `test/lmsr/lib.js` 에 추가하면 됩니다.

**알려진 한계**: 매도 시 아웃컴 토큰이 별도 ERC20/ERC1155 이고 마켓에 대한
approve 가 필요한 구현이라면 T5/T6 이 approve 사유로 실패할 수 있습니다. 그때는
출력된 리버트 사유를 보고 해당 토큰 approve 로직을 추가하세요.

## 보안 주의

- `MASTER_PRIVATE_KEY` 는 `.env` 에만 두세요 (`.gitignore` 처리됨). **절대 커밋 금지.**
- 채팅/이슈 등에 개인키가 노출된 적이 있다면 테스트넷이라도 키 교체를 권장합니다.
