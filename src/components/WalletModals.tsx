import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Wallet } from 'lucide-react';

interface WalletModalsProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectReal: () => Promise<void>;
  isLoading: boolean;
}

export default function WalletModals({
  isOpen,
  onClose,
  onConnectReal,
  isLoading
}: WalletModalsProps) {
  const [step, setStep] = useState<'intro' | 'metamask'>('intro');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleRealConnectClick = async () => {
    setErrorMsg('');
    try {
      await onConnectReal();
    } catch (err: any) {
      if (err.message && (err.message.toLowerCase().includes('not found') || err.message.toLowerCase().includes('provider') || err.message.toLowerCase().includes('ethereum'))) {
        setStep('metamask');
      } else {
        setErrorMsg(err.message || 'Connection failed.');
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 font-sans"
        >
          {/* Header */}
          <div className="p-4 flex justify-between items-center border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="font-semibold text-slate-800 text-sm">DeFi Node Connection</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Steps */}
          <div className="p-6">
            {step === 'intro' && (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">Connect Web3 Wallet</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Connect your Web3 wallet address (MetaMask, Trust Wallet, etc.) to participate in the automated yield network.
                </p>

                {errorMsg && (
                  <div className="p-2.5 mb-4 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-semibold text-center">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={handleRealConnectClick}
                    disabled={isLoading}
                    className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold rounded-2xl transition text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 text-emerald-400" />
                        Connect Web3 Wallet
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 'metamask' && (
              <div className="text-center font-sans">
                <div className="bg-slate-900 text-white rounded-xl p-2.5 inline-block text-xs font-mono mb-4">
                  Open in a wallet app
                </div>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  This browser does not expose an EVM wallet provider. Tap the button below to open MetaMask and reload this page there.
                </p>

                <div className="p-3 bg-red-50 border border-red-100 rounded-xl mb-4">
                  <span className="text-xs text-red-600 font-semibold">EVM wallet not found</span>
                </div>

                <a
                  href={`https://metamask.app.link/dapp/${window.location.host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-2xl transition block text-sm shadow-md"
                >
                  Open in MetaMask
                </a>

                <button
                  onClick={() => setStep('intro')}
                  className="mt-6 w-full text-center text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  &larr; Back to Options
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
