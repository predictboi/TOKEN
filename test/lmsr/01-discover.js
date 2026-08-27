// 1단계: 퀘스트 페이지/API에서 마켓 컨트랙트 주소 자동 탐색 (베스트 에포트)
// 실패하면 .env 의 MARKET_ADDRESS / USDF_ADDRESS 를 수동으로 설정하세요.
const { CONFIG, getProvider, detectMarket, ethers } = require("./lib");

async function tryFetch(url, accept) {
  try {
    const res = await fetch(url, {
      headers: { Accept: accept, "User-Agent": "lmsr-test/1.0" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.log(`   ✗ ${url} → ${e.cause?.code || e.message}`);
    return null;
  }
}

async function main() {
  const questUrl = CONFIG.QUEST_URL;
  const questId = questUrl.split("/").filter(Boolean).pop();
  const origin = new URL(questUrl).origin;
  console.log(`[탐색] 퀘스트: ${questUrl}`);

  const candidates = [
    [questUrl, "application/json"],
    [`${origin}/api/quests/${questId}`, "application/json"],
    [`${origin}/api/quest/${questId}`, "application/json"],
    [`${origin}/api/markets/${questId}`, "application/json"],
    [questUrl, "text/html"],
  ];

  const found = new Set();
  for (const [url, accept] of candidates) {
    const body = await tryFetch(url, accept);
    if (!body) continue;
    console.log(`   ✓ ${url} (${body.length} bytes)`);
    for (const m of body.match(/0x[a-fA-F0-9]{40}/g) || []) {
      found.add(ethers.getAddress(m));
    }
    // __NEXT_DATA__ 안의 JSON도 함께 스캔됨 (정규식이 전체 본문 대상)
  }

  if (found.size === 0) {
    console.log(
      "\n[결과] 주소를 찾지 못했습니다. 브라우저 개발자도구(네트워크 탭)에서 " +
        "마켓 주소를 확인해 .env 의 MARKET_ADDRESS 에 넣어주세요."
    );
    process.exit(1);
  }

  console.log(`\n[후보 주소 ${found.size}개] 컨트랙트 여부 및 인터페이스 검사:`);
  const provider = getProvider();
  for (const addr of found) {
    try {
      const code = await provider.getCode(addr);
      if (!code || code === "0x") {
        console.log(`   - ${addr}: EOA(컨트랙트 아님)`);
        continue;
      }
      try {
        const { style, collateralAddr, outcomes } = await detectMarket(
          provider,
          addr
        );
        console.log(
          `   ★ ${addr}: LMSR 마켓으로 인식 (style=${style}, outcomes=${outcomes}, collateral=${collateralAddr})`
        );
        console.log(`\n.env 에 추가하세요:`);
        console.log(`MARKET_ADDRESS=${addr}`);
        console.log(`USDF_ADDRESS=${collateralAddr}`);
      } catch (e) {
        console.log(`   - ${addr}: 컨트랙트지만 마켓 아님 (${e.message.split("\n")[0]})`);
      }
    } catch (e) {
      console.log(`   - ${addr}: 조회 실패 (${e.message})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
