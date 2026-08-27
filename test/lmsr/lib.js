// 공용 유틸: .env 로딩, 설정, 지갑 파생, ABI, 마켓 인터페이스 자동 감지
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// ---------- .env 로더 (외부 의존성 없이) ----------
function loadEnv() {
  const envPath = path.join(__dirname, "..", "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

function normalizePk(pk) {
  if (!pk) return "";
  return pk.startsWith("0x") ? pk : "0x" + pk;
}

const CONFIG = {
  RPC_URL: process.env.RPC_URL || "https://public-en-kairos.node.kaia.io",
  CHAIN_ID: Number(process.env.CHAIN_ID || 1001), // Kaia Kairos 테스트넷
  MASTER_PRIVATE_KEY: normalizePk(process.env.MASTER_PRIVATE_KEY),
  MARKET_ADDRESS: process.env.MARKET_ADDRESS || "",
  USDF_ADDRESS: process.env.USDF_ADDRESS || "",
  QUEST_URL:
    process.env.QUEST_URL ||
    "https://bp-frontend-staging.up.railway.app/quests/1787826370000044",
  NUM_WALLETS: Number(process.env.NUM_WALLETS || 5),
  FUND_KAIA: process.env.FUND_KAIA || "1", // 지갑당 가스용 KAIA
  FUND_USDF: process.env.FUND_USDF || "100", // 지갑당 트레이딩용 USDF
  BUY_USDF: process.env.BUY_USDF || "10", // 기본 매수 규모(USDF 기준)
  SLIPPAGE_BPS: Number(process.env.SLIPPAGE_BPS || 200), // 정상 케이스 허용 슬리피지 2%
};

function requireEnv(name) {
  if (!CONFIG[name]) {
    console.error(
      `[설정 오류] ${name} 이(가) 없습니다. .env 파일에 설정하세요 (.env.example 참고).`
    );
    process.exit(1);
  }
  return CONFIG[name];
}

function getProvider() {
  return new ethers.JsonRpcProvider(CONFIG.RPC_URL, CONFIG.CHAIN_ID);
}

function getMaster(provider) {
  return new ethers.Wallet(requireEnv("MASTER_PRIVATE_KEY"), provider);
}

// 마스터 키에서 결정적으로 파생되는 테스트 지갑 (재실행해도 동일 주소)
function deriveTestWallets(provider, n = CONFIG.NUM_WALLETS) {
  const masterPk = requireEnv("MASTER_PRIVATE_KEY");
  const wallets = [];
  for (let i = 1; i <= n; i++) {
    const pk = ethers.keccak256(
      ethers.concat([masterPk, ethers.toUtf8Bytes(`/lmsr-test/${i}`)])
    );
    wallets.push(new ethers.Wallet(pk, provider));
  }
  return wallets;
}

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

// 스타일 A: Gnosis LMSR 계열 — trade(outcomeTokenAmounts, collateralLimit)
const GNOSIS_LMSR_ABI = [
  "function calcNetCost(int256[] outcomeTokenAmounts) view returns (int256)",
  "function trade(int256[] outcomeTokenAmounts, int256 collateralLimit) returns (int256)",
  "function calcMarginalPrice(uint8 outcomeTokenIndex) view returns (uint256)",
  "function atomicOutcomeSlotCount() view returns (uint256)",
  "function collateralToken() view returns (address)",
  "function fee() view returns (uint64)",
];

// 스타일 B: 커스텀 LS-LMSR 계열 — buy/sell + max/min 한도(슬리피지 보호)
const CUSTOM_LMSR_ABI = [
  "function calcBuyCost(uint256 outcome, uint256 shares) view returns (uint256)",
  "function calcSellReturn(uint256 outcome, uint256 shares) view returns (uint256)",
  "function buy(uint256 outcome, uint256 shares, uint256 maxCost) returns (uint256)",
  "function sell(uint256 outcome, uint256 shares, uint256 minReturn) returns (uint256)",
  "function getPrice(uint256 outcome) view returns (uint256)",
  "function outcomeCount() view returns (uint256)",
  "function collateral() view returns (address)",
  "function collateralToken() view returns (address)",
];

// EIP-1967 프록시면 구현 컨트랙트 바이트코드로 판별
async function getRuntimeCode(provider, addr) {
  let code = await provider.getCode(addr);
  const IMPL_SLOT =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implRaw = await provider.getStorage(addr, IMPL_SLOT);
  const impl = ethers.getAddress("0x" + implRaw.slice(-40));
  if (impl !== ethers.ZeroAddress) {
    const implCode = await provider.getCode(impl);
    if (implCode && implCode !== "0x") code = implCode;
  }
  return code;
}

function hasSelector(code, signature) {
  const sel = ethers.FunctionFragment.from(signature).selector.slice(2);
  return code.includes(sel);
}

// 마켓 컨트랙트 인터페이스 자동 감지 → { style, market, collateralAddr, outcomes }
async function detectMarket(provider, marketAddr) {
  const code = await getRuntimeCode(provider, marketAddr);
  if (!code || code === "0x") {
    throw new Error(`마켓 주소 ${marketAddr} 에 컨트랙트 코드가 없습니다.`);
  }

  const styleA =
    hasSelector(code, "trade(int256[],int256)") &&
    hasSelector(code, "calcNetCost(int256[])");
  const styleB =
    hasSelector(code, "buy(uint256,uint256,uint256)") &&
    hasSelector(code, "sell(uint256,uint256,uint256)");

  let style, market;
  if (styleA) {
    style = "gnosis";
    market = new ethers.Contract(marketAddr, GNOSIS_LMSR_ABI, provider);
  } else if (styleB) {
    style = "custom";
    market = new ethers.Contract(marketAddr, CUSTOM_LMSR_ABI, provider);
  } else {
    throw new Error(
      `마켓 ${marketAddr} 의 인터페이스를 인식하지 못했습니다.\n` +
        `지원: (A) trade(int256[],int256)/calcNetCost — Gnosis LMSR 계열, ` +
        `(B) buy(uint,uint,uint)/sell(uint,uint,uint) — 커스텀 LS-LMSR 계열.\n` +
        `실제 컨트랙트 ABI를 알려주시면 lib.js 에 추가할 수 있습니다.`
    );
  }

  // 담보 토큰 주소
  let collateralAddr = CONFIG.USDF_ADDRESS;
  for (const fn of ["collateralToken", "collateral"]) {
    if (collateralAddr) break;
    try {
      collateralAddr = await market[fn]();
    } catch (_) {}
  }
  if (!collateralAddr)
    throw new Error(
      "담보 토큰(USDF) 주소를 마켓에서 읽지 못했습니다. .env 의 USDF_ADDRESS 를 설정하세요."
    );

  // 아웃컴 수
  let outcomes = 2;
  for (const fn of ["atomicOutcomeSlotCount", "outcomeCount"]) {
    try {
      outcomes = Number(await market[fn]());
      break;
    } catch (_) {}
  }

  return { style, market, collateralAddr, outcomes, code };
}

function fmt(x, decimals = 18, digits = 6) {
  return Number(ethers.formatUnits(x, decimals)).toFixed(digits);
}

async function sendAndWait(txPromise, label) {
  const tx = await txPromise;
  const rc = await tx.wait();
  console.log(
    `   ✓ ${label} | tx=${rc.hash} | gasUsed=${rc.gasUsed.toString()}`
  );
  return rc;
}

module.exports = {
  CONFIG,
  requireEnv,
  getProvider,
  getMaster,
  deriveTestWallets,
  ERC20_ABI,
  GNOSIS_LMSR_ABI,
  CUSTOM_LMSR_ABI,
  detectMarket,
  fmt,
  sendAndWait,
  ethers,
};
