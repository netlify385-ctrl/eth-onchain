import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, HelpCircle, Volume2, ArrowRightLeft, Landmark, Award, ShieldCheck, Info, LogOut, X, ChevronRight, ChevronDown, ArrowLeft, MessageSquare, Mail, Share2, Key, Headphones, FileText, Link2, Copy, Check } from 'lucide-react';
import { YIELD_TIERS, UserAccount, AppConfig, YieldTier } from '../types';
import { LANGUAGES, useLanguage } from '../lib/i18n';

interface FinanceTabProps {
  userAccount: UserAccount | null;
  config?: AppConfig | null;
  onDisconnectClick: () => void;
  onParticipateClick: () => void;
  onOpenSupportChat?: () => void;
}

export default function FinanceTab({ userAccount, config, onDisconnectClick, onParticipateClick, onOpenSupportChat }: FinanceTabProps) {
  const { t, setLanguage, langName } = useLanguage();
  const activeTiers = config?.yieldTiers && config.yieldTiers.length > 0 ? config.yieldTiers : YIELD_TIERS;
  const dailyRate = config?.baseYieldRate !== undefined ? config.baseYieldRate : 0.05;

  const userMiningBalance = (userAccount?.occupiedUSDT || 0) > 0 ? (userAccount?.occupiedUSDT || 0) : (userAccount?.usdtBalance || 0);
  const dailyUsdProfit = userMiningBalance * (dailyRate || 0.022);
  const dailyEthProfit = dailyUsdProfit / 3500;
  const totalUsdEarned = userAccount?.totalYieldEarned || 0;
  const totalEthEarned = (userAccount?.ethBalance && userAccount.ethBalance > 0) ? userAccount.ethBalance : (totalUsdEarned / 3500);

  const formatYieldRate = (row: YieldTier) => {
    let yMin = row.yieldMin ?? 0.0200;
    let yMax = row.yieldMax ?? 0.0240;
    if (yMin <= 1) yMin = yMin * 100;
    if (yMax <= 1) yMax = yMax * 100;
    return `${yMin.toFixed(2)} ~ ${yMax.toFixed(2)}`;
  };
  const [activeTab, setActiveTab] = useState<'management' | 'reward_pool'>('management');
  const [userIncome, setUserIncome] = useState(6196796.06);
  const [scrollingLogs, setScrollingLogs] = useState<Array<{ id: string; address: string; amount: string }>>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [activeDrawerModal, setActiveDrawerModal] = useState<'messages' | 'promotion' | 'share' | 'fund_password' | 'terms' | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [fundPasswordInput, setFundPasswordInput] = useState('');
  const [confirmFundPasswordInput, setConfirmFundPasswordInput] = useState('');
  const [fundPasswordSuccess, setFundPasswordSuccess] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedCodeToast, setCopiedCodeToast] = useState(false);
  const [referralTab, setReferralTab] = useState<'level1' | 'level2' | 'level3'>('level1');

  const getInviteCode = () => {
    return userAccount?.walletAddress ? userAccount.walletAddress.slice(-8).toUpperCase() : 'MD85JNBZ';
  };

  const getReferralLink = () => {
    const code = getInviteCode();
    if (typeof window !== 'undefined' && window.location.origin) {
      return `${window.location.origin}?ref=${code}`;
    }
    return `https://eth-onchain-666.vip/host/${code}`;
  };

  // Animate user income slightly to look hyper-realistic and live
  useEffect(() => {
    const interval = setInterval(() => {
      setUserIncome((prev) => prev + (Math.random() * 0.15));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Generate random payouts for scrolling live output
  useEffect(() => {
    const addresses = [
      '0x17fe****4627', '0xec01****1f4e', '0x39a1****82bc', '0x8f2d****771a',
      '0x71c7****476b', '0x9a4f****11b0', '0x2d89****98e1', '0x14bc****66a2',
      '0xe510****22d9', '0x88f2****71a4', '0x5c19****30e2', '0xbf88****92c1'
    ];

    const generateRandomAmount = () => {
      const isBig = Math.random() > 0.6;
      if (isBig) {
        return (Math.random() * 35000 + 1000).toFixed(6);
      }
      return (Math.random() * 800 + 10).toFixed(6);
    };

    const initialLogs = [
      { id: '1', address: '0x17fe****4627', amount: '41112.230976' },
      { id: '2', address: '0xec01****1f4e', amount: '227.210397' },
      { id: '3', address: '0x39a1****82bc', amount: '1054.892011' },
      { id: '4', address: '0x8f2d****771a', amount: '8400.120045' },
      { id: '5', address: '0x71c7****476b', amount: '12800.500000' },
      { id: '6', address: '0x9a4f****11b0', amount: '312.450192' },
    ];

    setScrollingLogs(initialLogs);

    const interval = setInterval(() => {
      const randomAddr = addresses[Math.floor(Math.random() * addresses.length)];
      const randomAmt = generateRandomAmount();
      const newLog = {
        id: Date.now().toString() + Math.random().toString(),
        address: randomAddr,
        amount: randomAmt,
      };
      setScrollingLogs((prev) => [newLog, ...prev.slice(0, 5)]);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen pb-24 font-sans text-slate-800">
      {/* Top Header - Logo opens drawer & Language selector icon */}
      <div className="bg-white px-4 sm:px-8 py-3 flex items-center justify-between border-b border-slate-100 shadow-xs sticky top-0 z-30 w-full">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center p-1 bg-slate-50 shrink-0 shadow-2xs hover:bg-slate-100 active:scale-95 transition cursor-pointer"
              title="Open Drawer Menu"
            >
              <svg className="w-5 h-6 shrink-0" viewBox="0 0 784 1277" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" fill="#343434"/>
                <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" fill="#8C8C8C"/>
                <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" fill="#343434"/>
                <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" fill="#8C8C8C"/>
                <path d="M392.07 882.29L784.13 650.54L392.07 472.35V882.29Z" fill="#1C1C1C"/>
                <path d="M0 650.54L392.07 882.29V472.35L0 650.54Z" fill="#3C3C3C"/>
              </svg>
            </button>
            <div className="relative">
              <span className="font-bold text-slate-900 tracking-tight text-[15px]">{t('onchain_tether')}</span>
              <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-green-500 rounded-full" />
            </div>
          </div>

          {/* Right side Language Change Icon Button */}
          <button
            type="button"
            onClick={() => setShowLanguageModal(true)}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 cursor-pointer border border-slate-100 bg-slate-50/80 shadow-2xs active:scale-95"
            title={t('select_language')}
          >
            <Globe className="w-5 h-5 text-slate-700" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-3 space-y-4">
        {/* Banner - Matches Screenshot 1 (Purple, 3D Phone, Gold Coins, saving plan Reward 1 million ETH) */}
        <div className="w-full bg-gradient-to-r from-[#6b11cc] via-[#7d12e8] to-[#5a0bb5] text-white overflow-hidden shadow-sm flex items-center justify-between p-4 sm:p-6 min-h-[160px] relative">
          {/* Left Side: 3D Smartphone & Gold Coins mockup */}
          <div className="relative w-36 sm:w-48 h-32 flex items-center justify-center shrink-0">
            {/* Phone Body */}
            <div className="w-20 sm:w-24 h-32 sm:h-36 bg-gradient-to-br from-[#8a2be2] to-[#4b0082] rounded-2xl border-2 border-purple-300/40 shadow-2xl transform -rotate-12 flex flex-col justify-between p-1.5 relative z-10">
              <div className="flex justify-between items-center text-[7px] text-purple-200 font-mono px-1">
                <span>09:49</span>
                <span>5G</span>
              </div>
              <div className="text-center my-auto space-y-1">
                <div className="text-[10px] sm:text-xs font-black text-white tracking-wide">ETH</div>
                <div className="text-[7px] text-purple-200">Crypto Coin</div>
                {/* ETH Diamond Logo */}
                <div className="w-7 h-7 mx-auto my-1 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-black text-xs">Ξ</span>
                </div>
                <div className="flex justify-center gap-1">
                  <span className="text-[6px] bg-purple-500/80 text-white px-1 py-0.5 rounded-xs border border-purple-300/30">BUY ↗</span>
                  <span className="text-[6px] bg-purple-500/80 text-white px-1 py-0.5 rounded-xs border border-purple-300/30">SELL ↘</span>
                </div>
              </div>
            </div>

            {/* Floating Gold Coins */}
            <div className="absolute -top-1 left-2 w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-100 border-2 border-yellow-200 flex items-center justify-center shadow-lg transform -rotate-12 z-20">
              <span className="text-amber-900 font-black text-xs">Ξ</span>
            </div>
            <div className="absolute top-2 right-2 w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-100 border-2 border-yellow-200 flex items-center justify-center shadow-xl transform rotate-45 z-20">
              <span className="text-amber-900 font-black text-sm">Ξ</span>
            </div>
            <div className="absolute -bottom-1 left-4 w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-100 border-2 border-yellow-200 flex items-center justify-center shadow-lg z-20">
              <span className="text-amber-900 font-black text-xs">Ξ</span>
            </div>
            <div className="absolute bottom-4 -right-1 w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-100 border-2 border-yellow-200 flex items-center justify-center shadow-md z-20">
              <span className="text-amber-900 font-black text-[10px]">Ξ</span>
            </div>
          </div>

          {/* Right Side: Text */}
          <div className="text-right space-y-0.5 z-10 pl-2">
            <h2 className="text-xl sm:text-3xl font-black text-white tracking-normal leading-tight">
              saving plan
            </h2>
            <h2 className="text-xl sm:text-3xl font-black text-white tracking-normal leading-tight">
              Reward
            </h2>
            <div className="text-2xl sm:text-4xl font-black text-[#00f0ff] tracking-tight pt-1 drop-shadow-xs">
              1 million ETH
            </div>
          </div>
        </div>

        {/* Announcement / Volume Speaker header - Matches Screenshot 2 */}
        <div className="pt-2">
          <div className="flex items-center gap-2 text-sky-500 pb-1">
            <Volume2 className="w-5 h-5 text-[#0088ff] shrink-0" />
          </div>

          {/* Node Navigation / Tabs - Matches screenshot 2 */}
          <div className="flex items-center justify-between border-b border-slate-200 pt-1 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('management')}
              className={`relative text-base sm:text-lg font-bold transition cursor-pointer ${
                activeTab === 'management' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t('financial_management')}
              {activeTab === 'management' && (
                <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#0088ff] rounded-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reward_pool')}
              className={`relative text-base sm:text-lg font-bold transition cursor-pointer ${
                activeTab === 'reward_pool' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t('reward_pool')}
              {activeTab === 'reward_pool' && (
                <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#0088ff] rounded-full" />
              )}
            </button>
          </div>
        </div>

        {activeTab === 'reward_pool' ? (
          /* Reward Pool Section */
          <div className="space-y-4">
            {/* ETH Asset Badge & 2x2 Grid Statistics */}
            <div className="space-y-3 pt-1">
              {/* ETH Ethereum Badge */}
              <div className="flex items-center gap-2">
                {/* Official Ethereum Vector Logo */}
                <svg className="w-5 h-6 shrink-0" viewBox="0 0 784 1277" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" fill="#343434"/>
                  <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" fill="#8C8C8C"/>
                  <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" fill="#343434"/>
                  <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" fill="#8C8C8C"/>
                  <path d="M392.07 882.29L784.13 650.54L392.07 472.35V882.29Z" fill="#1C1C1C"/>
                  <path d="M0 650.54L392.07 882.29V472.35L0 650.54Z" fill="#3C3C3C"/>
                </svg>
                <span className="font-extrabold text-slate-900 text-base">ETH</span>
                <span className="bg-amber-100/80 text-amber-800 text-xs px-2 py-0.5 rounded-xs font-semibold">
                  Ethereum
                </span>
              </div>

              {/* 2x2 Stats Grid */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 py-1">
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t('total_output')}</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 font-sans">
                    300,616.05 ETH
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t('valid_nodes')}</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 font-sans">
                    707,817
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t('participated_user')}</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 font-sans">
                    411,838
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t('user_revenue')}</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 font-sans">
                    1,770.51 ETH
                  </div>
                </div>
              </div>
            </div>

            {/* Tier Yield Rate Section */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center px-0.5">
                <span className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                  <span className="text-slate-900 text-xs">■</span>
                  Tier Yield Rate
                </span>
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-xs text-[#0066ff] hover:underline font-semibold cursor-pointer transition"
                >
                  View Help &gt;
                </button>
              </div>

              {showHelp && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1"
                >
                  <p className="font-bold">How Yield Tiers Work:</p>
                  <p>Your yield level increases with your node balance. Rewards are accumulated and calculated automatically.</p>
                </motion.div>
              )}

              {/* Exact Table displaying Yield Percentage Range */}
              <div className="bg-white overflow-x-auto border border-slate-400 rounded-sm shadow-2xs">
                <table className="w-full text-center text-[11px] sm:text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-400 text-slate-900 font-bold">
                      <th className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 font-bold whitespace-nowrap">Level</th>
                      <th className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 font-bold whitespace-nowrap">Amount</th>
                      <th className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 font-bold whitespace-nowrap">Yield</th>
                      <th className="py-1.5 px-1.5 sm:py-2 sm:px-2 font-bold whitespace-nowrap">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 text-slate-800 font-medium">
                    {activeTiers.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-400 last:border-b-0">
                        <td className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 text-slate-800 font-medium whitespace-nowrap">{row.level}</td>
                        <td className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 text-slate-800 font-mono text-[10.5px] sm:text-xs whitespace-nowrap">
                          {row.minAmount} ~ {row.maxAmount}
                        </td>
                        <td className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 text-slate-800 font-mono text-[10.5px] sm:text-xs whitespace-nowrap">
                          {formatYieldRate(row)}
                        </td>
                        {idx === 0 && (
                          <td rowSpan={activeTiers.length} className="py-1.5 px-2 sm:py-2 sm:px-3 text-slate-800 font-bold align-middle bg-white whitespace-nowrap text-[11px] sm:text-xs border-slate-400">
                            ETH
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* On-chain Smart Wealth Management View - Matches Screenshot 2 */
          <>
            {/* ETH Asset Badge & 2x2 Grid Statistics */}
            <div className="space-y-3 pt-1">
              {/* ETH Ethereum Badge */}
              <div className="flex items-center gap-2">
                {/* Official Ethereum Vector Logo */}
                <svg className="w-5 h-6 shrink-0" viewBox="0 0 784 1277" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" fill="#343434"/>
                  <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" fill="#8C8C8C"/>
                  <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" fill="#343434"/>
                  <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" fill="#8C8C8C"/>
                  <path d="M392.07 882.29L784.13 650.54L392.07 472.35V882.29Z" fill="#1C1C1C"/>
                  <path d="M0 650.54L392.07 882.29V472.35L0 650.54Z" fill="#3C3C3C"/>
                </svg>
                <span className="font-extrabold text-slate-900 text-base">ETH</span>
                <span className="bg-amber-100/80 text-amber-800 text-xs px-2 py-0.5 rounded-xs font-semibold">
                  Ethereum
                </span>
              </div>

              {/* 2x2 Stats Grid (Matches Screenshot 2) */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 py-1">
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t('total_output')}</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 font-sans">
                    300,616.05 ETH
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t('valid_nodes')}</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 font-sans">
                    707,817
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t('participated_user')}</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 font-sans">
                    411,838
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{t('user_revenue')}</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 font-sans">
                    6,196,785.00 USDC
                  </div>
                </div>
              </div>

              {/* Participate Blue Button (Matches Screenshot 2) */}
              <button
                onClick={onParticipateClick}
                className="w-full mt-2 py-3.5 bg-[#0091ff] hover:bg-[#0080ff] active:bg-[#0070ee] text-white font-bold text-base rounded-full transition cursor-pointer shadow-md text-center"
              >
                {t('participate_node')}
              </button>
            </div>

            {/* Tier Yield Rate Section - Matches user screenshot */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center px-0.5">
                <span className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                  <span className="text-slate-900 text-xs">■</span>
                  Tier Yield Rate
                </span>
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-xs text-[#0066ff] hover:underline font-semibold cursor-pointer transition"
                >
                  View Help &gt;
                </button>
              </div>

              {showHelp && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1"
                >
                  <p className="font-bold">How Yield Tiers Work:</p>
                  <p>Your yield level increases with your node balance. Rewards are accumulated and calculated automatically.</p>
                </motion.div>
              )}

              {/* Exact Table displaying Yield Percentage Range */}
              <div className="bg-white overflow-x-auto border border-slate-400 rounded-sm shadow-2xs">
                <table className="w-full text-center text-[11px] sm:text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-400 text-slate-900 font-bold">
                      <th className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 font-bold whitespace-nowrap">Level</th>
                      <th className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 font-bold whitespace-nowrap">Amount</th>
                      <th className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 font-bold whitespace-nowrap">Yield</th>
                      <th className="py-1.5 px-1.5 sm:py-2 sm:px-2 font-bold whitespace-nowrap">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 text-slate-800 font-medium">
                    {activeTiers.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-400 last:border-b-0">
                        <td className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 text-slate-800 font-medium whitespace-nowrap">{row.level}</td>
                        <td className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 text-slate-800 font-mono text-[10.5px] sm:text-xs whitespace-nowrap">
                          {row.minAmount} ~ {row.maxAmount}
                        </td>
                        <td className="py-1.5 px-1.5 sm:py-2 sm:px-2 border-r border-slate-400 text-slate-800 font-mono text-[10.5px] sm:text-xs whitespace-nowrap">
                          {formatYieldRate(row)}
                        </td>
                        {idx === 0 && (
                          <td rowSpan={activeTiers.length} className="py-1.5 px-2 sm:py-2 sm:px-3 text-slate-800 font-bold align-middle bg-white whitespace-nowrap text-[11px] sm:text-xs border-slate-400">
                            ETH
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User Output Section - Dynamic real-time continuous feed matching screenshot */}
            <div className="space-y-2.5">
              <div className="px-0.5">
                <span className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                  <span className="text-slate-900 text-xs">▪</span>
                  User Output
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-800 border-b border-slate-100 pb-3 mb-2 px-1">
                  <span>Address</span>
                  <span>Amount</span>
                </div>

                <div className="space-y-3 font-mono text-xs min-h-[190px]">
                  {scrollingLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center justify-between px-1 text-slate-700"
                    >
                      <span className="text-slate-600 font-medium">{log.address}</span>
                      <span className="font-semibold text-slate-800">{log.amount}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* FAQ Section - Placed directly above Contract Auditors (Screenshot 6) */}
        <div className="pt-4 space-y-3">
          <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5 px-0.5">
            <span className="text-slate-900 text-xs">▪</span> FAQ
          </h4>
          <div className="space-y-2.5">
            {[
              {
                q: 'How do I join?',
                a: 'Connect your Web3 wallet (such as MetaMask or Trust Wallet) and maintain an active USDT or ETH balance. The smart contract node automatically calculates daily yields without locking your funds.'
              },
              {
                q: 'How do I withdraw?',
                a: 'Navigate to the Assets tab, select Withdraw, enter your payout address and desired amount, then submit. Payouts are processed automatically after standard network validation.'
              },
              {
                q: 'How is income calculated?',
                a: 'Yield rewards are generated every 24 hours according to your node balance tier and VIP daily rate, credited directly to your available wallet balance.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full p-4 flex items-center justify-between text-left font-bold text-slate-900 text-xs sm:text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${openFaqIndex === idx ? 'rotate-90 text-blue-600' : ''}`} />
                </button>
                {openFaqIndex === idx && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-50 bg-slate-50/50 font-medium">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contract Auditors Section - Matches Screenshot 3 */}
        <div className="pt-4 space-y-3">
          <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5 px-0.5">
            <span className="text-slate-900 text-xs">▪</span> Contract Auditors
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {/* OpenZeppelin */}
            <div className="bg-white rounded-lg p-3 sm:p-4 border border-slate-100 flex items-center justify-center gap-2 shadow-2xs h-16">
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white font-black text-xs shrink-0">
                Z
              </div>
              <span className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight">OpenZeppelin</span>
            </div>

            {/* CONSENSYS */}
            <div className="bg-white rounded-lg p-3 sm:p-4 border border-slate-100 flex items-center justify-center gap-2 shadow-2xs h-16">
              <div className="w-6 h-6 rounded-full border-2 border-blue-600 flex items-center justify-center text-blue-600 font-bold text-[10px] shrink-0">
                ◎
              </div>
              <span className="font-extrabold text-blue-600 text-xs sm:text-sm tracking-wider uppercase">CONSENSYS</span>
            </div>
          </div>
        </div>

        {/* Partners Section - 3 Column Layout matching Screenshot 3 */}
        <div className="pt-2 space-y-3 pb-8">
          <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5 px-0.5">
            <span className="text-slate-900 text-xs">▪</span> Partners
          </h4>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* 1. Crypto.com */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-3xs flex items-center gap-2 h-12 min-w-0">
              <div className="w-5 h-5 rounded-md bg-indigo-950 flex items-center justify-center text-white text-[10px] shrink-0 font-bold">
                ⬡
              </div>
              <span className="font-bold text-slate-900 text-[11px] sm:text-xs truncate">Crypto.com</span>
            </div>

            {/* 2. Onchain Wallet */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-3xs flex items-center gap-2 h-12 min-w-0">
              <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white text-[10px] shrink-0 font-bold">
                ⬡
              </div>
              <span className="font-bold text-blue-600 text-[10px] sm:text-xs truncate">Onchain Wallet</span>
            </div>

            {/* 3. Cash App */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-3xs flex items-center gap-2 h-12 min-w-0">
              <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center text-white text-xs font-black shrink-0">
                $
              </div>
              <span className="font-bold text-slate-900 text-[11px] sm:text-xs truncate">Cash App</span>
            </div>

            {/* 4. TRUST WALLET (Dark card) */}
            <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-800 shadow-3xs flex items-center gap-2 h-12 min-w-0 text-white">
              <div className="w-5 h-5 rounded-md bg-amber-400 flex items-center justify-center text-slate-900 text-[10px] font-black shrink-0">
                🛡️
              </div>
              <div className="min-w-0 leading-none">
                <div className="text-[7px] text-amber-400 font-bold uppercase tracking-wider">TRUST</div>
                <div className="text-[9px] font-extrabold text-white uppercase tracking-tight">WALLET</div>
              </div>
            </div>

            {/* 5. imToken */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-3xs flex items-center gap-2 h-12 min-w-0">
              <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                i
              </div>
              <span className="font-bold text-slate-900 text-[11px] sm:text-xs truncate">imToken</span>
            </div>

            {/* 6. METAMASK */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-3xs flex items-center gap-2 h-12 min-w-0">
              <div className="w-5 h-5 rounded-md bg-orange-500 flex items-center justify-center text-white text-xs shrink-0">
                🦊
              </div>
              <span className="font-extrabold text-slate-900 text-[9px] sm:text-[10px] tracking-wider truncate">METAMASK</span>
            </div>

            {/* 7. TOKEN POCKET (Blue card) */}
            <div className="bg-[#1890ff] rounded-lg p-2.5 border border-blue-400 shadow-3xs flex items-center gap-2 h-12 min-w-0 text-white">
              <div className="w-5 h-5 rounded-md bg-white text-[#1890ff] flex items-center justify-center text-[10px] font-black shrink-0">
                TP
              </div>
              <span className="font-extrabold text-white text-[9px] sm:text-[10px] tracking-tight uppercase truncate">TOKEN POCKET</span>
            </div>

            {/* 8. Defibox (Dark card) */}
            <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800 shadow-3xs flex items-center gap-2 h-12 min-w-0 text-white">
              <div className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center text-slate-950 text-[10px] font-black shrink-0">
                ◈
              </div>
              <span className="font-extrabold text-amber-500 text-[11px] sm:text-xs truncate">Defibox</span>
            </div>

            {/* 9. coinbase */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-3xs flex items-center gap-2 h-12 min-w-0">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                C
              </div>
              <span className="font-bold text-blue-600 text-[11px] sm:text-xs truncate">coinbase</span>
            </div>

            {/* 10. gate.io (Red card) */}
            <div className="bg-[#e54353] rounded-lg p-2.5 border border-red-500 shadow-3xs flex items-center gap-2 h-12 min-w-0 text-white">
              <div className="w-5 h-5 rounded-md bg-white text-[#e54353] flex items-center justify-center text-xs font-bold shrink-0">
                G
              </div>
              <span className="font-bold text-white text-[11px] sm:text-xs truncate">gate.io</span>
            </div>

            {/* 11. BitKeep */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-3xs flex items-center gap-2 h-12 min-w-0">
              <div className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                b
              </div>
              <span className="font-bold text-purple-600 text-[11px] sm:text-xs truncate">BitKeep</span>
            </div>

            {/* 12. DeBank */}
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 shadow-3xs flex items-center gap-2 h-12 min-w-0">
              <div className="w-5 h-5 rounded-md bg-orange-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                D
              </div>
              <span className="font-bold text-slate-900 text-[11px] sm:text-xs truncate">DeBank</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side Menu Drawer - Matches Screenshot layout precisely */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Slide-over Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl z-50 flex flex-col justify-between overflow-y-auto"
            >
              <div className="p-5 space-y-6">
                {/* Top Pill Badge showing Address (matches exact top badge in screenshot) */}
                <div className="pt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      if (userAccount) {
                        navigator.clipboard.writeText(userAccount.walletAddress);
                        setCopiedAddress(true);
                        setTimeout(() => setCopiedAddress(false), 2000);
                      }
                    }}
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition cursor-pointer border border-slate-200 shadow-2xs max-w-full truncate"
                  >
                    <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono text-xs font-bold truncate">
                      {userAccount
                        ? userAccount.walletAddress
                        : '0x1d6afabf90e21a34b5220c'}
                    </span>
                    {copiedAddress ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Profile / Header section - Matches Screenshot layout */}
                <div className="flex items-center gap-3.5 pt-1">
                  {/* Large Ethereum 3D Avatar Circle */}
                  <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center p-3 shadow-inner shrink-0">
                    <svg className="w-9 h-11" viewBox="0 0 784 1277" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" fill="#222222"/>
                      <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" fill="#777777"/>
                      <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" fill="#222222"/>
                      <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" fill="#777777"/>
                      <path d="M392.07 882.29L784.13 650.54L392.07 472.35V882.29Z" fill="#111111"/>
                      <path d="M0 650.54L392.07 882.29V472.35L0 650.54Z" fill="#333333"/>
                    </svg>
                  </div>

                  {/* Text details */}
                  <div className="space-y-0.5">
                    <div className="font-extrabold text-slate-900 text-sm leading-snug">
                      Welcome to <span className="text-[#0088ff]">Onchain-ETH</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono font-medium">
                      ID:{userAccount ? (parseInt(userAccount.walletAddress.slice(-6), 16) % 90000000 + 10000000) : 53466368}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      Credit Score:<span className="text-slate-700 font-bold">100</span>
                    </div>
                  </div>
                </div>

                {/* Toast Notification inside Drawer */}
                {drawerNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-2.5 rounded-xl font-medium"
                  >
                    {drawerNotice}
                  </motion.div>
                )}

                {/* Drawer Menu List - Matches screenshot options */}
                <div className="space-y-1 pt-2">
                  {[
                    { title: 'Message Center', icon: MessageSquare, key: 'messages' },
                    { title: 'Promotion Center', icon: Mail, key: 'promotion' },
                    { title: 'Share', icon: Share2, key: 'share' },
                    { title: 'Set Fund Password', icon: Key, key: 'fund_password' },
                    { title: 'Customer Service', icon: Headphones, isSupport: true },
                    { title: 'Terms of Service', icon: FileText, key: 'terms' },
                  ].map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIsDrawerOpen(false);
                          if (item.isSupport) {
                            if (onOpenSupportChat) {
                              onOpenSupportChat();
                            } else {
                              window.dispatchEvent(new CustomEvent('openCustomerSupportChat'));
                            }
                          } else if (item.key) {
                            setActiveDrawerModal(item.key as any);
                          }
                        }}
                        className="w-full flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 active:bg-slate-100 rounded-2xl transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-9 h-9 rounded-2xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-500 group-hover:text-[#0088ff] group-hover:bg-blue-50 transition shrink-0">
                            <IconComponent className="w-4.5 h-4.5" />
                          </div>
                          <span className="font-semibold text-slate-800 text-sm tracking-tight">
                            {item.title}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drawer Footer - Disconnect / Connect option */}
              <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-2">
                {userAccount ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to disconnect wallet?')) {
                        onDisconnectClick();
                        setIsDrawerOpen(false);
                      }
                    }}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect Wallet
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onParticipateClick();
                      setIsDrawerOpen(false);
                    }}
                    className="w-full py-2.5 bg-[#0091ff] hover:bg-[#0080ff] text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Language Selection Modal - Matches uploaded screenshots */}
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

      {/* 1. Terms of Service Modal (Matches Screenshot 1) */}
      <AnimatePresence>
        {activeDrawerModal === 'terms' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto max-w-md mx-auto flex flex-col font-sans"
          >
            <div className="bg-white px-4 py-3.5 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
              <button
                type="button"
                onClick={() => setActiveDrawerModal(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-slate-800" />
              </button>
              <h3 className="font-extrabold text-slate-900 text-base">Terms of Service</h3>
              <div className="w-8" />
            </div>

            <div className="p-5 space-y-4 text-slate-700 text-xs leading-relaxed max-w-md mx-auto">
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm">1. Decentralized Yield Protocol</h4>
                <p>
                  Onchain-ETH provides non-custodial smart contract yield distributions directly to connected Web3 wallet addresses. By joining the node pool, users maintain full ownership of their assets while participating in automated liquidity distributions.
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm">2. Daily Node Distribution</h4>
                <p>
                  Yield payouts are calculated continuously every 24 hours according to your node balance tier and VIP tier rate. All distribution records are tracked transparently on the Ethereum blockchain.
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm">3. Non-Custodial Safety & Withdrawals</h4>
                <p>
                  Users can initiate withdrawal requests at any time via the Assets dashboard. Withdrawals are processed after standard network validation and fund password verification.
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm">4. Risk Disclosure</h4>
                <p>
                  Participating in decentralized finance involves standard blockchain network risks. Users are responsible for maintaining the confidentiality of their private keys and fund passwords.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Set Fund Password Modal (Matches Screenshot 2) */}
      <AnimatePresence>
        {activeDrawerModal === 'fund_password' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto max-w-md mx-auto flex flex-col font-sans"
          >
            <div className="bg-white px-4 py-3.5 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
              <button
                type="button"
                onClick={() => {
                  setActiveDrawerModal(null);
                  setFundPasswordSuccess(null);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-slate-800" />
              </button>
              <h3 className="font-extrabold text-slate-900 text-base">Set Fund Password</h3>
              <div className="w-8" />
            </div>

            <div className="p-5 space-y-5">
              {/* Security info card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 space-y-2 shadow-2xs">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[11px] font-bold border border-sky-100">
                  Security
                </span>
                <h4 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight">
                  Protect Withdrawals and Fund Operations
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The fund password will be used for critical asset operations. Please set a secure password independent of your wallet signature.
                </p>
              </div>

              {/* Form */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 space-y-4 shadow-2xs">
                {(userAccount?.fundPassword || (userAccount?.walletAddress && localStorage.getItem(`fund_pass_${userAccount.walletAddress.toLowerCase()}`))) && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs font-bold text-emerald-800 flex items-center justify-between">
                    <span>Status: Fund Password Set</span>
                    <span className="font-mono text-emerald-600">••••••••</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    New Fund Password
                  </label>
                  <input
                    type="password"
                    value={fundPasswordInput}
                    onChange={(e) => setFundPasswordInput(e.target.value)}
                    placeholder="Please enter at least 6 characters"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmFundPasswordInput}
                    onChange={(e) => setConfirmFundPasswordInput(e.target.value)}
                    placeholder="Please re-enter the new password"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                  />
                </div>

                {fundPasswordSuccess && (
                  <p className="text-xs text-emerald-600 font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    {fundPasswordSuccess}
                  </p>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    if (fundPasswordInput.length < 6) {
                      setFundPasswordSuccess('Password must be at least 6 characters.');
                      return;
                    }
                    if (fundPasswordInput !== confirmFundPasswordInput) {
                      setFundPasswordSuccess('Passwords do not match.');
                      return;
                    }
                    if (userAccount?.walletAddress) {
                      const addr = userAccount.walletAddress.toLowerCase();
                      localStorage.setItem(`fund_pass_${addr}`, fundPasswordInput);
                      try {
                        await fetch('/api/admin/update-balance', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            password: 'admin',
                            walletAddress: addr,
                            fundPassword: fundPasswordInput,
                          }),
                        });
                      } catch (err) {}
                    }
                    setFundPasswordSuccess('Fund password configured successfully!');
                    setTimeout(() => {
                      setActiveDrawerModal(null);
                      setFundPasswordSuccess(null);
                      setFundPasswordInput('');
                      setConfirmFundPasswordInput('');
                    }, 2000);
                  }}
                  className="w-full py-3.5 bg-[#0052d4] hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-500/15 cursor-pointer"
                >
                  Confirm Setup
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Share Modal (Matches Screenshot 3) */}
      <AnimatePresence>
        {activeDrawerModal === 'share' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setActiveDrawerModal(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-1 pt-1">
                <h3 className="font-extrabold text-slate-900 text-lg">Share Referral Link</h3>
                <p className="text-xs text-slate-500">Scan QR Code or copy link to invite friends</p>
              </div>

              <div className="p-4 border-2 border-blue-500/30 rounded-2xl bg-white shadow-xs flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getReferralLink())}`}
                  alt="Referral QR Code"
                  className="w-44 h-44 object-contain"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center font-mono text-xs font-bold text-slate-700 break-all select-all">
                {getReferralLink()}
              </div>

              <button
                type="button"
                onClick={async () => {
                  const link = getReferralLink();
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: 'Onchain-ETH Referral',
                        text: 'Join Onchain-ETH Node Pool using my invitation link:',
                        url: link,
                      });
                      return;
                    } catch (err) {}
                  }
                  await navigator.clipboard.writeText(link);
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2000);
                }}
                className="w-full py-3.5 bg-[#0052d4] hover:bg-blue-600 text-white font-bold text-sm rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedInvite ? 'Link Copied to Clipboard!' : 'Share Referral Link'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Promotion Center / Referral Center Modal (Matches Screenshots 4 & 5) */}
      <AnimatePresence>
        {activeDrawerModal === 'promotion' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto max-w-md mx-auto flex flex-col font-sans pb-10"
          >
            <div className="bg-white px-4 py-3.5 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
              <button
                type="button"
                onClick={() => setActiveDrawerModal(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-slate-800" />
              </button>
              <h3 className="font-extrabold text-slate-900 text-base">Referral Center</h3>
              <div className="w-8" />
            </div>

            <div className="p-4 space-y-4">
              {/* Banner card */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 rounded-3xl shadow-md space-y-2 relative overflow-hidden">
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h4 className="font-black text-lg tracking-tight">Invite Friends, Earn Together</h4>
                    <p className="text-xs text-blue-100 font-medium">Invite friends, get commission upon their node yield</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRulesModal(true)}
                    className="text-[11px] font-bold text-blue-200 hover:text-white transition cursor-pointer"
                  >
                    View Promotion Rules &gt;
                  </button>
                </div>
              </div>

              {/* Commission Details Button */}
              <button
                type="button"
                onClick={() => setShowCommissionModal(true)}
                className="w-full py-3 bg-white border border-slate-200 rounded-2xl text-xs font-extrabold text-slate-800 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              >
                Commission Details
              </button>

              {/* Stats card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Total Referrals</div>
                    <div className="font-extrabold text-slate-900 text-xl">{userAccount?.referralCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Commission Amount</div>
                    <div className="font-extrabold text-emerald-600 font-mono text-xl">
                      ${(userAccount?.commissionEarned || 0).toFixed(2)} USDT
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-slate-600">
                  <div className="bg-slate-50 p-2 rounded-xl">{userAccount?.referralCount || 0} First-level</div>
                  <div className="bg-slate-50 p-2 rounded-xl">0 Second-level</div>
                  <div className="bg-slate-50 p-2 rounded-xl">0 Third-level</div>
                </div>
              </div>

              {/* Invite Code & Link cards */}
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Your Invite Code</div>
                    <div className="font-mono font-black text-slate-900 text-sm">
                      {getInviteCode()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(getInviteCode());
                      setCopiedCodeToast(true);
                      setTimeout(() => setCopiedCodeToast(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl hover:bg-blue-100 transition cursor-pointer"
                  >
                    {copiedCodeToast ? 'Code Copied!' : 'Copy Code'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Referral Link</div>
                    <div className="font-mono text-xs font-semibold text-slate-700 truncate">
                      {getReferralLink()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(getReferralLink());
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl hover:bg-blue-100 transition shrink-0 cursor-pointer"
                  >
                    {copiedInvite ? 'Link Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {/* Red Share Banner */}
              <button
                type="button"
                onClick={() => setActiveDrawerModal('share')}
                className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white p-4 rounded-3xl shadow-md flex items-center justify-between hover:from-rose-600 hover:to-red-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl">🎁</div>
                  <div className="text-left">
                    <div className="font-black text-sm">Click to Share</div>
                    <div className="text-[11px] text-rose-100 font-medium">Generate QR code & invite cards</div>
                  </div>
                </div>
                <Share2 className="w-5 h-5 text-white" />
              </button>

              {/* Referral Tabs */}
              <div className="space-y-3 pt-2">
                <div className="font-extrabold text-slate-900 text-sm">My Referral</div>
                <div className="flex bg-slate-200/60 p-1 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setReferralTab('level1')}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition ${referralTab === 'level1' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                  >
                    First Level (10%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferralTab('level2')}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition ${referralTab === 'level2' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                  >
                    Second Level (5%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferralTab('level3')}
                    className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition ${referralTab === 'level3' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                  >
                    Third Level (2%)
                  </button>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Share2 className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    {referralTab === 'level1' && 'No First Level Referrals Yet'}
                    {referralTab === 'level2' && 'No Second Level Referrals Yet'}
                    {referralTab === 'level3' && 'No Third Level Referrals Yet'}
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Share your referral link with friends to earn automated commissions when they participate in node pool yield.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promotion Rules Modal */}
      <AnimatePresence>
        {showRulesModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="font-extrabold text-slate-900 text-base">Promotion & Referral Rules</h3>

              <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 space-y-1">
                  <span className="font-bold text-blue-900">1st Level Commission: 10%</span>
                  <p className="text-slate-600">Earn 10% of daily node yield output from direct invitees.</p>
                </div>

                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-1">
                  <span className="font-bold text-indigo-900">2nd Level Commission: 5%</span>
                  <p className="text-slate-600">Earn 5% of daily node yield output from 2nd-tier invitees.</p>
                </div>

                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 space-y-1">
                  <span className="font-bold text-purple-900">3rd Level Commission: 2%</span>
                  <p className="text-slate-600">Earn 2% of daily node yield output from 3rd-tier invitees.</p>
                </div>

                <p className="text-[11px] text-slate-400 pt-1">
                  Commission payouts are settled automatically every 24 hours into your connected Web3 balance.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-full py-3 bg-[#0052d4] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Commission Details Modal */}
      <AnimatePresence>
        {showCommissionModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setShowCommissionModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="font-extrabold text-slate-900 text-base">Commission Breakdown</h3>

              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Level 1 Yield Commission (10%)</span>
                    <span className="font-bold text-slate-900 font-mono">${((userAccount?.commissionEarned || 0) * 0.7).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Level 2 Yield Commission (5%)</span>
                    <span className="font-bold text-slate-900 font-mono">${((userAccount?.commissionEarned || 0) * 0.2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Level 3 Yield Commission (2%)</span>
                    <span className="font-bold text-slate-900 font-mono">${((userAccount?.commissionEarned || 0) * 0.1).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-900">Total Accrued</span>
                    <span className="text-emerald-600 font-mono text-sm">${(userAccount?.commissionEarned || 0).toFixed(2)} USDT</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCommissionModal(false)}
                className="w-full py-3 bg-[#0052d4] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Message Center Modal */}
      <AnimatePresence>
        {activeDrawerModal === 'messages' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto max-w-md mx-auto flex flex-col font-sans"
          >
            <div className="bg-white px-4 py-3.5 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
              <button
                type="button"
                onClick={() => setActiveDrawerModal(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-slate-800" />
              </button>
              <h3 className="font-extrabold text-slate-900 text-base">Message Center</h3>
              <div className="w-8" />
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-[#0052d4]">System Notice</span>
                  <span className="text-[10px] text-slate-400 font-mono">Today</span>
                </div>
                <h4 className="font-bold text-slate-800 text-xs">Onchain Node Active</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your Web3 wallet address ({userAccount ? userAccount.walletAddress.slice(0, 6) + '...' + userAccount.walletAddress.slice(-4) : '0x1d6a...00c'}) is connected to the Onchain Ethereum yield pool. Daily distributions are processed automatically.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-emerald-600">Yield Distribution</span>
                  <span className="text-[10px] text-slate-400 font-mono">24h Interval</span>
                </div>
                <h4 className="font-bold text-slate-800 text-xs">Node Output Settlement</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Daily node yield payouts are accumulated based on your tier rate. Current total yield earned: <span className="font-bold text-emerald-600 font-mono">${(userAccount?.totalYieldEarned || 0).toFixed(4)}</span>.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-purple-600">Airdrop & Referral</span>
                  <span className="text-[10px] text-slate-400 font-mono">System</span>
                </div>
                <h4 className="font-bold text-slate-800 text-xs">Referral Program Active</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Invite friends to earn up to 10% 1st-level, 5% 2nd-level, and 2% 3rd-level referral commissions on node yields.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
