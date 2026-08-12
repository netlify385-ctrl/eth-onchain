import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, ShieldCheck, ArrowRight, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';

interface ConnectGateProps {
  onConnectReal: () => Promise<void>;
  isLoading: boolean;
  onOpenAdmin: () => void;
}

export default function ConnectGate({
  onConnectReal,
  isLoading,
  onOpenAdmin
}: ConnectGateProps) {
  const [errorMsg, setErrorMsg] = useState('');

  const handleRealConnect = async () => {
    setErrorMsg('');
    try {
      await onConnectReal();
    } catch (err: any) {
      setErrorMsg(err.message || 'MetaMask or Web3 Wallet not found in your browser. Please open this app inside MetaMask or Trust Wallet app.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between items-center p-5 sm:p-8 relative font-sans">
      {/* Background Soft Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 pointer-events-none" />

      {/* Top Bar */}
      <div className="w-full max-w-md flex justify-center items-center z-10 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
            <svg className="w-4 h-5" viewBox="0 0 784 1277" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M392.07 0L383.5 29.11V873.74L392.07 882.29L784.13 650.54L392.07 0Z" fill="#FFFFFF"/>
              <path d="M392.07 0L0 650.54L392.07 882.29V472.35V0Z" fill="#E2E8F0"/>
            </svg>
          </div>
          <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">Onchain ETH</span>
        </div>
      </div>

      {/* Simple Clean Connect Card */}
      <div className="w-full max-w-md my-auto py-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-slate-800/90 border border-slate-700/70 rounded-3xl p-7 sm:p-9 shadow-xl text-center"
        >
          {/* Simple Clean Icon */}
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Wallet className="w-8 h-8" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-7 px-2">
            Connect your Web3 wallet to access node statistics, live balances, and platform rewards.
          </p>

          {/* Error Message */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs text-left flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold leading-tight">{errorMsg}</p>
                <a
                  href={`https://metamask.app.link/dapp/${window.location.host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 font-bold hover:underline pt-0.5"
                >
                  <span>Open in MetaMask App</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={handleRealConnect}
            disabled={isLoading}
            className="w-full py-4 px-5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 text-sm"
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin text-white" />
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                <span>Connect Web3 Wallet</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>

          {/* Security Badge */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted Web3 Connection &bull; Read-Only Safe</span>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-md text-center py-2 z-10">
        <p className="text-[11px] text-slate-500 font-medium">
          ETH Node Security Layer &bull; v2.4
        </p>
      </div>
    </div>
  );
}
