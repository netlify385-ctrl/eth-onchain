import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw, X, Coins, ShieldAlert, CheckCircle2, Info, LogOut, ArrowLeft, Copy, Check, ChevronDown, ChevronRight, Camera, History, Globe } from 'lucide-react';
import { UserAccount, AppConfig, TransactionLog } from '../types';
import { LANGUAGES, useLanguage } from '../lib/i18n';
import { fetchLogsFromFirestore } from '../lib/firebase';

interface AssetsTabProps {
  userAccount: UserAccount | null;
  connectedAddress: string | null;
  config: AppConfig | null;
  onConnectClick: () => void;
  onDisconnectClick: () => void;
  onDepositSubmit: (amount: number, currency: string, isSimulated: boolean) => Promise<void>;
  onWithdrawSubmit: (amount: number, currency: string) => Promise<void>;
  onExchangeSubmit: (fromCurrency: string, toCurrency: string, amount: number) => Promise<void>;
  initialModal?: 'deposit' | 'withdraw' | 'exchange' | null;
  initialDepositAmount?: string;
  onClearInitialModal?: () => void;
}

export default function AssetsTab({
  userAccount,
  connectedAddress,
  config,
  onConnectClick,
  onDisconnectClick,
  onDepositSubmit,
  onWithdrawSubmit,
  onExchangeSubmit,
  initialModal = null,
  initialDepositAmount = '',
  onClearInitialModal
}: AssetsTabProps) {
  const { t, setLanguage, langName } = useLanguage();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'exchange' | null>(initialModal);
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');
  const [selectedDepositNetwork, setSelectedDepositNetwork] = useState('USDT-ETH');
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [showDepositHistory, setShowDepositHistory] = useState(false);

  // Withdraw page custom states
  const [withdrawAddressInput, setWithdrawAddressInput] = useState('');
  const [withdrawCurrency, setWithdrawCurrency] = useState('USDT-ETH');
  const [showWithdrawCurrencyDropdown, setShowWithdrawCurrencyDropdown] = useState(false);
  const [showWithdrawHistory, setShowWithdrawHistory] = useState(false);

  const [exchangeFrom, setExchangeFrom] = useState('USDT');
  const [exchangeTo, setExchangeTo] = useState('USDC');
  const [actionAmount, setActionAmount] = useState(initialDepositAmount || '');
  const [historyLogs, setHistoryLogs] = useState<TransactionLog[]>([]);

  // Fetch real transaction logs for the connected user
  useEffect(() => {
    if (!connectedAddress) return;
    const loadUserLogs = async () => {
      const addr = connectedAddress.toLowerCase();
      let combinedLogs: TransactionLog[] = [];

      // 1. Fetch from server API
      try {
        const res = await fetch(`/api/user/${addr}/logs`);
        if (res.ok) {
          const data = await res.json();
          if (data.logs && Array.isArray(data.logs)) {
            combinedLogs = [...combinedLogs, ...data.logs];
          }
        }
      } catch (e) {
        console.warn('Failed to fetch user logs from API:', e);
      }

      // 2. Fetch from Firestore
      try {
        const fsLogs = await fetchLogsFromFirestore();
        const userFsLogs = fsLogs.filter(l => l.walletAddress.toLowerCase() === addr);
        combinedLogs = [...combinedLogs, ...userFsLogs];
      } catch (e) {
        console.warn('Failed to fetch user logs from Firestore:', e);
      }

      // 3. Deduplicate by ID / timestamp and sort by timestamp desc
      const logMap = new Map<string, TransactionLog>();
      combinedLogs.forEach(l => {
        const key = l.id || `${l.timestamp}_${l.type}_${l.amount}`;
        if (!logMap.has(key) || (l.status === 'success' || l.status === 'failed')) {
          logMap.set(key, l);
        }
      });

      const sorted = Array.from(logMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setHistoryLogs(sorted);
    };

    loadUserLogs();
    const interval = setInterval(loadUserLogs, 3000);
    return () => clearInterval(interval);
  }, [connectedAddress, showDepositHistory, showWithdrawHistory, activeModal]);

  useEffect(() => {
    if (initialModal !== undefined) {
      setActiveModal(initialModal);
    }
  }, [initialModal]);

  useEffect(() => {
    if (initialDepositAmount !== undefined && initialDepositAmount !== '') {
      setActionAmount(initialDepositAmount);
    }
  }, [initialDepositAmount]);
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const minDepositUSDT = config?.minDepositUSDT ?? 10;
  const minWithdrawUSDT = config?.minWithdrawUSDT ?? 10;

  useEffect(() => {
    if (activeModal === 'withdraw' && !withdrawAddressInput) {
      setWithdrawAddressInput(connectedAddress || '0x1d6afabf008892f1c04b39d8f42a7f4f5ecbd64c');
    }
  }, [activeModal, connectedAddress]);

  const [recipientAddress, setRecipientAddress] = useState(() => {
    return localStorage.getItem('custom_recipient_address') || config?.recipientAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d1476B';
  });

  useEffect(() => {
    const updated = localStorage.getItem('custom_recipient_address') || config?.recipientAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d1476B';
    setRecipientAddress(updated);
  }, [config, activeModal]);

  const depositNetworks = [
    { id: 'USDT-ETH', name: 'USDT-ETH (Ethereum Chain)', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040' },
    { id: 'USDC-ETH', name: 'USDC-ETH (Ethereum Chain)', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=040' }
  ];

  const officialChannels = [
    {
      name: 'Trust Wallet Official Deposit Channel',
      url: 'https://trustwallet.com',
      logo: '🛡️',
      color: 'bg-blue-600'
    },
    {
      name: 'Crypto.com Official Deposit Channel',
      url: 'https://crypto.com',
      logo: '⬡',
      color: 'bg-indigo-950'
    },
    {
      name: 'Cash App Official Deposit Channel',
      url: 'https://cash.app',
      logo: '$',
      color: 'bg-emerald-500'
    },
    {
      name: 'Coinbase Official Deposit Channel',
      url: 'https://www.coinbase.com',
      logo: 'C',
      color: 'bg-blue-600'
    },
    {
      name: 'Binance Official Deposit Channel',
      url: 'https://www.binance.com',
      logo: '❖',
      color: 'bg-amber-500'
    },
    {
      name: 'Huobi Official Deposit Channel',
      url: 'https://www.htx.com',
      logo: '🔥',
      color: 'bg-sky-600'
    }
  ];

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(recipientAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!connectedAddress) {
    // Wallet connection teaser screen
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 border border-blue-100">
          <Wallet className="w-10 h-10" />
        </div>
        <h3 className="font-extrabold text-slate-800 text-lg mb-2">My Spot Assets</h3>
        <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
          Please connect your Web3 MetaMask or EVM wallet to view on-chain smart asset balances and yield records.
        </p>
        <button
          onClick={onConnectClick}
          className="px-8 py-3 bg-[#0052d4] hover:bg-blue-700 text-white font-bold rounded-full transition shadow-lg shadow-blue-500/25 cursor-pointer text-sm animate-pulse"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // Fallback default state just in case, but now App.tsx has localStorage sync so this is rare
  const account = userAccount || {
    walletAddress: connectedAddress,
    usdtBalance: 0,
    occupiedUSDT: 0,
    totalYieldEarned: 0,
    usdcBalance: 0,
    occupiedUSDC: 0,
    btcBalance: 0,
    occupiedBTC: 0,
    lastYieldPayout: Date.now(),
    createdAt: Date.now()
  } as any;

  // Calculate total balance converted to USDC/USDT equivalent (1 BTC = 65000, 1 ETH = 3500, 1 USDT/USDC = 1)
  const usdtTotal = (account.usdtBalance || 0) + (account.occupiedUSDT || 0);
  const usdcTotal = (account.usdcBalance || 0) + (account.occupiedUSDC || 0);
  const btcTotal = (account.btcBalance || 0) + (account.occupiedBTC || 0);
  const ethTotal = (account.ethBalance || 0) + (account.occupiedETH || 0);
  const totalAssetsUSDC = usdtTotal + usdcTotal + (btcTotal * 65000) + (ethTotal * 3500);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(actionAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid deposit amount.');
      return;
    }
    if (amt < minDepositUSDT) {
      setErrorMsg(`Minimum deposit amount is $${minDepositUSDT} USDT.`);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await (onDepositSubmit as any)(amt, selectedDepositNetwork, true, uploadPreview);
      setSuccessMsg(`Deposit request submitted successfully! ${amt} ${selectedDepositNetwork} will be added to your account balance upon Admin review and approval.`);
      setActionAmount('');
      setUploadPreview(null);
      setTimeout(() => {
        setSuccessMsg('');
        setActiveModal(null);
      }, 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Deposit request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (account.isWithdrawLocked) {
      setErrorMsg(account.withdrawLockNotice || 'Your withdrawal functionality is locked by admin. Please contact support.');
      return;
    }
    const amt = parseFloat(actionAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid withdrawal amount.');
      return;
    }
    if (amt < minWithdrawUSDT) {
      setErrorMsg(`Minimum withdrawal amount is ${minWithdrawUSDT} ${selectedCurrency}.`);
      return;
    }
    const avail = getAvailableBalanceFor(selectedCurrency);
    if (amt > avail) {
      setErrorMsg(`Insufficient available balance. Max withdrawable is ${avail} ${selectedCurrency}.`);
      return;
    }
    if (!withdrawAddressInput.trim()) {
      setErrorMsg('Please enter a valid withdrawal address.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await onWithdrawSubmit(amt, selectedCurrency);
      setSuccessMsg(`Withdrawal of ${amt} ${selectedCurrency} requested successfully!`);
      setActionAmount('');
      setTimeout(() => {
        setSuccessMsg('');
        setActiveModal(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(actionAmount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid swap amount.');
      return;
    }
    if (exchangeFrom === exchangeTo) {
      setErrorMsg('Cannot exchange between identical currencies.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await onExchangeSubmit(exchangeFrom, exchangeTo, amt);
      setSuccessMsg(`Exchanged ${amt} ${exchangeFrom} to ${exchangeTo} successfully!`);
      setActionAmount('');
      setTimeout(() => {
        setSuccessMsg('');
        setActiveModal(null);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Exchange failed');
    } finally {
      setLoading(false);
    }
  };

  const coinsList = [
    {
      name: 'USDT',
      fullname: 'Tether USDT',
      logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040',
      available: account.usdtBalance || 0,
      occupied: account.occupiedUSDT || 0,
      converted: usdtTotal,
      color: 'text-teal-500'
    },
    {
      name: 'USDC',
      fullname: 'USD Coin USDC',
      logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=040',
      available: account.usdcBalance || 0,
      occupied: account.occupiedUSDC || 0,
      converted: usdcTotal,
      color: 'text-blue-500'
    },
    {
      name: 'BTC',
      fullname: 'Bitcoin BTC',
      logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040',
      available: account.btcBalance || 0,
      occupied: account.occupiedBTC || 0,
      converted: btcTotal * 65000,
      color: 'text-amber-500'
    },
    {
      name: 'ETH',
      fullname: 'Ethereum ETH',
      logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040',
      available: account.ethBalance || 0,
      occupied: account.occupiedETH || 0,
      converted: ethTotal * 3500,
      color: 'text-indigo-500'
    }
  ];

  const getExchangeRateText = () => {
    if (exchangeFrom === 'BTC') {
      if (exchangeTo === 'ETH') return `1 BTC = ${(65000 / 3500).toFixed(4)} ETH`;
      return `1 BTC = 65,000 ${exchangeTo}`;
    } else if (exchangeTo === 'BTC') {
      if (exchangeFrom === 'ETH') return `1 ETH = ${(3500 / 65000).toFixed(8)} BTC`;
      return `1 ${exchangeFrom} = ${(1 / 65000).toFixed(8)} BTC`;
    } else if (exchangeFrom === 'ETH') {
      return `1 ETH = 3,500 ${exchangeTo}`;
    } else if (exchangeTo === 'ETH') {
      return `1 ${exchangeFrom} = ${(1 / 3500).toFixed(6)} ETH`;
    }
    return `1 ${exchangeFrom} = 1.000000 ${exchangeTo}`;
  };

  const getEstimatedReceived = () => {
    const amt = parseFloat(actionAmount) || 0;
    if (exchangeFrom === 'BTC' && exchangeTo === 'ETH') return (amt * (65000 / 3500)).toFixed(4);
    if (exchangeFrom === 'BTC') return (amt * 65000).toFixed(4);
    if (exchangeTo === 'BTC' && exchangeFrom === 'ETH') return (amt * (3500 / 65000)).toFixed(6);
    if (exchangeTo === 'BTC') return (amt / 65000).toFixed(6);
    if (exchangeFrom === 'ETH') return (amt * 3500).toFixed(4);
    if (exchangeTo === 'ETH') return (amt / 3500).toFixed(6);
    return amt.toFixed(4);
  };

  const getAvailableBalanceFor = (coin: string) => {
    if (coin === 'USDT') return account.usdtBalance || 0;
    if (coin === 'USDC') return account.usdcBalance || 0;
    if (coin === 'BTC') return account.btcBalance || 0;
    if (coin === 'ETH') return account.ethBalance || 0;
    return 0;
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24 font-sans text-slate-800">
      {/* Top Assets Card Banner - Matches Screenshot 2 perfectly with solid blue vibe */}
      <div className="bg-[#0052d4] px-6 pt-8 pb-8 text-white relative overflow-hidden shadow-md">
        <div className="w-full max-w-7xl mx-auto space-y-5">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] text-blue-100 font-bold tracking-wide uppercase opacity-80">
                {t('account_balance')} (USDT)
              </div>
              <div className="text-4xl font-extrabold mt-1.5 tracking-tight font-sans">
                {totalAssetsUSDC.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLanguageModal(true)}
                className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/25 text-blue-100 hover:text-white rounded-lg transition cursor-pointer flex items-center justify-center gap-1 text-[10px] font-bold px-2.5 shrink-0"
                title={t('select_language')}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{langName}</span>
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to disconnect this wallet?')) {
                    onDisconnectClick();
                  }
                }}
                className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/25 text-blue-100 hover:text-white rounded-lg transition cursor-pointer flex items-center justify-center gap-1 text-[10px] font-bold px-3 shrink-0"
                title="Disconnect"
              >
                <LogOut className="w-3 h-3" />
                Disconnect
              </button>
            </div>
          </div>

          {/* Action buttons list - Matches Screenshot 2 side-by-side style */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            <button
              onClick={() => { setSelectedCurrency('USDT'); setActionAmount(''); setErrorMsg(''); setSuccessMsg(''); setActiveModal('deposit'); }}
              className="py-2.5 border border-white/30 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-white"
            >
              <ArrowDownCircle className="w-4 h-4" />
              {t('deposit')}
            </button>
            <button
              onClick={() => { setSelectedCurrency('USDT'); setActionAmount(''); setErrorMsg(''); setSuccessMsg(''); setActiveModal('withdraw'); }}
              className="py-2.5 border border-white/30 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-white"
            >
              <ArrowUpCircle className="w-4 h-4" />
              {t('withdraw')}
            </button>
            <button
              onClick={() => { setExchangeFrom('USDT'); setExchangeTo('USDC'); setActionAmount(''); setErrorMsg(''); setSuccessMsg(''); setActiveModal('exchange'); }}
              className="py-2.5 border border-white/30 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-xs transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('exchange')}
            </button>
          </div>
        </div>
      </div>

      {/* Spot Account Details - Matches Screenshot 2 */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-6 space-y-4">
        {/* Navigation Indicator & Loading text */}
        <div className="flex justify-between items-center border-b border-slate-200 text-xs font-semibold">
          <div className="relative py-2.5 pr-6 text-[#0052d4] font-extrabold text-sm">
            Spot Account
            <div className="absolute bottom-0 left-0 right-6 h-0.5 bg-[#0052d4] rounded-full" />
          </div>
          <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Loading...
          </span>
        </div>

        {/* Dynamic Accrued Yield Summary Alert */}
        {account.totalYieldEarned > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 shadow-3xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Yield Farm Active:</span> Accrued{' '}
              <span className="font-mono font-bold text-emerald-700">
                {account.totalYieldEarned.toFixed(6)}
              </span>{' '}
              USDT value so far. Compounding payouts CompoundingPayout node updated in real-time.
            </div>
          </div>
        )}

        {/* Spot Account Items List */}
        <div className="space-y-3">
          {coinsList.map((coin, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-3xs hover:border-slate-200 transition space-y-3"
            >
              {/* Header section: Coin symbol, name and converted USDT value */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center p-1.5 border border-slate-100 shrink-0">
                    <img src={coin.logo} alt={coin.fullname} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-800 text-[14px]">{coin.name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{coin.fullname}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Converted (USDT)</span>
                  <span className="font-mono font-extrabold text-[#0052d4] text-[13px] mt-0.5 block">
                    {coin.converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Sub-grid panel: Available and Occupied balances with absolute spacing */}
              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100/60 text-xs">
                <div className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-100/50">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Available Balance</span>
                  <span className="font-mono font-extrabold text-slate-800 text-[11px] block truncate" title={coin.available.toString()}>
                    {coin.available.toLocaleString('en-US', { maximumFractionDigits: 6 })} <span className="text-[10px] text-slate-500 font-medium">{coin.name}</span>
                  </span>
                </div>

                <div className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-100/50">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Occupied Balance</span>
                  <span className="font-mono font-extrabold text-slate-500 text-[11px] block truncate" title={coin.occupied.toString()}>
                    {coin.occupied.toLocaleString('en-US', { maximumFractionDigits: 6 })} <span className="text-[10px] text-slate-400 font-medium">{coin.name}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dedicated Full Deposit Page View (Matches Screenshots 1 & 2) */}
      <AnimatePresence>
        {activeModal === 'deposit' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-white z-50 overflow-y-auto max-w-md mx-auto flex flex-col font-sans pb-10"
          >
            {/* Header Bar */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
              <button
                onClick={() => {
                  setActiveModal(null);
                  setUploadPreview(null);
                  setErrorMsg('');
                  setSuccessMsg('');
                  if (onClearInitialModal) onClearInitialModal();
                }}
                className="p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-slate-800" />
              </button>
              <h3 className="font-bold text-slate-900 text-base">Deposit</h3>
              <button
                onClick={() => setShowDepositHistory(!showDepositHistory)}
                className="p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
                title="Deposit History"
              >
                <History className="w-5 h-5 text-slate-700" />
              </button>
            </div>

            {showDepositHistory ? (
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#0052d4]" />
                    <h4 className="font-bold text-slate-800 text-sm">Deposit History</h4>
                  </div>
                  <button
                    onClick={() => setShowDepositHistory(false)}
                    className="text-xs text-[#0052d4] font-bold cursor-pointer hover:underline"
                  >
                    &larr; Back to Deposit
                  </button>
                </div>

                {historyLogs.filter((l) => l.type === 'deposit').length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <History className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold">No deposit history records found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyLogs
                      .filter((l) => l.type === 'deposit')
                      .map((log, idx) => {
                        const statusColor =
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.status === 'failed'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200';

                        const statusText =
                          log.status === 'success'
                            ? 'Approved'
                            : log.status === 'failed'
                            ? 'Rejected'
                            : 'Pending';

                        return (
                          <div
                            key={log.id || idx}
                            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-2 hover:border-slate-200 transition"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-900 text-sm">
                                Deposit {log.currency || 'USDT-ETH'}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${statusColor}`}
                              >
                                {statusText}
                              </span>
                            </div>

                            <div className="flex justify-between items-baseline pt-1">
                              <span className="text-xs text-slate-500 font-medium">Amount:</span>
                              <span className="font-mono font-extrabold text-emerald-600 text-base">
                                +${log.amount} USDT
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-2 border-t border-slate-50">
                              <span>{new Date(log.timestamp).toLocaleString()}</span>
                              {log.txHash && (
                                <span className="truncate max-w-[140px] text-[10px] text-slate-500">
                                  Tx: {log.txHash.slice(0, 10)}...
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Deposit Currency Selector Row */}
                <div className="flex items-center justify-between relative">
                  <span className="font-bold text-slate-800 text-sm">Deposit Currency</span>
                  <button
                    type="button"
                    onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                    className="flex items-center gap-2 font-bold text-slate-900 text-sm bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    <img
                      src={depositNetworks.find((n) => n.id === selectedDepositNetwork)?.logo}
                      alt={selectedDepositNetwork}
                      className="w-4 h-4 object-contain"
                    />
                    <span>{selectedDepositNetwork}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 ml-0.5" />
                  </button>

                  {/* Network Selection Modal Dropdown */}
                  {showNetworkDropdown && (
                    <div className="absolute right-0 top-11 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden py-1">
                      {depositNetworks.map((net) => (
                        <button
                          key={net.id}
                          type="button"
                          onClick={() => {
                            setSelectedDepositNetwork(net.id);
                            setShowNetworkDropdown(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition ${
                            selectedDepositNetwork === net.id ? 'text-[#0052d4] bg-blue-50/50' : 'text-slate-700'
                          }`}
                        >
                          <img src={net.logo} alt={net.name} className="w-4 h-4 object-contain" />
                          {net.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center my-1">
                  <div className="p-3.5 border-2 border-[#0052d4] rounded-2xl bg-white shadow-xs">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${recipientAddress}`}
                      alt="Deposit QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-medium mt-2.5">Scan to Transfer and Deposit</span>
                </div>

                {/* Wallet Address Box */}
                <div className="bg-[#f7f9fc] rounded-xl p-3.5 border border-slate-100 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-800 break-all leading-snug">
                    {recipientAddress}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="p-1.5 text-[#0052d4] hover:bg-blue-50 rounded-lg transition shrink-0 cursor-pointer"
                    title="Copy Address"
                  >
                    {copiedAddress ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>

                {/* Deposit Amount Input */}
                <div>
                  <label className="block font-bold text-slate-800 text-sm mb-1.5">Deposit Amount</label>
                  <input
                    type="number"
                    step="any"
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value)}
                    placeholder={`Please enter (Min: $${minDepositUSDT} USDT)`}
                    className="w-full p-3.5 bg-[#f7f9fc] border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0052d4] focus:bg-white transition"
                    required
                  />
                  <div className="text-[11px] text-slate-500 font-medium mt-1">
                    Minimum deposit amount: <span className="font-bold text-slate-800">${minDepositUSDT} USDT</span>
                  </div>
                </div>

                {/* Upload Payment Details Screenshot */}
                <div>
                  <label className="block font-bold text-slate-800 text-sm mb-2">
                    Upload Payment Details Screenshot
                  </label>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="screenshot-input"
                      className="w-20 h-20 bg-[#f7f9fc] rounded-xl border border-dashed border-slate-300 hover:border-[#0052d4] flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition group"
                    >
                      {uploadPreview ? (
                        <img src={uploadPreview} alt="Receipt Screenshot" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-7 h-7 text-slate-300 group-hover:text-[#0052d4] transition" />
                      )}
                      <input
                        id="screenshot-input"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {uploadPreview && (
                      <button
                        type="button"
                        onClick={() => setUploadPreview(null)}
                        className="text-xs text-red-500 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {errorMsg && <p className="text-xs text-red-500 font-bold">{errorMsg}</p>}
                {successMsg && <p className="text-xs text-emerald-600 font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100">{successMsg}</p>}

                {/* Confirm Button */}
                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={loading}
                  className="w-full py-3.5 bg-[#0052d4] hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-500/15 cursor-pointer disabled:bg-blue-300 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting Deposit...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>

                {/* Official Deposit Channels Section */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="text-xs font-bold text-slate-700 px-1 mb-1">Official Deposit Channels</div>
                  {officialChannels.map((channel, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition cursor-pointer shadow-3xs"
                      onClick={() => {
                        window.open(channel.url, '_blank');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-md ${channel.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {channel.logo}
                        </div>
                        <span className="text-xs font-semibold text-slate-800">{channel.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dedicated Full Withdraw Page View (Matches Screenshot 1) */}
      <AnimatePresence>
        {activeModal === 'withdraw' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-white z-50 overflow-y-auto max-w-md mx-auto flex flex-col font-sans pb-10"
          >
            {/* Header Bar */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-slate-800" />
              </button>
              <h3 className="font-bold text-slate-900 text-base">Withdraw</h3>
              <button
                type="button"
                onClick={() => setShowWithdrawHistory(!showWithdrawHistory)}
                className="p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                title="Withdraw History"
              >
                <History className="w-5 h-5 text-slate-700" />
              </button>
            </div>

            {showWithdrawHistory ? (
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#0052d4]" />
                    <h4 className="font-bold text-slate-800 text-sm">Withdrawal History</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWithdrawHistory(false)}
                    className="text-xs text-[#0052d4] font-bold cursor-pointer hover:underline"
                  >
                    &larr; Back to Withdraw
                  </button>
                </div>

                {historyLogs.filter((l) => l.type === 'withdraw').length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <History className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold">No withdrawal history records found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyLogs
                      .filter((l) => l.type === 'withdraw')
                      .map((log, idx) => {
                        const statusColor =
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.status === 'failed'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200';

                        const statusText =
                          log.status === 'success'
                            ? 'Approved'
                            : log.status === 'failed'
                            ? 'Rejected'
                            : 'Pending';

                        return (
                          <div
                            key={log.id || idx}
                            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-2 hover:border-slate-200 transition"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-900 text-sm">
                                Withdrawal {log.currency || 'USDT'}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${statusColor}`}
                              >
                                {statusText}
                              </span>
                            </div>

                            <div className="flex justify-between items-baseline pt-1">
                              <span className="text-xs text-slate-500 font-medium">Amount:</span>
                              <span className="font-mono font-extrabold text-slate-900 text-base">
                                -${log.amount} {log.currency || 'USDT'}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-2 border-t border-slate-50">
                              <span>{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleWithdraw} className="p-5 space-y-5">
                {/* Withdrawal Currency Selector Row */}
                <div className="flex items-center justify-between relative">
                  <span className="font-bold text-slate-800 text-sm">Withdrawal currency</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowWithdrawCurrencyDropdown(!showWithdrawCurrencyDropdown)}
                      className="flex items-center gap-2 font-bold text-slate-900 text-sm bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 transition cursor-pointer"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={
                            withdrawCurrency.startsWith('USDT')
                              ? 'https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040'
                              : 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=040'
                          }
                          alt={withdrawCurrency}
                          className="w-5 h-5 object-contain"
                        />
                      </div>
                      <span>{withdrawCurrency}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400 ml-0.5" />
                    </button>

                    {/* Dropdown menu */}
                    {showWithdrawCurrencyDropdown && (
                      <div className="absolute right-0 top-11 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden py-1">
                        {['USDT-ETH', 'USDC-ETH'].map((cur) => (
                          <button
                            key={cur}
                            type="button"
                            onClick={() => {
                              setWithdrawCurrency(cur);
                              setSelectedCurrency(cur.startsWith('USDT') ? 'USDT' : 'USDC');
                              setShowWithdrawCurrencyDropdown(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-slate-50 transition ${
                              withdrawCurrency === cur ? 'text-[#0066ff] bg-blue-50/50' : 'text-slate-700'
                            }`}
                          >
                            <img
                              src={
                                cur.startsWith('USDT')
                                  ? 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Tether_USDT.svg'
                                  : 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=040'
                              }
                              alt={cur}
                              className="w-4.5 h-4.5 object-contain shrink-0"
                            />
                            <span>{cur}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <input
                    type="number"
                    step="any"
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value)}
                    placeholder="Please enter the withdrawal amount"
                    className="w-full p-4 bg-[#f2f4f8] border-none rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066ff] transition"
                  />
                </div>

                {/* Max Withdrawable Box - Matches Screenshot 1 */}
                <div className="bg-[#f2f4f8] rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    Max withdrawable: {getAvailableBalanceFor(selectedCurrency)} {selectedCurrency === 'USDT' ? 'USDT' : selectedCurrency === 'BTC' ? 'BTC' : 'USDC'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActionAmount(getAvailableBalanceFor(selectedCurrency).toString())}
                    className="text-[#0066ff] font-bold text-xs hover:underline cursor-pointer"
                  >
                    Max
                  </button>
                </div>

                {/* Hint Notice for Minimum Withdrawal */}
                <div className="text-xs text-slate-400 font-medium px-1 flex items-center justify-between">
                  <span>Minimum withdrawal amount:</span>
                  <span className="font-bold text-slate-700">{minWithdrawUSDT} {selectedCurrency}</span>
                </div>

                {/* Withdrawal Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Withdrawal Address</label>
                  <input
                    type="text"
                    value={withdrawAddressInput}
                    onChange={(e) => setWithdrawAddressInput(e.target.value)}
                    placeholder="Enter or paste address"
                    className="w-full p-4 bg-[#f2f4f8] border-none rounded-2xl font-mono text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066ff] transition"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 font-bold leading-relaxed">{errorMsg}</p>
                  </div>
                )}
                {successMsg && <p className="text-xs text-emerald-600 font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100">{successMsg}</p>}

                {/* Confirm Button - Matches Screenshot 1 */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#0066ff] hover:bg-blue-600 text-white font-bold text-base rounded-2xl transition shadow-md shadow-blue-500/20 cursor-pointer disabled:bg-blue-300 flex items-center justify-center gap-2"
                >
                  {loading ? 'Processing...' : 'Confirm'}
                </button>

                {/* Fee notice - Matches Screenshot 1 */}
                <div className="pt-2 text-left space-y-1">
                  <div className="font-bold text-slate-900 text-sm">Fee:0%</div>
                  <div className="text-xs text-slate-500 font-medium">Fees apply. Usually arrives within 24 hours.</div>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popups & Dialog Modals for Exchange */}
      <AnimatePresence>
        {activeModal === 'exchange' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 font-sans"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
                <h4 className="font-bold text-slate-800 text-sm capitalize flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-[#0052d4]" />
                  Exchange Assets
                </h4>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Exchange Form */}
              {activeModal === 'exchange' && (
                <form onSubmit={handleExchange} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-[11px] text-blue-800 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      Swap between asset types instantly. Available rate: **{getExchangeRateText()}**.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</label>
                      <select
                        value={exchangeFrom}
                        onChange={(e) => setExchangeFrom(e.target.value)}
                        className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0052d4]"
                      >
                        <option value="USDT">USDT</option>
                        <option value="USDC">USDC</option>
                        <option value="ETH">ETH</option>
                      </select>
                      <span className="text-[9px] text-slate-400 mt-1 block">
                        Bal: {getAvailableBalanceFor(exchangeFrom).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</label>
                      <select
                        value={exchangeTo}
                        onChange={(e) => setExchangeTo(e.target.value)}
                        className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0052d4]"
                      >
                        <option value="USDT">USDT</option>
                        <option value="USDC">USDC</option>
                        <option value="ETH">ETH</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</label>
                    <div className="relative mt-1.5">
                      <input
                        type="number"
                        step="any"
                        value={actionAmount}
                        onChange={(e) => setActionAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0052d4]"
                        required
                      />
                      <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">{exchangeFrom}</span>
                    </div>
                  </div>

                  {parseFloat(actionAmount) > 0 && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Estimated received:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {getEstimatedReceived()} {exchangeTo}
                      </span>
                    </div>
                  )}

                  {errorMsg && <p className="text-[11px] text-red-500 font-medium">{errorMsg}</p>}
                  {successMsg && <p className="text-[11px] text-emerald-600 font-bold">{successMsg}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#0052d4] hover:bg-blue-700 text-white font-bold rounded-2xl transition disabled:bg-blue-300 text-xs shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    {loading ? 'Converting...' : 'Confirm Instant Swap'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
