import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SlidersHorizontal, Info, AlertTriangle, ShieldCheck, Check, Copy, Wallet, ArrowDown } from 'lucide-react';
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
    setSubmittingStep('Waiting for wallet approval...');
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
        // Provide clear, clean error without raw JSON dumps
        setError('Insufficient balance or wallet transfer cancelled. Please check your wallet and try again.');
      }
    } finally {
      setIsSubmitting(false);
      setSubmittingStep('');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#121316] w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-neutral-800 text-white relative overflow-hidden max-h-[92vh] overflow-y-auto"
        >
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Direct Node Transfer</span>
            </div>
            <h2 className="font-semibold text-base text-white tracking-tight">Transfer Request</h2>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-neutral-400 hover:text-white transition p-1 cursor-pointer disabled:opacity-50"
              title="Close"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Currency Toggle */}
          <div className="flex justify-center mb-3">
            <div className="bg-[#1c1d22] p-1 rounded-xl flex items-center gap-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setCurrency('ETH');
                  setError(null);
                }}
                disabled={isSubmitting}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currency === 'ETH' ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                ETH
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrency('USDT');
                  setError(null);
                }}
                disabled={isSubmitting}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currency === 'USDT' ? 'bg-[#009393] text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                USDT
              </button>
            </div>
          </div>

          {/* Logo & Amount Header */}
          <div className="flex flex-col items-center mb-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-lg ${
                currency === 'ETH' ? 'bg-[#3b82f6] shadow-blue-500/20' : 'bg-[#009393] shadow-emerald-500/20'
              }`}
            >
              {currency === 'ETH' ? (
                <svg className="w-6 h-8 text-white" viewBox="0 0 784 1277" fill="currentColor">
                  <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" />
                  <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" opacity="0.8" />
                  <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" />
                  <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" opacity="0.8" />
                </svg>
              ) : (
                <span className="font-extrabold text-white text-xl">₮</span>
              )}
            </div>

            {/* Custom Amount Input Box */}
            <div className="w-full bg-[#18191e] rounded-2xl p-3.5 border border-neutral-800 text-center mb-2">
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">
                Enter {currency} Transfer Amount
              </label>
              <div className="flex items-center justify-center gap-1.5">
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
                  className="text-2xl sm:text-3xl font-extrabold bg-transparent text-center text-white focus:outline-none w-full max-w-[200px] border-b border-neutral-700/60 focus:border-blue-500 font-mono py-0.5"
                />
                <span className="text-xl font-bold text-white shrink-0">{currency}</span>
              </div>
              <div className="text-xs font-semibold text-emerald-400 mt-1.5 font-mono">
                ≈ {usdtDisplay} USDT
              </div>
            </div>

            {/* Wallet Balance Preview */}
            {currentWalletBal !== null && (
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Wallet className="w-3 h-3 text-slate-400" />
                <span>Wallet Balance:</span>
                <span className="font-mono font-bold text-white">
                  {currentWalletBal.toFixed(4)} {currency}
                </span>
              </div>
            )}
          </div>

          {/* From -> To Section Box (Clean Labels: From and To only) */}
          <div className="bg-[#1c1d22] rounded-2xl p-3.5 mb-3 border border-neutral-800/80 flex items-center justify-between text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-neutral-400 font-semibold text-[11px]">From</span>
              <div className="flex items-center gap-1.5 bg-[#27282d] px-2.5 py-1 rounded-full text-white text-[11px] font-medium border border-neutral-700/50">
                <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-amber-400 via-emerald-400 to-indigo-500" />
                <span className="font-mono">{formattedConnected}</span>
              </div>
            </div>

            <div className="text-neutral-500 px-1">
              <ArrowDown className="w-4 h-4 -rotate-90 text-neutral-400" />
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-neutral-400 font-semibold text-[11px]">To</span>
              <button
                type="button"
                onClick={handleCopyRecipient}
                className="flex items-center gap-1 text-neutral-200 font-mono text-[11px] font-semibold hover:text-white transition cursor-pointer"
                title="Click to copy recipient address"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-neutral-700 flex items-center justify-center text-[9px]">
                  {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                </span>
                <span>{formattedRecipient}</span>
              </button>
            </div>
          </div>

          {/* Estimated Changes Box */}
          <div className="bg-[#1c1d22] rounded-2xl p-3 mb-3 border border-neutral-800/80 text-xs">
            <div className="flex items-center justify-between text-neutral-400 font-medium mb-1.5">
              <div className="flex items-center gap-1">
                <span>Estimated transfer</span>
                <Info className="w-3 h-3 text-neutral-500" />
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">Ethereum Mainnet</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-300">Direct transfer to node</span>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <span className="bg-red-500/20 text-red-400 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded">
                    - {amount}
                  </span>
                  <span className="font-bold text-white">{currency}</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                  ≈ {usdtDisplay} USDT
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {submittingStep && (
            <div className="mb-3 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-xs text-center flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span>{submittingStep}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-3 bg-[#27282d] hover:bg-[#323339] text-white font-semibold rounded-2xl transition cursor-pointer text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSubmitting}
              className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition cursor-pointer text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Transferring...</span>
                </div>
              ) : (
                'Transfer Now'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
