// 3단계: LS-LMSR 마켓 매수/매도 + 슬리피지 보호 동작 테스트
//
// 테스트 케이스:
//  T1 [매수 정상]      허용 슬리피지(기본 2%) 내 maxCost 로 매수 → 성공해야 함
//  T2 [매수 한도초과]   maxCost 를 견적보다 1% 낮게 → 리버트되어야 함 (슬리피지 보호)
//  T3 [스테일 견적]     견적 후 다른 지갑이 대량 매수로 가격을 올린 뒤,
//                      옛 견적 기준 maxCost 로 매수 → 리버트되어야 함, 새 견적으로 재시도 → 성공
//  T4 [가격 임팩트]     대량 매수 전후 한계가격 상승 확인 (LMSR 볼록성)
//  T5 [매도 정상]      보유 수량 절반을 허용 슬리피지 내 minReturn 으로 매도 → 성공
//  T6 [매도 한도초과]   minReturn 을 견적보다 1% 높게 → 리버트되어야 함
const {
  CONFIG,
  getProvider,
  deriveTestWallets,
  detectMarket,
  ERC20_ABI,
  fmt,
  ethers,
  requireEnv,
} = require("./lib");

const results = [];
function record(id, name, pass, detail) {
  results.push({ id, name, pass, detail });
  console.log(`\n[${id}] ${name} → ${pass ? "PASS ✅" : "FAIL ❌"} ${detail}`);
}

function bpsUp(x, bps) {
  return (x * BigInt(10000 + bps)) / 10000n;
}
function bpsDown(x, bps) {
  return (x * BigInt(10000 - bps)) / 10000n;
}

async function expectRevert(label, txPromise) {
  try {
    const tx = await txPromise;
    await tx.wait();
    return { reverted: false, reason: "성공해버림(리버트 기대)" };
  } catch (e) {
    const reason =
      e.reason || e.shortMessage || (e.info && JSON.stringify(e.info)) || e.message;
    console.log(`   ✓ 예상대로 리버트: ${String(reason).slice(0, 120)}`);
    return { reverted: true, reason };
  }
}

// ---------- 인터페이스 스타일별 어댑터 ----------
function makeAdapter(style, market, dec) {
  if (style === "custom") {
    return {
      quoteBuy: (outcome, shares) => market.calcBuyCost(outcome, shares),
      quoteSell: (outcome, shares) => market.calcSellReturn(outcome, shares),
      buy: (signer, outcome, shares, maxCost) =>
        market.connect(signer).buy(outcome, shares, maxCost),
      sell: (signer, outcome, shares, minReturn) =>
        market.connect(signer).sell(outcome, shares, minReturn),
      price: async (outcome) => {
        try {
          return await market.getPrice(outcome);
        } catch {
          // getPrice 미지원 시 1주 매수 비용을 가격 프록시로 사용
          return await market.calcBuyCost(outcome, ethers.parseUnits("1", dec));
        }
      },
    };
  }
  // gnosis 스타일: trade(int256[] amounts, int256 collateralLimit)
  const vec = (n, outcome, amount) => {
    const a = new Array(n).fill(0n);
    a[outcome] = amount;
    return a;
  };
  return {
    _n: null,
    async init() {
      this._n = Number(await market.atomicOutcomeSlotCount());
    },
    quoteBuy(outcome, shares) {
      return market.calcNetCost(vec(this._n, outcome, shares));
    },
    async quoteSell(outcome, shares) {
      return -(await market.calcNetCost(vec(this._n, outcome, -shares)));
    },
    buy(signer, outcome, shares, maxCost) {
      return market.connect(signer).trade(vec(this._n, outcome, shares), maxCost);
    },
    sell(signer, outcome, shares, minReturn) {
      // 매도: 수량 음수, collateralLimit 음수 = 최소 수취액
      return market
        .connect(signer)
        .trade(vec(this._n, outcome, -shares), -minReturn);
    },
    price: (outcome) => market.calcMarginalPrice(outcome),
  };
}

async function ensureApproval(usdf, owner, spender) {
  const cur = await usdf.allowance(owner.address, spender);
  if (cur < ethers.MaxUint256 / 2n) {
    const tx = await usdf.connect(owner).approve(spender, ethers.MaxUint256);
    await tx.wait();
    console.log(`   ✓ ${owner.address.slice(0, 10)}… USDF approve 완료`);
  }
}

async function main() {
  const provider = getProvider();
  const wallets = deriveTestWallets(provider);
  const marketAddr = requireEnv("MARKET_ADDRESS");
  const { style, market, collateralAddr, outcomes } = await detectMarket(
    provider,
    marketAddr
  );
  const usdf = new ethers.Contract(collateralAddr, ERC20_ABI, provider);
  const [dec, sym] = await Promise.all([usdf.decimals(), usdf.symbol()]);
  console.log(
    `[마켓] ${marketAddr} | style=${style} | outcomes=${outcomes} | 담보=${sym}(${collateralAddr})`
  );

  const adapter = makeAdapter(style, market, dec);
  if (adapter.init) await adapter.init();

  const OUT = 0; // 테스트 대상 아웃컴 (YES)
  const shares = ethers.parseUnits(CONFIG.BUY_USDF, dec); // 가격<1 가정 → 비용 ≤ BUY_USDF
  const bigShares = shares * 3n;
  const [w1, w2, w3, w4, w5] = wallets;

  for (const w of wallets) await ensureApproval(usdf, w, marketAddr);

  // ---------- T1: 정상 매수 ----------
  {
    const quote = await adapter.quoteBuy(OUT, shares);
    const maxCost = bpsUp(quote, CONFIG.SLIPPAGE_BPS);
    const before = await usdf.balanceOf(w1.address);
    try {
      const tx = await adapter.buy(w1, OUT, shares, maxCost);
      const rc = await tx.wait();
      const paid = before - (await usdf.balanceOf(w1.address));
      const ok = paid > 0n && paid <= maxCost;
      record(
        "T1",
        "정상 매수 (허용 슬리피지 내)",
        ok,
        `견적=${fmt(quote, dec)} 실지불=${fmt(paid, dec)} ${sym}, tx=${rc.hash}`
      );
    } catch (e) {
      record("T1", "정상 매수 (허용 슬리피지 내)", false, `실패: ${e.reason || e.shortMessage || e.message}`);
    }
  }

  // ---------- T2: maxCost 를 견적 미만으로 → 리버트 기대 ----------
  {
    const quote = await adapter.quoteBuy(OUT, shares);
    const tooLow = bpsDown(quote, 100); // 견적 -1%
    const r = await expectRevert(
      "T2",
      adapter.buy(w2, OUT, shares, tooLow)
    );
    record(
      "T2",
      "매수 한도초과 거부 (maxCost=견적-1%)",
      r.reverted,
      r.reverted ? "슬리피지 보호 정상 동작" : String(r.reason)
    );
  }

  // ---------- T3: 스테일 견적 ----------
  {
    const staleQuote = await adapter.quoteBuy(OUT, shares); // w3 이 견적을 받아둠
    // w4 가 대량 매수로 가격을 밀어올림
    const bigQuote = await adapter.quoteBuy(OUT, bigShares);
    const tx = await adapter.buy(w4, OUT, bigShares, bpsUp(bigQuote, CONFIG.SLIPPAGE_BPS));
    await tx.wait();
    console.log(`   ✓ W4 대량 매수 완료 (${fmt(bigQuote, dec)} ${sym} 규모)`);

    const r = await expectRevert(
      "T3",
      adapter.buy(w3, OUT, shares, bpsUp(staleQuote, 10)) // 옛 견적 +0.1%
    );
    let retryOk = false,
      retryDetail = "";
    if (r.reverted) {
      const fresh = await adapter.quoteBuy(OUT, shares);
      try {
        const tx2 = await adapter.buy(w3, OUT, shares, bpsUp(fresh, CONFIG.SLIPPAGE_BPS));
        await tx2.wait();
        retryOk = true;
        retryDetail = `새 견적(${fmt(fresh, dec)})으로 재시도 성공, 스테일 견적(${fmt(staleQuote, dec)}) 대비 상승 확인`;
      } catch (e) {
        retryDetail = `재시도 실패: ${e.reason || e.message}`;
      }
    }
    record(
      "T3",
      "스테일 견적 거부 후 새 견적 성공",
      r.reverted && retryOk,
      r.reverted ? retryDetail : "가격 변동 후에도 옛 한도로 체결됨(보호 미동작 또는 임팩트 미미)"
    );
  }

  // ---------- T4: 가격 임팩트 (LMSR 단조성) ----------
  {
    const pBefore = await adapter.price(OUT);
    const q = await adapter.quoteBuy(OUT, bigShares);
    const tx = await adapter.buy(w5, OUT, bigShares, bpsUp(q, CONFIG.SLIPPAGE_BPS));
    await tx.wait();
    const pAfter = await adapter.price(OUT);
    record(
      "T4",
      "대량 매수 후 가격 상승 (LMSR 단조성)",
      pAfter > pBefore,
      `전=${pBefore} 후=${pAfter}`
    );
  }

  // ---------- T5: 정상 매도 (w1 보유분 절반) ----------
  {
    const sellShares = shares / 2n;
    const quote = await adapter.quoteSell(OUT, sellShares);
    const minReturn = bpsDown(quote, CONFIG.SLIPPAGE_BPS);
    const before = await usdf.balanceOf(w1.address);
    try {
      const tx = await adapter.sell(w1, OUT, sellShares, minReturn);
      const rc = await tx.wait();
      const received = (await usdf.balanceOf(w1.address)) - before;
      const ok = received >= minReturn;
      record(
        "T5",
        "정상 매도 (허용 슬리피지 내)",
        ok,
        `견적=${fmt(quote, dec)} 실수취=${fmt(received, dec)} ${sym}, tx=${rc.hash}`
      );
    } catch (e) {
      record("T5", "정상 매도", false, `실패: ${e.reason || e.shortMessage || e.message}`);
    }
  }

  // ---------- T6: minReturn 을 견적 초과로 → 리버트 기대 ----------
  {
    const sellShares = shares / 4n;
    const quote = await adapter.quoteSell(OUT, sellShares);
    const tooHigh = bpsUp(quote, 100); // 견적 +1%
    const r = await expectRevert("T6", adapter.sell(w3, OUT, sellShares, tooHigh));
    record(
      "T6",
      "매도 한도초과 거부 (minReturn=견적+1%)",
      r.reverted,
      r.reverted ? "슬리피지 보호 정상 동작" : String(r.reason)
    );
  }

  // ---------- 결과 요약 ----------
  console.log("\n========== 테스트 결과 요약 ==========");
  let fails = 0;
  for (const r of results) {
    if (!r.pass) fails++;
    console.log(`${r.pass ? "PASS ✅" : "FAIL ❌"} [${r.id}] ${r.name} — ${r.detail}`);
  }
  console.log(`총 ${results.length}건 중 ${results.length - fails}건 통과`);
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
