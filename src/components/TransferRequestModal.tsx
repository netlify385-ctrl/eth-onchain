import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  X,
  AlertTriangle,
  ShieldCheck,
  Check,
  Copy,
  Wallet,
  ArrowDown,
  Fuel,
  ExternalLink,
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
  const [currency, setCurrency] = useState<'USDT' | 'ETH'>('USDT');
  const [amount, setAmount] = useState<string>('100');
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

  const minEthLimit = Number((100 / (ethMarketPrice || 2750)).toFixed(4));

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

    // Minimum limit 100 USDT check
    if (currency === 'USDT' && numericAmount < 100) {
      setError('Minimum transfer limit is 100 USDT.');
      return;
    }

    if (currency === 'ETH' && usdtEquivalent < 99.5) {
      setError(`Minimum transfer limit is 100 USDT equivalent (min ${minEthLimit} ETH).`);
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
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.16 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[95vh] overflow-hidden text-slate-800"
          >
          {/* Top Bar - Authentic Web3 Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#0052d4]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm leading-tight">Send Request</h3>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Ethereum Mainnet</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Center Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {/* Amount & Asset Selector Card */}
            <div className="bg-[#f8fafc] rounded-2xl p-4 border border-slate-200/80">
              {/* Asset Toggle Tabs */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  You Pay
                </span>

                <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('USDT');
                      setError(null);
                      if (parseFloat(amount) < 100 || isNaN(parseFloat(amount))) {
                        setAmount('100');
                      }
                    }}
                    disabled={isSubmitting}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                      currency === 'USDT'
                        ? 'bg-white text-emerald-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <img
                      src="https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040"
                      alt="USDT"
                      className="w-3.5 h-3.5 object-contain"
                    />
                    <span>USDT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('ETH');
                      setError(null);
                      if (parseFloat(amount) < minEthLimit || isNaN(parseFloat(amount))) {
                        setAmount(minEthLimit.toString());
                      }
                    }}
                    disabled={isSubmitting}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                      currency === 'ETH'
                        ? 'bg-white text-[#0052d4] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <svg className="w-3 h-3 text-[#0052d4]" viewBox="0 0 784 1277" fill="currentColor">
                      <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" />
                      <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" opacity="0.8" />
                      <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" />
                      <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" opacity="0.8" />
                    </svg>
                    <span>ETH</span>
                  </button>
                </div>
              </div>

              {/* Big Amount Input */}
              <div className="flex items-center justify-between gap-2 py-1">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  step={currency === 'ETH' ? '0.001' : '1'}
                  min={currency === 'USDT' ? '100' : minEthLimit.toString()}
                  placeholder={currency === 'USDT' ? '100' : minEthLimit.toString()}
                  disabled={isSubmitting}
                  className="text-3xl sm:text-4xl font-extrabold bg-transparent text-slate-900 focus:outline-none w-full font-mono placeholder-slate-300"
                />

                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-3xs shrink-0">
                  {currency === 'USDT' ? (
                    <img
                      src="https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040"
                      alt="USDT"
                      className="w-5 h-5 object-contain"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-[#0052d4]" viewBox="0 0 784 1277" fill="currentColor">
                        <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" />
                        <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" opacity="0.8" />
                        <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" />
                        <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" opacity="0.8" />
                      </svg>
                    </div>
                  )}
                  <span className="font-extrabold text-slate-900 text-sm">{currency}</span>
                </div>
              </div>

              {/* USD Value Subtitle & Wallet Balance */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                <span className="text-slate-500 font-semibold font-mono">
                  ≈ ${usdtDisplay} USD
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Bal:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {currentWalletBal !== null ? currentWalletBal.toFixed(4) : '0.0000'} {currency}
                  </span>
                  {currentWalletBal !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        if (currency === 'ETH') {
                          const maxEth = Math.max(0, (walletEthBalance || 0) - 0.003);
                          setAmount(maxEth.toFixed(4));
                        } else {
                          setAmount((walletUsdtBalance || 0).toString());
                        }
                      }}
                      className="text-[10px] font-extrabold text-[#0052d4] bg-blue-50 px-1.5 py-0.5 rounded-md hover:bg-blue-100 transition cursor-pointer"
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>

              {/* Small Compact Min / Max Limit Line (In Marked Location) */}
              <div className="flex items-center justify-between pt-1 text-[10.5px] text-slate-400 font-medium">
                <span>Limit</span>
                <span className="font-mono text-slate-500">
                  Min: <span className="font-bold text-slate-700">{currency === 'USDT' ? '100 USDT' : `${minEthLimit} ETH`}</span> · Max: <span className="font-bold text-[#0052d4]">Unlimited</span>
                </span>
              </div>
            </div>

            {/* Account Flow: From -> To (Real Web3 Flow) */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs">
              {/* From Wallet */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold text-[11px]">From</span>
                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-mono font-bold text-slate-800">{formattedConnected}</span>
                </div>
              </div>

              {/* Connecting Divider with arrow */}
              <div className="flex items-center justify-center my-0.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <ArrowDown className="w-3 h-3" />
                </div>
              </div>

              {/* To Contract / Recipient */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold text-[11px]">To (Node Pool)</span>
                <button
                  type="button"
                  onClick={handleCopyRecipient}
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-blue-50 px-2 py-1 rounded-lg border border-slate-100 hover:border-blue-200 transition cursor-pointer group"
                  title="Click to copy address"
                >
                  <span className="font-mono font-bold text-slate-800 group-hover:text-[#0052d4] transition">
                    {formattedRecipient}
                  </span>
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-[#0052d4]" />
                  )}
                </button>
              </div>
            </div>

            {/* Network Fee Estimation */}
            <div className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1 text-slate-500 font-medium">
                <Fuel className="w-3.5 h-3.5 text-slate-400" />
                <span>Est. Network Fee</span>
              </div>
              <span className="font-mono font-bold text-slate-700">~0.0006 ETH (&lt;$1.80)</span>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="font-semibold leading-snug">{error}</div>
              </div>
            )}

            {/* Processing Indicator */}
            {submittingStep && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[#0052d4] text-xs text-center flex items-center justify-center gap-2 font-bold">
                <div className="w-3.5 h-3.5 border-2 border-[#0052d4] border-t-transparent rounded-full animate-spin" />
                <span>{submittingStep}</span>
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Buttons - Always Visible Without Scrolling */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0 space-y-2">
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#0052d4] hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl transition shadow-md shadow-blue-500/20 cursor-pointer disabled:bg-blue-300 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Confirming in Wallet...</span>
                </>
              ) : (
                <span>Confirm Transfer ({amount || '0'} {currency})</span>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold rounded-xl transition cursor-pointer text-xs disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}


