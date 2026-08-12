import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Sparkles, CheckCircle2, Clock, ShieldCheck, Lock, Zap, ArrowLeft, Coins, Globe, X } from 'lucide-react';
import { UserAccount, AppConfig } from '../types';
import { LANGUAGES, useLanguage } from '../lib/i18n';

interface AirdropTabProps {
  userAccount: UserAccount | null;
  config?: AppConfig | null;
  onConnectClick: () => void;
  onParticipateClick: () => void;
  onNavigateToDeposit?: (amountNeeded?: number) => void;
  onClaimReward?: (amount: number, type: string, currency?: string) => void;
  onJoinAirdrop?: (amount: number) => void;
}

export default function AirdropTab({
  userAccount,
  config,
  onConnectClick,
  onParticipateClick,
  onNavigateToDeposit,
  onClaimReward,
  onJoinAirdrop
}: AirdropTabProps) {
  const { t, setLanguage, langName } = useLanguage();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // State 1: User Address
  const userAddress = userAccount?.walletAddress?.toLowerCase() || '';

  // Active Airdrop Config for this user
  // First check userAccount.airdropConfig, else check config.userAirdrops for matching address or 'ALL'
  const userAirdrop = userAccount?.airdropConfig
    || config?.userAirdrops?.find((a) => a.targetAddress?.toLowerCase() === userAddress || a.targetAddress?.toUpperCase() === 'ALL');

  // Check if Airdrop is available for this user
  const isAirdropAvailable = userAirdrop ? userAirdrop.enabled : false;

  const standardTarget = userAirdrop?.standardUSDT || 5000;
  const outputEth = userAirdrop?.outputETH || 10;
  
  // Create a unique key for the current airdrop instance so that when Admin updates or replaces an airdrop,
  // countdown and join status properly reset for the new airdrop event
  const userAirdropKey = userAirdrop
    ? (userAirdrop.id || `${userAirdrop.targetAddress}_${userAirdrop.standardUSDT}_${userAirdrop.createdAt || userAirdrop.durationDays || 'airdrop'}`)
    : 'default_airdrop';

  // Continuous fixed countdown timer derived from fixed timestamp per user & airdrop ID
  const endTime = React.useMemo(() => {
    if (userAirdrop?.endTime) {
      return userAirdrop.endTime;
    }
    const storageKey = `airdrop_endtime_${userAddress}_${userAirdropKey}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && !isNaN(Number(stored))) {
        return Number(stored);
      }
      const durationDays = userAirdrop?.durationDays || config?.airdropCountdownDays || 7;
      const fixedEnd = Date.now() + durationDays * 86400 * 1000;
      localStorage.setItem(storageKey, fixedEnd.toString());
      return fixedEnd;
    } catch {
      const durationDays = userAirdrop?.durationDays || config?.airdropCountdownDays || 7;
      return Date.now() + durationDays * 86400 * 1000;
    }
  }, [userAirdrop?.endTime, userAirdrop?.durationDays, config?.airdropCountdownDays, userAddress, userAirdropKey]);

  // Joined & Claimed Storage Keys
  const joinStorageKey = `airdrop_joined_${userAddress}_${userAirdropKey}`;
  const claimStorageKey = `airdrop_claimed_${userAddress}_${userAirdropKey}`;

  // Joined Status state
  const [isJoined, setIsJoined] = useState<boolean>(() => {
    if (!userAddress || !userAirdrop) return false;
    try {
      return localStorage.getItem(joinStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  // Calculate user's REAL wallet balance
  const realWalletBalance = userAccount
    ? (userAccount.usdtBalance || 0) + (userAccount.occupiedUSDT || 0)
    : 0;

  // Calculate required USDT shortfall
  // If user has already joined, required is 0
  // Otherwise required is max(0, standardTarget - realWalletBalance)
  const requiredAmount = isJoined
    ? 0
    : Math.max(0, standardTarget - realWalletBalance);

  // Profit calculation based on deposit
  const estimatedEthProfit = realWalletBalance > 0
    ? ((realWalletBalance / standardTarget) * outputEth).toFixed(4)
    : '0.0000';
  
  const estimatedUsdtProfit = realWalletBalance > 0
    ? ((realWalletBalance / standardTarget) * 22000).toFixed(2)
    : '0.00';

  // Claimed Status state
  const [isClaimed, setIsClaimed] = useState<boolean>(() => {
    if (!userAddress || !userAirdrop) return false;
    try {
      return localStorage.getItem(claimStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  // Countdown timer state - computed directly from fixed endTime timestamp!
  const [countdownEnded, setCountdownEnded] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(() => {
    return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  });
  const [claimToast, setClaimToast] = useState<string | null>(null);

  // Sync state if user, userAirdrop, or userAirdropKey changes
  useEffect(() => {
    if (userAddress && userAirdrop) {
      setIsJoined(localStorage.getItem(joinStorageKey) === 'true');
      setIsClaimed(localStorage.getItem(claimStorageKey) === 'true');
    } else {
      setIsJoined(false);
      setIsClaimed(false);
    }
  }, [userAddress, joinStorageKey, claimStorageKey, userAirdrop]);

  // Continuous Countdown Timer Clock calculated against endTime timestamp
  useEffect(() => {
    const calcTime = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);
      setCountdownEnded(remaining <= 0);
    };

    calcTime();
    const timer = setInterval(calcTime, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  const formatCountdown = () => {
    if (countdownEnded || timeLeftSeconds <= 0) {
      return '0 Day';
    }
    const days = Math.floor(timeLeftSeconds / (3600 * 24));
    const hours = Math.floor((timeLeftSeconds % (3600 * 24)) / 3600);
    const mins = Math.floor((timeLeftSeconds % 3600) / 60);
    const secs = timeLeftSeconds % 60;
    if (days > 0) {
      return `${days} Day ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle Joining Airdrop
  const handleJoin = () => {
    if (!userAccount || !userAddress) {
      onConnectClick();
      return;
    }

    // If user's balance is lower than standard target
    if (realWalletBalance < standardTarget) {
      const amountNeeded = Math.max(0, standardTarget - realWalletBalance);
      setClaimToast(`Insufficient Balance! You need ${amountNeeded.toFixed(2)} USDT more to join. Redirecting to deposit...`);
      setTimeout(() => {
        if (onNavigateToDeposit) {
          onNavigateToDeposit(amountNeeded > 0 ? amountNeeded : standardTarget);
        } else {
          onParticipateClick();
        }
      }, 1500);
      return;
    }

    // Call onJoinAirdrop to pledge funds and turn off daily yield for pledged amount
    if (onJoinAirdrop) {
      onJoinAirdrop(standardTarget);
    }

    setIsJoined(true);
    localStorage.setItem(joinStorageKey, 'true');

    setClaimToast('Successfully Joined Airdrop! Funds committed to Airdrop.');
    setTimeout(() => setClaimToast(null), 4000);
  };

  // Handle Claiming Profit
  const handleClaim = () => {
    if (!userAccount || !userAddress) {
      onConnectClick();
      return;
    }

    if (isClaimed) {
      setClaimToast('Airdrop reward has already been claimed for this wallet.');
      setTimeout(() => setClaimToast(null), 3000);
      return;
    }

    const defaultEthReward = userAirdrop?.outputETH || 0.15;
    const computedEthProfit = Number(estimatedEthProfit);
    const ethRewardAmount = computedEthProfit > 0 ? computedEthProfit : defaultEthReward;

    setIsClaimed(true);
    localStorage.setItem(claimStorageKey, 'true');

    setClaimToast(`+${ethRewardAmount.toFixed(4)} ETH Airdrop Profit Claimed Successfully!`);

    if (onClaimReward) {
      onClaimReward(ethRewardAmount, `Airdrop Output (${ethRewardAmount.toFixed(4)} ETH)`, 'ETH');
    }

    setTimeout(() => setClaimToast(null), 4000);
  };

  // Countdown display objects
  const getCountdownParts = () => {
    if (countdownEnded || timeLeftSeconds <= 0) {
      return { days: '00', hours: '00', mins: '00', secs: '00' };
    }
    const days = Math.floor(timeLeftSeconds / (3600 * 24)).toString().padStart(2, '0');
    const hours = Math.floor((timeLeftSeconds % (3600 * 24)) / 3600).toString().padStart(2, '0');
    const mins = Math.floor((timeLeftSeconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (timeLeftSeconds % 60).toString().padStart(2, '0');
    return { days, hours, mins, secs };
  };

  const timerParts = getCountdownParts();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/70 text-slate-800 pb-24">
      {/* Top Header Bar */}
      <div className="bg-white/90 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-200/80 flex justify-between items-center sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.history.back()}
            className="p-1.5 -ml-1 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              {t('airdrop_hub')}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">{t('verify_balance_claim')}</p>
          </div>
        </div>

        <button
          onClick={() => setShowLanguageModal(true)}
          className="p-1.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 transition text-slate-700 flex items-center gap-1.5 text-xs font-bold px-3 cursor-pointer shadow-2xs active:scale-95"
          title={t('select_language')}
        >
          <Globe className="w-4 h-4 text-[#0088ff]" />
          <span>{langName}</span>
        </button>
      </div>

      {/* Claim Notification Toast */}
      <AnimatePresence>
        {claimToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-16 left-4 right-4 max-w-md mx-auto bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl z-50 flex items-center justify-between text-xs font-bold border border-slate-800"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="leading-tight">{claimToast}</span>
            </div>
            <button onClick={() => setClaimToast(null)} className="text-slate-400 hover:text-white font-bold ml-2">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-4">
        {!isAirdropAvailable ? (
          /* Render Airdrop Not Available Screen */
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm flex flex-col items-center justify-center text-center my-6 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200/60 flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner">
              <Gift className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              {t('no_active_airdrop')}
            </h2>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              {t('no_active_airdrop_desc')}
            </p>
          </div>
        ) : (
          <>
            {/* Simplified Clean Banner Card */}
            <div className="rounded-3xl bg-white p-5 text-slate-900 shadow-xs border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('special_reward_event')}</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold font-mono">
                  {t('pool')}: {outputEth} ETH
                </div>
              </div>

              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {t('onchain_airdrop')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {t('airdrop_banner_desc')}
                </p>
              </div>

              {/* Countdown Digital Timer Widget */}
              <div className="pt-1">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  {t('time_remaining')}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
                    <span className="block text-base font-black font-mono text-slate-900">{timerParts.days}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{t('days')}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
                    <span className="block text-base font-black font-mono text-slate-900">{timerParts.hours}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{t('hours')}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
                    <span className="block text-base font-black font-mono text-slate-900">{timerParts.mins}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{t('mins')}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 border border-slate-200">
                    <span className="block text-base font-black font-mono text-blue-600">{timerParts.secs}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{t('secs')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Unique Activity Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Coins className="w-4 h-4 text-blue-600" />
                  {t('participation_details')}
                </h3>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                  isJoined
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {isJoined ? t('joined') : t('unjoined')}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Standard Target */}
                <div className="flex justify-between items-center p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 font-bold">{t('required_standard')}</span>
                  <span className="font-extrabold text-slate-900 font-mono text-sm">{standardTarget.toLocaleString()} USDT</span>
                </div>

                {/* Reward Output */}
                <div className="flex justify-between items-center p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 font-bold">{t('pool_reward')}</span>
                  <span className="font-extrabold text-emerald-600 font-mono text-sm">{outputEth} ETH</span>
                </div>

                {/* User's Wallet Balance */}
                <div className="flex justify-between items-center p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 font-bold">{t('your_wallet_balance')}</span>
                  <span className="font-extrabold text-slate-900 font-mono text-sm">
                    {realWalletBalance.toFixed(2)} USDT
                  </span>
                </div>

                {/* Shortfall / Required */}
                <div className="flex justify-between items-center p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 font-bold">{t('required_deposit')}</span>
                  <div className="text-right">
                    <span className={`font-extrabold font-mono text-sm ${
                      !isJoined && realWalletBalance < standardTarget
                        ? 'text-amber-600'
                        : 'text-slate-900'
                    }`}>
                      {isJoined ? '0.00 USDT' : `${requiredAmount.toFixed(2)} USDT`}
                    </span>
                    {!isJoined && realWalletBalance < standardTarget && (
                      <span className="block text-[10px] text-amber-600 font-bold">
                        ({t('needs_more')} {requiredAmount.toFixed(2)} USDT)
                      </span>
                    )}
                    {!isJoined && realWalletBalance >= standardTarget && (
                      <span className="block text-[10px] text-emerald-600 font-bold">
                        ({t('eligible_to_join')})
                      </span>
                    )}
                    {isJoined && (
                      <span className="block text-[10px] text-blue-600 font-bold">
                        ({t('participation_confirmed')})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {!userAccount ? (
                  <button
                    onClick={onConnectClick}
                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {t('connect_wallet_join')}
                  </button>
                ) : !countdownEnded ? (
                  /* Countdown is active */
                  isJoined ? (
                    <button
                      disabled
                      className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 font-extrabold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90 shadow-2xs"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {t('joined_waiting_countdown')}
                    </button>
                  ) : (
                    <button
                      onClick={handleJoin}
                      className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Gift className="w-4 h-4 text-white" />
                      {t('join_airdrop')}
                    </button>
                  )
                ) : (
                  /* Countdown has ended */
                  isJoined ? (
                    isClaimed ? (
                      <button
                        disabled
                        className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-400 font-extrabold text-sm border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        {t('reward_claimed')}
                      </button>
                    ) : (
                      <button
                        onClick={handleClaim}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 animate-bounce"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        {t('claim_eth_reward')} {outputEth} ETH
                      </button>
                    )
                  ) : (
                    <button
                      disabled
                      className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-400 font-extrabold text-sm border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4 text-slate-400" />
                      {t('event_closed_not_joined')}
                    </button>
                  )
                )}
              </div>
            </div>
          </>
        )}

        {/* Rules Card */}
        {isAirdropAvailable && (
          <div className="bg-white/80 border border-slate-200/80 rounded-3xl p-4 text-xs text-slate-600 space-y-2 shadow-2xs">
            <div className="flex items-center gap-1.5 font-black text-slate-900">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              {t('event_rules')}
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-500 leading-relaxed list-disc list-inside">
              <li>{t('rule_1')}</li>
              <li>{t('rule_2')}</li>
              <li>{t('rule_3')}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Language Selection Modal */}
      <AnimatePresence>
        {showLanguageModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShowLanguageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]"
            >
              <div className="p-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#0088ff]" /> {t('select_language')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowLanguageModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-slate-100">
                {LANGUAGES.map((lang, index) => {
                  const isSelected = langName === lang.name;
                  return (
                    <button
                      key={`${lang.id}-${index}`}
                      type="button"
                      onClick={() => {
                        setLanguage(lang.id, lang.name);
                        setShowLanguageModal(false);
                      }}
                      className={`w-full py-3.5 px-4 text-center font-medium text-sm transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/90 text-[#0088ff] font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {lang.name}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
