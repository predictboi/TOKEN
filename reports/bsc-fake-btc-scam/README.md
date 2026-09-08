# BSC 가짜 비트코인(ꓐꓔꓚ) 토큰 사기 분석

- 리포트(PDF, 2장): `BSC_가짜BTC_사기분석_리포트.pdf`
- 증거 캡처: `evidence/cap1.png` (토큰 메타데이터·리수 문자 위조), `evidence/cap2.png` (BTCB 1:1 가격 조작 풀), `evidence/cap3.png` (수신 지갑 전송 트랜잭션)
- 원본 데이터: `evidence/tx_to_B.json` (전송 tx/receipt), `evidence/gt_pools.json` (GeckoTerminal 풀 목록)
- 캡처는 BSC 공개 RPC·GeckoTerminal·GoPlus API 응답을 그대로 렌더링한 것 (`evidence/captures.html`)

## 요약
| 항목 | 값 |
|---|---|
| 가짜 토큰 | 0x9CfAe85338A8c326d5165Df4a7EC3357e8b78888 (name `ꓐitcoin`, symbol `ꓐꓔꓚ` = U+A4D0/U+A4D4/U+A4DA) |
| 토큰 생성자 | 0x4D3437872c8C45ca3C299Db1337B5bc6581b7503 |
| 발신 지갑 | 0x580e4dd7a793df8e850575e1881cf5a67effccb5 |
| 수신 지갑 | 0xe2D93a68329520bd1110C189037b66Dd689575C7 (645.97개 수신, 2026-09-02 17:44:57 KST) |
| 전송 tx | 0xc6472b66092150e26d35968c558b4f6611fb35100130c4996971eca26d92a947 |
| 가격 조작 풀 | PancakeSwap Infinity ꓐꓔꓚ/BTCB 0.205%, 유동성 $19.72, 가격 $79,511 (실제 BTC $79,142) |
| 실제 시장 가격 | $0.0001177 (Flap 런치패드 풀) → 645.97개 실제 가치 약 $0.08 |
