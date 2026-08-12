import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SlidersHorizontal, Info, AlertTriangle } from 'lucide-react';

interface TransferRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amountEth: number, recipientAddr: string) => Promise<void>;
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
  const [amountEth, setAmountEth] = useState<string>('0.5');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const ethPriceUSD = 4692.70;
  const numericAmount = parseFloat(amountEth) || 0;
  const dollarValue = (numericAmount * ethPriceUSD).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedConnected = connectedAddress
    ? `${connectedAddress.substring(0, 6)}...${connectedAddress.substring(connectedAddress.length - 4)}`
    : 'Account 1';

  const formattedRecipient = recipientAddress
    ? `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}`
    : '0xA756B...8976F';

  const handleConfirmClick = async () => {
    setError(null);
    if (numericAmount <= 0) {
      setError('Please enter a valid ETH amount');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(numericAmount, recipientAddress);
      onClose();
    } catch (err: any) {
      console.error('Transfer confirmation failed:', err);
      setError(err.message || 'Transaction rejected or failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#121316] w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-neutral-800 text-white relative overflow-hidden"
        >
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-5">
            <div className="w-5" /> {/* Spacer */}
            <h2 className="font-semibold text-base text-white tracking-tight">Transfer request</h2>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition p-1 cursor-pointer"
              title="Settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* ETH Logo & Amount Header */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-full bg-[#3b82f6] flex items-center justify-center mb-3 shadow-lg shadow-blue-500/20">
              <svg className="w-6 h-8 text-white" viewBox="0 0 784 1277" fill="currentColor">
                <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" />
                <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" opacity="0.8" />
                <path d="M392.07 956.52L387.24 962.41V1271.67L392.07 1276.08L784.37 724.89L392.07 956.52Z" />
                <path d="M392.07 1276.08V956.52L0 724.89L392.07 1276.08Z" opacity="0.8" />
              </svg>
            </div>

            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                value={amountEth}
                onChange={(e) => setAmountEth(e.target.value)}
                step="0.01"
                min="0.001"
                className="text-3xl font-bold bg-transparent text-center text-white focus:outline-none w-36 border-b border-transparent focus:border-neutral-700 font-mono"
              />
              <span className="text-3xl font-bold text-white">ETH</span>
            </div>
            <div className="text-xs text-neutral-400 mt-0.5 font-medium">
              ${dollarValue}
            </div>
          </div>

          {/* From -> To Section Box */}
          <div className="bg-[#1c1d22] rounded-2xl p-3.5 mb-3 border border-neutral-800/80 flex items-center justify-between text-xs">
            <div className="flex flex-col gap-1">
              <span className="text-neutral-400 font-medium">From</span>
              <div className="flex items-center gap-1.5 bg-[#27282d] px-2.5 py-1 rounded-full text-white text-[11px] font-medium border border-neutral-700/50">
                <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-400 via-emerald-400 to-indigo-500" />
                <span>{formattedConnected}</span>
              </div>
            </div>

            <div className="text-neutral-500 px-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <span className="text-neutral-400 font-medium">To</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 border border-amber-500/30">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Alert &gt;
                </span>
              </div>
              <div className="flex items-center gap-1 text-neutral-200 font-mono text-[11px] font-semibold">
                <span className="w-3.5 h-3.5 rounded-full bg-neutral-700 flex items-center justify-center text-[9px]">?</span>
                <span>{formattedRecipient}</span>
              </div>
            </div>
          </div>

          {/* Estimated Changes Box */}
          <div className="bg-[#1c1d22] rounded-2xl p-3.5 mb-3 border border-neutral-800/80 text-xs">
            <div className="flex items-center gap-1 text-neutral-400 font-medium mb-2">
              <span>Estimated changes</span>
              <Info className="w-3 h-3 text-neutral-500" />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-300">You send</span>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <span className="bg-red-500/20 text-red-400 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded">
                    - {amountEth}
                  </span>
                  <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                    <span className="text-[9px] font-bold">Ξ</span>
                  </div>
                  <span className="font-bold text-white">ETH</span>
                </div>
                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                  ${dollarValue}
                </div>
              </div>
            </div>
          </div>

          {/* Network & Domain Info Box */}
          <div className="bg-[#1c1d22] rounded-2xl p-3.5 mb-5 border border-neutral-800/80 text-xs space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-medium">Network</span>
              <div className="flex items-center gap-1.5 text-white font-medium">
                <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 flex items-center justify-center text-[8px] font-bold">Ξ</div>
                <span>Ethereum Mainnet</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-neutral-800/60">
              <div className="flex items-center gap-1 text-neutral-400 font-medium">
                <span>Request from</span>
                <Info className="w-3 h-3 text-neutral-500" />
              </div>
              <span className="text-neutral-300 font-mono text-[11px]">
                {typeof window !== 'undefined' ? window.location.host || 'cdpn.io' : 'cdpn.io'}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="py-3 bg-[#27282d] hover:bg-[#323339] text-white font-semibold rounded-2xl transition cursor-pointer text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmClick}
              disabled={isSubmitting}
              className="py-3 bg-white hover:bg-neutral-200 text-black font-bold rounded-2xl transition cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
