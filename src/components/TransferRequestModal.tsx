import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Info,
  AlertTriangle,
  ShieldCheck,
  Check,
  Copy,
  Wallet,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ethers } from 'ethers';

interface TransferRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number, recipientAddr: string, currency: string, usdtEquivalent: number) => Promise<void>;
  connectedAddress: string | null;
  recipientAddress: string;
}

export default function TransferRequestModal({
  isOpen,
  onClose,
  onConfirm,
  connectedAddress,
  recipientAddress,
}: TransferRequestModalProps) {
  const [currency, setCurrency] = useState<'ETH' | 'USDT'>('ETH');
  const [amount, setAmount] = useState<string>('0.01');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittingStep, setSubmittingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [walletEthBalance, setWalletEthBalance] = useState<number | null>(null);
  const [walletUsdtBalance, setWalletUsdtBalance] = useState<number | null>(null);
  const [ethMarketPrice, setEthMarketPrice] = useState<number>(2750);

  // Fetch live ETH price from public market APIs
  useEffect(() => {
    let isMounted = true;
    const fetchEthPrice = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
        const data = await res.json();
        if (data && data.price && isMounted) {
          const p = parseFloat(data.price);
          if (p > 500 && p < 20000) {
            setEthMarketPrice(p);
            return;
          }
        }
      } catch {}

      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await res.json();
        if (data?.ethereum?.usd && isMounted) {
          const p = parseFloat(data.ethereum.usd);
          if (p > 500 && p < 20000) {
            setEthMarketPrice(p);
          }
        }
      } catch {}
    };

    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch real onchain wallet balance safely using direct RPC
  useEffect(() => {
    if (!isOpen || !connectedAddress) return;

    let isMounted = true;
    const fetchBalances = async () => {
      try {
        const ethereum = (window as any).ethereum;
        if (!ethereum) return;

        // Native ETH Balance via standard eth_getBalance
        try {
          const ethHex = await ethereum.request({
            method: 'eth_getBalance',
            params: [connectedAddress, 'latest'],
          });
          if (ethHex && isMounted) {
            const ethBal = parseFloat(ethers.formatEther(ethHex));
            setWalletEthBalance(ethBal);
          }
        } catch (e) {
          console.warn('eth_getBalance warning:', e);
        }

        // USDT balance on Ethereum Mainnet via standard eth_call
        try {
          const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
          const cleanAddr = connectedAddress.startsWith('0x') ? connectedAddress.substring(2) : connectedAddress;
          const callData = '0x70a08231' + cleanAddr.toLowerCase().padStart(64, '0');
          const usdtHex = await ethereum.request({
            method: 'eth_call',
            params: [{ to: usdtAddress, data: callData }, 'latest'],
          });
          if (usdtHex && usdtHex !== '0x' && isMounted) {
            const usdtBal = parseFloat(ethers.formatUnits(usdtHex, 6));
            setWalletUsdtBalance(usdtBal);
          }
        } catch (e) {
          console.warn('usdt eth_call warning:', e);
        }
      } catch (e) {
        console.warn('Balance check warning:', e);
      }
    };

    fetchBalances();
    return () => {
      isMounted = false;
    };
  }, [isOpen, connectedAddress]);

  if (!isOpen) return null;

  const numericAmount = parseFloat(amount) || 0;
  const usdtEquivalent = currency === 'ETH' ? numericAmount * ethMarketPrice : numericAmount;
  const usdtDisplay = usdtEquivalent.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedConnected = connectedAddress
    ? `${connectedAddress.substring(0, 6)}...${connectedAddress.substring(connectedAddress.length - 4)}`
    : '0x1d6a...00c';

  const formattedRecipient = recipientAddress
    ? `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}`
    : '0x71C7...476B';

  const handleCopyRecipient = () => {
    if (navigator.clipboard && recipientAddress) {
      navigator.clipboard.writeText(recipientAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentWalletBal = currency === 'ETH' ? walletEthBalance : walletUsdtBalance;

  const handleConfirmClick = async () => {
    setError(null);
    if (numericAmount <= 0) {
      setError(`Please enter a valid ${currency} amount`);
      return;
    }

    if (currentWalletBal !== null && numericAmount > currentWalletBal) {
      setError('Insufficient balance in your wallet to complete this transfer.');
      return;
    }

    setIsSubmitting(true);
    setSubmittingStep('Waiting for wallet signature...');
    try {
      await onConfirm(numericAmount, recipientAddress, currency, usdtEquivalent);
      onClose();
    } catch (err: any) {
      console.error('Transfer confirmation error:', err);
      let errMsg = (err?.message || '').toLowerCase();
      let errCode = err?.code;

      if (
        errCode === 4001 ||
        errCode === 'ACTION_REJECTED' ||
        errMsg.includes('user rejected') ||
        errMsg.includes('denied') ||
        errMsg.includes('cancelled')
      ) {
        setError('Transaction was cancelled in your wallet.');
      } else if (
        errMsg.includes('insufficient') ||
        errMsg.includes('exceeds balance') ||
        errMsg.includes('funds') ||
        errMsg.includes('gas required exceeds allowance') ||
        errMsg.includes('low balance')
      ) {
        setError('Insufficient balance in your wallet to cover transfer and gas fees.');
      } else {
        setError('Insufficient balance or wallet transfer cancelled. Please check your wallet and try again.');
      }
    } finally {
      setIsSubmitting(false);
      setSubmittingStep('');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col font-sans text-slate-800"
      >
        {/* Top Header Navigation */}
        <header className="bg-white border-b border-slate-200/80 px-4 py-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer font-bold text-sm disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
            <span>Back</span>
          </button>

          <div className="text-center">
            <h2 className="text-base font-extrabold text-slate-900">Transfer Request</h2>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[11px] text-slate-500 font-semibold">Direct Node Participation</p>
            </div>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Secure</span>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-md mx-auto w-full space-y-4 pb-12">
            {/* Main Transfer Amount Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-4">
              {/* Currency Selector Pill */}
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                  Select Currency
                </label>
                <div className="grid grid-cols-2 gap-2.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('ETH');
                      setError(null);
                    }}
                    disabled={isSubmitting}
                    className={`py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 ${
                      currency === 'ETH'
                        ? 'bg-white text-[#0052d4] shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-[#0052d4]" viewBox="0 0 784 1277" fill="currentColor">
                        <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" />
                        <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" opacity="0.8" />
                        <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" />
                        <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" opacity="0.8" />
                      </svg>
                    </div>
                    <span>ETH (Ethereum)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('USDT');
                      setError(null);
                    }}
                    disabled={isSubmitting}
                    className={`py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 ${
                      currency === 'USDT'
                        ? 'bg-white text-emerald-600 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <img
                      src="https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040"
                      alt="USDT"
                      className="w-4 h-4 object-contain"
                    />
                    <span>USDT (ERC-20)</span>
                  </button>
                </div>
              </div>

              {/* Amount Input Box */}
              <div className="bg-[#f8fafc] rounded-2xl p-4 border border-slate-200 text-center space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Transfer Amount
                  </span>
                  {currentWalletBal !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        if (currency === 'ETH') {
                          // Reserve a small gas buffer for ETH
                          const maxEth = Math.max(0, (walletEthBalance || 0) - 0.003);
                          setAmount(maxEth.toFixed(4));
                        } else {
                          setAmount((walletUsdtBalance || 0).toString());
                        }
                      }}
                      className="text-[10px] font-extrabold text-[#0052d4] hover:underline cursor-pointer"
                    >
                      Use Max
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 pt-1 pb-1">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    step={currency === 'ETH' ? '0.001' : '1'}
                    min="0.0001"
                    placeholder="0.00"
                    disabled={isSubmitting}
                    className="text-3xl sm:text-4xl font-extrabold bg-transparent text-center text-slate-900 focus:outline-none w-full max-w-[200px] border-b-2 border-slate-300 focus:border-[#0052d4] font-mono py-1 transition"
                  />
                  <span className="text-xl font-bold text-slate-700 shrink-0">{currency}</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-200">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-mono font-bold text-emerald-700">
                    ≈ ${usdtDisplay} USDT
                  </span>
                </div>

                {/* Live Wallet Balance */}
                {currentWalletBal !== null && (
                  <div className="text-[11px] text-slate-500 font-semibold pt-1 flex items-center justify-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-slate-400" />
                    <span>Available Balance:</span>
                    <span className="font-mono font-extrabold text-slate-800">
                      {currentWalletBal.toFixed(4)} {currency}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Amount Suggestion Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(currency === 'ETH' ? ['0.01', '0.05', '0.1', '0.5', '1.0'] : ['50', '100', '500', '1000', '5000']).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setAmount(val);
                      setError(null);
                    }}
                    className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-[#0052d4] border border-slate-200/80 text-[11px] font-bold text-slate-700 transition cursor-pointer shrink-0"
                  >
                    {val} {currency}
                  </button>
                ))}
              </div>
            </div>

            {/* Routing: From -> To Card */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                Routing Summary
              </div>

              <div className="bg-[#f8fafc] rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                {/* From Wallet */}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    From (Your Wallet)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-mono font-bold text-slate-800 truncate">{formattedConnected}</span>
                  </div>
                </div>

                <div className="text-slate-400 px-2 shrink-0">
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>

                {/* To Recipient */}
                <div className="flex-1 min-w-0 text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    To (Node Address)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRecipient}
                    className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 hover:text-[#0052d4] transition cursor-pointer"
                    title="Click to copy address"
                  >
                    <span className="truncate">{formattedRecipient}</span>
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-[#0052d4] shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Details Breakdown Card */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Network</span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  Ethereum Mainnet (ERC-20)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Transfer Type</span>
                <span className="font-bold text-slate-800">Direct Node Transfer</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Amount</span>
                <span className="font-mono font-extrabold text-[#0052d4] text-sm">
                  {amount || '0'} {currency}
                </span>
              </div>
            </div>

            {/* Error Message Display */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs text-left flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="font-semibold leading-relaxed">{error}</div>
              </div>
            )}

            {/* Submitting Status */}
            {submittingStep && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[#0052d4] text-xs text-center flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#0052d4] border-t-transparent rounded-full animate-spin" />
                <span className="font-bold">{submittingStep}</span>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={isSubmitting}
                className="w-full py-4 bg-[#0052d4] hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl transition shadow-lg shadow-blue-500/25 cursor-pointer disabled:bg-blue-300 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Confirming in Wallet...</span>
                  </>
                ) : (
                  <span>Transfer Now</span>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition cursor-pointer text-xs disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </main>
      </motion.div>
    </AnimatePresence>
  );
}

