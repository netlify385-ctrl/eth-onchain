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
  const totalUSDT = (Number(user.occupiedUSDT) || 0) + (Number(user.usdtBalance) || 0);
  const totalUSDC = (Number(user.occupiedUSDC) || 0) + (Number(user.usdcBalance) || 0);
  const totalBTC = (Number(user.occupiedBTC) || 0) + (Number(user.btcBalance) || 0);
  const totalETH = (Number(user.occupiedETH) || 0) + (Number(user.ethBalance) || 0);

  const totalNodeValueUSD = totalUSDT + totalUSDC + (totalBTC * 65000) + (totalETH * 3500);

  if (elapsedSeconds <= 0) {
    return {
      updatedUser: {
        ...user,
        lastYieldPayout: now,
      },
      earnedUSD: 0,
    };
  }

  let earnedUSD = 0;

  // 1. If Admin has manually turned ON Daily Profit for this user:
  if (user.dailyProfitEnabled === true) {
    const dailyAmount = Math.max(0, Number(user.dailyProfitAmount) || 0);
    earnedUSD = (dailyAmount * elapsedSeconds) / 86400;
  } else {
    // 2. When Daily Profit is OFF (or not turned on): user gets percentage profit on their balance like before
    if (totalNodeValueUSD > 0) {
      const activeTiers = config?.yieldTiers && config.yieldTiers.length > 0 ? config.yieldTiers : YIELD_TIERS;
      const sorted = [...activeTiers].sort((a, b) => a.minAmount - b.minAmount);

      let matchedTier: YieldTier | undefined = undefined;
      for (let i = 0; i < sorted.length; i++) {
        const tier = sorted[i];
        const isLast = i === sorted.length - 1;
        const nextMin = !isLast ? sorted[i + 1].minAmount : Infinity;
        if (totalNodeValueUSD >= tier.minAmount && (totalNodeValueUSD <= tier.maxAmount || totalNodeValueUSD < nextMin || isLast)) {
          matchedTier = tier;
          break;
        }
      }

      let dailyRate = 0.020; // 2% daily default for VIP
      if (matchedTier) {
        let yMin = matchedTier.yieldMin ?? 0.020;
        let yMax = matchedTier.yieldMax ?? yMin;
        if (yMin > 1) yMin = yMin / 100;
        if (yMax > 1) yMax = yMax / 100;

        // Linear progress within the specific tier range (or exact fixed rate if yMin === yMax)
        if (matchedTier.maxAmount > matchedTier.minAmount && yMax !== yMin) {
          const progress = Math.min(
            1,
            Math.max(0, (totalNodeValueUSD - matchedTier.minAmount) / (matchedTier.maxAmount - matchedTier.minAmount))
          );
          dailyRate = yMin + (yMax - yMin) * progress;
        } else {
          dailyRate = (yMin + yMax) / 2;
        }
      } else if (totalNodeValueUSD < (sorted[0]?.minAmount || 100)) {
        let minR = sorted[0]?.yieldMin ?? 0.020;
        if (minR > 1) minR = minR / 100;
        dailyRate = minR;
      } else {
        const highest = sorted[sorted.length - 1];
        let hMin = highest?.yieldMin ?? 0.050;
        let hMax = highest?.yieldMax ?? 0.050;
        if (hMin > 1) hMin = hMin / 100;
        if (hMax > 1) hMax = hMax / 100;
        dailyRate = (hMin + hMax) / 2;
      }

      earnedUSD = totalNodeValueUSD * dailyRate * (elapsedSeconds / 86400);
    }
  }

  if (earnedUSD <= 0) {
    return {
      updatedUser: {
        ...user,
        lastYieldPayout: now,
      },
      earnedUSD: 0,
    };
  }

  const currentTotalYield = Number(user.totalYieldEarned) || 0;

  const updatedUser: UserAccount = {
    ...user,
    totalYieldEarned: parseFloat((currentTotalYield + earnedUSD).toFixed(6)),
    lastYieldPayout: now,
    updatedAt: now,
  };

  return { updatedUser, earnedUSD };
}
