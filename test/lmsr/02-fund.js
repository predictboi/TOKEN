// 2단계: 마스터 지갑에서 테스트 지갑 5개로 KAIA(가스) + USDF(담보) 배분
// 멱등: 이미 충분히 보유한 지갑은 건너뜀 → 재실행 안전
const {
  CONFIG,
  getProvider,
  getMaster,
  deriveTestWallets,
  ERC20_ABI,
  fmt,
  sendAndWait,
  ethers,
  requireEnv,
} = require("./lib");

async function main() {
  const provider = getProvider();
  const master = getMaster(provider);
  const wallets = deriveTestWallets(provider);
  const usdfAddr = requireEnv("USDF_ADDRESS");
  const usdf = new ethers.Contract(usdfAddr, ERC20_ABI, master);
  const [dec, sym] = await Promise.all([usdf.decimals(), usdf.symbol()]);

  const fundKaia = ethers.parseEther(CONFIG.FUND_KAIA);
  const fundUsdf = ethers.parseUnits(CONFIG.FUND_USDF, dec);

  console.log(`[마스터] ${master.address}`);
  const [mKaia, mUsdf] = await Promise.all([
    provider.getBalance(master.address),
    usdf.balanceOf(master.address),
  ]);
  console.log(`   KAIA: ${fmt(mKaia)} | ${sym}: ${fmt(mUsdf, dec)}`);

  const needKaia = fundKaia * BigInt(wallets.length);
  const needUsdf = fundUsdf * BigInt(wallets.length);
  if (mKaia < needKaia)
    throw new Error(
      `마스터 KAIA 부족: 필요 ${fmt(needKaia)}, 보유 ${fmt(mKaia)} — https://faucet.kaia.io 에서 충전하세요.`
    );
  if (mUsdf < needUsdf)
    throw new Error(
      `마스터 ${sym} 부족: 필요 ${fmt(needUsdf, dec)}, 보유 ${fmt(mUsdf, dec)}`
    );

  for (const [i, w] of wallets.entries()) {
    console.log(`\n[테스트지갑 #${i + 1}] ${w.address}`);
    const [kaiaBal, usdfBal] = await Promise.all([
      provider.getBalance(w.address),
      usdf.balanceOf(w.address),
    ]);
    console.log(`   현재 KAIA: ${fmt(kaiaBal)} | ${sym}: ${fmt(usdfBal, dec)}`);

    if (kaiaBal < fundKaia / 2n) {
      await sendAndWait(
        master.sendTransaction({ to: w.address, value: fundKaia }),
        `KAIA ${CONFIG.FUND_KAIA} 전송`
      );
    } else {
      console.log(`   - KAIA 충분, 건너뜀`);
    }

    if (usdfBal < fundUsdf / 2n) {
      await sendAndWait(
        usdf.transfer(w.address, fundUsdf),
        `${sym} ${CONFIG.FUND_USDF} 전송`
      );
    } else {
      console.log(`   - ${sym} 충분, 건너뜀`);
    }
  }

  console.log(`\n[완료] ${wallets.length}개 지갑 배분 완료.`);
  for (const [i, w] of wallets.entries()) {
    const [k, u] = await Promise.all([
      provider.getBalance(w.address),
      usdf.balanceOf(w.address),
    ]);
    console.log(
      `   #${i + 1} ${w.address} | KAIA ${fmt(k)} | ${sym} ${fmt(u, dec)}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
