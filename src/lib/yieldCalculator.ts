import { UserAccount, AppConfig, YieldTier, YIELD_TIERS } from '../types';

/**
 * Calculates accrued node mining yield for a user based on elapsed time.
 * Works seamlessly whether the user is actively on the site or has been offline for days.
 */
export function calculateAccruedYield(
  user: UserAccount,
  config?: Partial<AppConfig> | null,
  now: number = Date.now()
): { updatedUser: UserAccount; earnedUSD: number } {
  const lastPayout = user.lastYieldPayout || user.createdAt || now;
  const elapsedSeconds = Math.max(0, (now - lastPayout) / 1000);

  // Total node mining assets include deposited/wallet balances and occupied staking balance
  const totalUSDT = (user.occupiedUSDT || 0) + (user.usdtBalance || 0);
  const totalUSDC = (user.occupiedUSDC || 0) + (user.usdcBalance || 0);
  const totalBTC = (user.occupiedBTC || 0) + (user.btcBalance || 0);
  const totalETH = (user.occupiedETH || 0) + (user.ethBalance || 0);

  const totalNodeValueUSD = totalUSDT + totalUSDC + (totalBTC * 65000) + (totalETH * 3500);

  if (elapsedSeconds <= 0 || totalNodeValueUSD <= 0) {
    return {
      updatedUser: {
        ...user,
        lastYieldPayout: now,
      },
      earnedUSD: 0,
    };
  }

  const activeTiers = config?.yieldTiers && config.yieldTiers.length > 0 ? config.yieldTiers : YIELD_TIERS;
  const sorted = [...activeTiers].sort((a, b) => a.minAmount - b.minAmount);

  let matchedTier: YieldTier | undefined = undefined;
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const isLast = i === sorted.length - 1;
    if (totalNodeValueUSD >= tier.minAmount && (totalNodeValueUSD < tier.maxAmount || isLast)) {
      matchedTier = tier;
      break;
    }
  }

  let dailyRate = 0.024; // 2.4% daily default
  if (config?.baseYieldRate && config.baseYieldRate > 0) {
    dailyRate = config.baseYieldRate;
  }
  if (matchedTier) {
    let yMin = matchedTier.yieldMin ?? 0.024;
    let yMax = matchedTier.yieldMax ?? yMin;
    if (yMin > 1) yMin = yMin / 100;
    if (yMax > 1) yMax = yMax / 100;
    dailyRate = (yMin + yMax) / 2;
  } else if (totalNodeValueUSD < (sorted[0]?.minAmount || 100)) {
    let minR = sorted[0]?.yieldMin ?? 0.020;
    if (minR > 1) minR = minR / 100;
    dailyRate = minR;
  } else {
    const highest = sorted[sorted.length - 1];
    let hMin = highest?.yieldMin ?? 0.040;
    let hMax = highest?.yieldMax ?? 0.050;
    if (hMin > 1) hMin = hMin / 100;
    if (hMax > 1) hMax = hMax / 100;
    dailyRate = (hMin + hMax) / 2;
  }

  const earnedUSD = totalNodeValueUSD * dailyRate * (elapsedSeconds / 86400);

  if (earnedUSD <= 0) {
    return {
      updatedUser: {
        ...user,
        lastYieldPayout: now,
      },
      earnedUSD: 0,
    };
  }

  const updatedUser: UserAccount = {
    ...user,
    totalYieldEarned: (user.totalYieldEarned || 0) + earnedUSD,
    usdtBalance: (user.usdtBalance || 0) + earnedUSD,
    lastYieldPayout: now,
    updatedAt: now,
  };

  return { updatedUser, earnedUSD };
}
