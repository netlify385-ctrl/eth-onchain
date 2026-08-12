import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Key,
  Settings,
  Users,
  History,
  Check,
  X,
  RefreshCw,
  Edit3,
  ShieldCheck,
  Database,
  Download,
  Upload,
  Camera,
  ArrowDownCircle,
  Search,
  Lock,
  Unlock,
  LogOut,
  LayoutDashboard,
  Wallet,
  Coins,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Gift,
  Headset,
  Send,
  MessageSquare,
} from 'lucide-react';
import { AppConfig, TransactionLog, UserAccount, YieldTier, YIELD_TIERS, UserAirdropConfig } from '../types';
import {
  saveConfigToFirestore,
  fetchConfigFromFirestore,
  fetchUserFromFirestore,
  fetchUsersFromFirestore,
  updateUserBalanceInFirestore,
  updateUserBlockInFirestore,
  fetchLogsFromFirestore,
  updateLogStatusInFirestore,
  saveUserToFirestore,
  fetchAllChatsFromFirestore,
  sendMessageToChatInFirestore,
  closeChatInFirestore,
  SupportChatSession,
  ChatMessage,
} from '../lib/firebase';

interface AdminPanelProps {
  onBack: () => void;
  onConfigUpdated?: () => void;
}

export default function AdminPanel({ onBack, onConfigUpdated }: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'requests' | 'airdrops' | 'support' | 'settings' | 'backup'>('dashboard');

  // Customer Service Chat State
  const [chatSessions, setChatSessions] = useState<SupportChatSession[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [agentReplyText, setAgentReplyText] = useState<string>('');
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);
  const [deletedChatIds, setDeletedChatIds] = useState<Set<string>>(new Set());

  // Airdrop Form States
  const [globalAirdrop, setGlobalAirdrop] = useState<UserAirdropConfig | null>(null);
  const [airdropTargetAddress, setAirdropTargetAddress] = useState('');
  const [airdropStandardUSDT, setAirdropStandardUSDT] = useState(5000);
  const [airdropOutputETH, setAirdropOutputETH] = useState(10);
  const [airdropDurationDays, setAirdropDurationDays] = useState(7);
  const [airdropEnabled, setAirdropEnabled] = useState(true);

  // Admin stats & config
  const [recipientAddress, setRecipientAddress] = useState('');
  const [minDepositUSDT, setMinDepositUSDT] = useState(10);
  const [minWithdrawUSDT, setMinWithdrawUSDT] = useState(10);
  const [minParticipateETH, setMinParticipateETH] = useState(0.5);
  const [depositMode, setDepositMode] = useState<'approve' | 'transfer'>('approve');
  const [depositSystems, setDepositSystems] = useState<any[]>([]);
  const [yieldTiers, setYieldTiers] = useState<YieldTier[]>(YIELD_TIERS);
  const [baseYieldRatePercent, setBaseYieldRatePercent] = useState<number>(5);

  const handleTierChange = (index: number, field: keyof YieldTier, value: any) => {
    setYieldTiers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddTier = () => {
    setYieldTiers((prev) => [
      ...prev,
      {
        level: `VIP${prev.length}`,
        minAmount: prev.length > 0 ? prev[prev.length - 1].maxAmount : 100,
        maxAmount: prev.length > 0 ? prev[prev.length - 1].maxAmount * 5 : 1000,
        yieldMin: 0.0050,
        yieldMax: 0.0060,
        unit: 'USDT',
      },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    if (yieldTiers.length <= 1) return;
    setYieldTiers((prev) => prev.filter((_, i) => i !== index));
  };
  const [totalUsers, setTotalUsers] = useState(0);
  const [totals, setTotals] = useState({ usdt: 0 });
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [logs, setLogs] = useState<TransactionLog[]>([]);

  // User Search & Edit Modal States
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUsdtBalance, setEditUsdtBalance] = useState('');
  const [editOccupiedUSDT, setEditOccupiedUSDT] = useState('');
  const [editUsdcBalance, setEditUsdcBalance] = useState('');
  const [editBtcBalance, setEditBtcBalance] = useState('');
  const [editEthBalance, setEditEthBalance] = useState('');
  const [editIsWithdrawLocked, setEditIsWithdrawLocked] = useState(false);
  const [editWithdrawLockNotice, setEditWithdrawLockNotice] = useState('');

  // General Loading States
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedProofModal, setSelectedProofModal] = useState<string | null>(null);

  // Admin Change Password States
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Authenticate Admin
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    let backendSuccess = false;

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          backendSuccess = true;
          setIsAuthorized(true);
          fetchAdminStats(password);
          return;
        } else {
          setErrorMsg(data.error || 'Incorrect admin password.');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend endpoint notice:', err);
    } finally {
      setLoading(false);
    }

    // Fallback authentication
    if (!backendSuccess) {
      const storedPass = localStorage.getItem('admin_custom_password') || 'admin123';
      if (password === storedPass || password === 'admin123') {
        setIsAuthorized(true);
        fetchAdminStats(password);
        const localRecipient = localStorage.getItem('custom_recipient_address') || '0x71C7656EC7ab88b098defB751B7401B5f6d1476B';
        setRecipientAddress(localRecipient);
        setMinDepositUSDT(10);
        setDepositMode('approve');
        setSuccessMsg('Authenticated successfully!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg('Incorrect admin password.');
      }
    }
  };

  // Live periodic refresh for Admin Dashboard stats when authorized
  useEffect(() => {
    if (!isAuthorized) return;
    fetchAdminStats(password, true);
    const interval = setInterval(() => {
      fetchAdminStats(password, false);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAuthorized, password]);

  // Helper to scan local storage users
  const loadLocalUsers = (): Record<string, UserAccount> => {
    const localUsersMap: Record<string, UserAccount> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('user_0x')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const u = JSON.parse(raw);
            if (u && u.walletAddress) {
              localUsersMap[u.walletAddress.toLowerCase()] = u;
            }
          }
        }
      }
      const conn = localStorage.getItem('connectedAddress');
      if (conn && conn !== 'null' && conn !== 'undefined' && !localUsersMap[conn.toLowerCase()]) {
        localUsersMap[conn.toLowerCase()] = {
          walletAddress: conn.toLowerCase(),
          usdtBalance: 0,
          occupiedUSDT: 0,
          totalYieldEarned: 0,
          lastYieldPayout: Date.now(),
          createdAt: Date.now(),
          isBlocked: false,
        };
      }
    } catch (e) {
      console.warn('Failed scanning local storage users:', e);
    }
    return localUsersMap;
  };

  // Helper to generate deterministic numeric User ID
  const getUserId = (user: UserAccount) => {
    if (user.customId) return user.customId;
    const clean = (user.walletAddress || '').toLowerCase().replace(/^0x/, '');
    const hash = parseInt(clean.slice(-8), 16);
    return (isNaN(hash) ? 10000000 : (hash % 89999999 + 10000000)).toString();
  };

  // Fetch Admin Stats
  const fetchAdminStats = async (adminPass: string, isInitial: boolean = false) => {
    let apiUsers: Record<string, UserAccount> = {};
    let apiLogs: any[] = [];
    let loadedConfig: any = null;

    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': adminPass }
      });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.config) loadedConfig = data.config;
        if (data.users) apiUsers = data.users;
        if (data.logs) apiLogs = data.logs;
      }
    } catch (err) {
      console.warn('Notice loading admin stats from API:', err);
    }

    if (isInitial) {
      try {
        const fsConfig = await fetchConfigFromFirestore();
        if (fsConfig && fsConfig.recipientAddress) {
          loadedConfig = fsConfig;
        }
      } catch (err) {
        console.warn('Firestore fetchConfig notice:', err);
      }

      if (loadedConfig) {
        if (loadedConfig.recipientAddress) setRecipientAddress(loadedConfig.recipientAddress);
        if (loadedConfig.baseYieldRate !== undefined) {
          setBaseYieldRatePercent(Number((loadedConfig.baseYieldRate * 100).toFixed(4)));
        }
        if (loadedConfig.minDepositUSDT !== undefined) setMinDepositUSDT(loadedConfig.minDepositUSDT);
        if (loadedConfig.minWithdrawUSDT !== undefined) setMinWithdrawUSDT(loadedConfig.minWithdrawUSDT);
        if (loadedConfig.minParticipateETH !== undefined) setMinParticipateETH(loadedConfig.minParticipateETH);
        if (loadedConfig.depositMode) setDepositMode(loadedConfig.depositMode);
        if (loadedConfig.depositSystems) setDepositSystems(loadedConfig.depositSystems);
        if (loadedConfig.yieldTiers && Array.isArray(loadedConfig.yieldTiers) && loadedConfig.yieldTiers.length > 0) {
          setYieldTiers(loadedConfig.yieldTiers);
        }
        if (loadedConfig.userAirdrops && Array.isArray(loadedConfig.userAirdrops) && loadedConfig.userAirdrops.length > 0) {
          const global = loadedConfig.userAirdrops.find((a: any) => a.targetAddress?.toUpperCase() === 'ALL');
          if (global) {
            setGlobalAirdrop(global);
          }
        }
      }
    }

    let firestoreUsers: Record<string, UserAccount> = {};
    try {
      firestoreUsers = await fetchUsersFromFirestore();
    } catch (err) {
      console.warn('Firestore fetchUsers notice:', err);
    }

    let fsLogs: TransactionLog[] = [];
    try {
      fsLogs = await fetchLogsFromFirestore();
    } catch (err) {
      console.warn('Firestore fetchLogs notice:', err);
    }

    // Merge API logs and Firestore logs by id, prioritizing updated non-pending status
    const logsMap = new Map<string, TransactionLog>();
    [...apiLogs, ...fsLogs].forEach((l) => {
      if (!l.id) return;
      const existing = logsMap.get(l.id);
      if (!existing) {
        logsMap.set(l.id, l);
      } else {
        if (existing.status === 'pending' && l.status !== 'pending') {
          logsMap.set(l.id, l);
        } else if ((l.timestamp || 0) >= (existing.timestamp || 0)) {
          logsMap.set(l.id, { ...existing, ...l });
        }
      }
    });

    const mergedLogs = Array.from(logsMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const localUsers = loadLocalUsers();
    const allAddresses = new Set([
      ...Object.keys(localUsers).map((a) => a.toLowerCase()),
      ...Object.keys(firestoreUsers).map((a) => a.toLowerCase()),
      ...Object.keys(apiUsers).map((a) => a.toLowerCase()),
    ]);
    const mergedUsersMap: Record<string, UserAccount> = {};
    allAddresses.forEach((rawAddr) => {
      const addr = rawAddr.toLowerCase();
      const local = localUsers[addr] || localUsers[rawAddr];
      const fs = firestoreUsers[addr] || firestoreUsers[rawAddr];
      const api = apiUsers[addr] || apiUsers[rawAddr];

      const base = { ...local, ...fs, ...api, walletAddress: addr };
      if (local?.isBlocked !== undefined) {
        base.isBlocked = local.isBlocked;
      } else if (fs?.isBlocked !== undefined) {
        base.isBlocked = fs.isBlocked;
      } else if (api?.isBlocked !== undefined) {
        base.isBlocked = api.isBlocked;
      }
      mergedUsersMap[addr] = base;
    });
    const mergedUsersList = Object.values(mergedUsersMap);

    let totalUSDT = 0;
    mergedUsersList.forEach(u => {
      totalUSDT += (u.occupiedUSDT || 0);
    });

    setUsersList(mergedUsersList);
    setTotalUsers(mergedUsersList.length);
    setTotals({ usdt: totalUSDT });
    setLogs(mergedLogs);
  };

  // Real-time Support Chat Polling for Admin
  useEffect(() => {
    if (!isAuthorized) return;
    let isMounted = true;

    const loadChats = async () => {
      try {
        const chats = await fetchAllChatsFromFirestore();
        if (!isMounted) return;
        const filtered = chats.filter((c) => !deletedChatIds.has(c.chatId.toLowerCase()));
        setChatSessions(filtered);
        setSelectedChatId((prev) => {
          if (prev && filtered.some((c) => c.chatId.toLowerCase() === prev.toLowerCase())) return prev;
          return filtered.length > 0 ? filtered[0].chatId : null;
        });
      } catch (err) {
        console.warn('Admin chat fetch notice:', err);
      }
    };

    loadChats();
    const interval = setInterval(loadChats, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthorized, deletedChatIds]);

  const handleSendAgentReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatId || !agentReplyText.trim() || isSendingReply) return;

    const agentMsg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      sender: 'agent',
      text: agentReplyText.trim(),
      timestamp: Date.now(),
    };

    setIsSendingReply(true);
    try {
      await sendMessageToChatInFirestore(selectedChatId, agentMsg);
      setAgentReplyText('');
      const updatedChats = await fetchAllChatsFromFirestore();
      setChatSessions(updatedChats.filter((c) => !deletedChatIds.has(c.chatId.toLowerCase())));
    } catch (err) {
      console.warn('Error sending agent reply:', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleCloseChatSession = async (chatId: string) => {
    if (!window.confirm('Are you sure you want to close and delete this support chat history?')) return;
    const cleanId = chatId.toLowerCase();
    
    // Optimistic UI removal
    setDeletedChatIds((prev) => new Set([...prev, cleanId]));
    setChatSessions((prev) => prev.filter((s) => s.chatId.toLowerCase() !== cleanId));
    if (selectedChatId?.toLowerCase() === cleanId) {
      setSelectedChatId(null);
    }
    setSuccessMsg('Support chat closed and deleted successfully.');
    setTimeout(() => setSuccessMsg(''), 3000);

    // Delete in background
    closeChatInFirestore(cleanId, true).catch((err) => console.warn('Error closing chat:', err));
  };

  // Update Config
  const handleUpdateConfig = async (e?: React.FormEvent, customSystems?: any[]) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (recipientAddress) {
      localStorage.setItem('custom_recipient_address', recipientAddress);
    }

    const calculatedBaseRate = baseYieldRatePercent / 100;

    saveConfigToFirestore({
      recipientAddress,
      minDepositUSDT,
      minWithdrawUSDT,
      minParticipateETH,
      depositMode,
      depositSystems: customSystems || depositSystems,
      yieldTiers,
      baseYieldRate: calculatedBaseRate,
    }).catch(err => console.warn('Firestore saveConfig notice:', err));

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          recipientAddress,
          minDepositUSDT,
          minWithdrawUSDT,
          minParticipateETH,
          depositMode,
          depositSystems: customSystems || depositSystems,
          yieldTiers,
          baseYieldRate: calculatedBaseRate,
        }),
      });

      if (res.ok) {
        setSuccessMsg('System configuration updated successfully!');
        if (onConfigUpdated) onConfigUpdated();
        fetchAdminStats(password, true);
        setTimeout(() => setSuccessMsg(''), 3000);
        return;
      }
    } catch (err) {
      console.warn('Backend config update notice:', err);
    } finally {
      setLoading(false);
    }

    if (onConfigUpdated) onConfigUpdated();
    setSuccessMsg('System configuration updated successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Handle Changing Admin Password
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordVal.trim()) {
      setErrorMsg('New password cannot be empty.');
      return;
    }
    if (newPasswordVal.length < 4) {
      setErrorMsg('New password must be at least 4 characters.');
      return;
    }
    if (newPasswordVal !== confirmPasswordVal) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    setIsChangingPass(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: password,
          newPassword: newPasswordVal.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const updatedPass = newPasswordVal.trim();
          localStorage.setItem('admin_custom_password', updatedPass);
          setPassword(updatedPass);
          setNewPasswordVal('');
          setConfirmPasswordVal('');
          setSuccessMsg('Admin password updated successfully!');
          setTimeout(() => setSuccessMsg(''), 4000);
          return;
        } else {
          setErrorMsg(data.error || 'Failed to change admin password.');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Failed to change admin password.');
      }
    } catch (err) {
      const updatedPass = newPasswordVal.trim();
      localStorage.setItem('admin_custom_password', updatedPass);
      setPassword(updatedPass);
      setNewPasswordVal('');
      setConfirmPasswordVal('');
      setSuccessMsg('Admin password updated for this session!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setIsChangingPass(false);
    }
  };

  // Handle Deposit Actions
  const handleDepositAction = async (logId: string, action: 'approve' | 'reject') => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const targetLog = logs.find((l) => l.id === logId);
    if (!targetLog) {
      setLoading(false);
      return;
    }

    const addr = targetLog.walletAddress.toLowerCase();
    const amount = targetLog.amount || 0;

    // Instant local status update
    setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, status: action === 'approve' ? 'success' : 'failed' } : l)));

    if (action === 'approve') {
      let targetUser = usersList.find((u) => u.walletAddress.toLowerCase() === addr);
      if (!targetUser) {
        try {
          targetUser = await fetchUserFromFirestore(addr);
        } catch (e) {}
      }
      let localUser: any = null;
      try {
        const localSaved = localStorage.getItem(`user_${addr}`);
        if (localSaved) localUser = JSON.parse(localSaved);
      } catch (e) {}

      const baseUser: UserAccount = targetUser || localUser || {
        walletAddress: addr,
        usdtBalance: 0,
        occupiedUSDT: 0,
        totalYieldEarned: 0,
        lastYieldPayout: Date.now(),
        createdAt: Date.now(),
      };

      const currentMaxUsdt = Math.max(baseUser.usdtBalance || 0, localUser?.usdtBalance || 0, targetUser?.usdtBalance || 0);

      const updatedUser: UserAccount = {
        ...baseUser,
        ...localUser,
        usdtBalance: currentMaxUsdt + amount,
        updatedAt: Date.now(),
      };

      localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
      saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore deposit approval user error:', err));
      updateLogStatusInFirestore(logId, 'success', `Approved by Admin. $${amount} USDT added to available balance.`);

      fetch(`/api/user/${addr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      }).catch((err) => console.warn('API saveUser notice on deposit approval:', err));

      setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
      setSuccessMsg(`Deposit approved! $${amount} USDT added to available balance for: ${addr.slice(0, 8)}...`);

      try {
        await fetch(`/api/admin/deposits/${logId}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, userAccount: updatedUser }),
        });
      } catch (err) {
        console.warn('Backend deposit action notice:', err);
      } finally {
        setLoading(false);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
      return;
    } else {
      updateLogStatusInFirestore(logId, 'failed', `Deposit request rejected by Admin.`);
      setSuccessMsg(`Deposit request rejected.`);
    }

    try {
      await fetch(`/api/admin/deposits/${logId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    } catch (err) {
      console.warn('Backend deposit action notice:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // Handle Withdrawal Actions
  const handleWithdrawalAction = async (logId: string, action: 'approve' | 'reject') => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const targetLog = logs.find((l) => l.id === logId);
    if (!targetLog) {
      setLoading(false);
      return;
    }

    const addr = targetLog.walletAddress.toLowerCase();
    const amount = targetLog.amount || 0;
    const currency = (targetLog.currency || 'USDT').toUpperCase();

    // Instant local status update
    setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, status: action === 'approve' ? 'success' : 'failed' } : l)));

    if (action === 'approve') {
      updateLogStatusInFirestore(logId, 'success', `Withdrawal of ${amount} ${currency} approved by Admin.`);
      setSuccessMsg(`Withdrawal approved for ${addr.slice(0, 8)}...`);
    } else {
      // Refund user balance if rejected
      let targetUser = usersList.find((u) => u.walletAddress.toLowerCase() === addr);
      if (!targetUser) {
        try {
          targetUser = await fetchUserFromFirestore(addr);
        } catch (e) {}
      }
      if (targetUser) {
        const updatedUser: UserAccount = { ...targetUser, updatedAt: Date.now() };
        if (currency === 'USDT') updatedUser.usdtBalance = (updatedUser.usdtBalance || 0) + amount;
        else if (currency === 'USDC') updatedUser.usdcBalance = (updatedUser.usdcBalance || 0) + amount;
        else if (currency === 'BTC') updatedUser.btcBalance = (updatedUser.btcBalance || 0) + amount;

        localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
        saveUserToFirestore(updatedUser).catch((err) => console.warn('Refund user error:', err));
        setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
      }
      updateLogStatusInFirestore(logId, 'failed', `Withdrawal request rejected by Admin. Refunded ${amount} ${currency}.`);
      setSuccessMsg(`Withdrawal rejected and refunded to ${addr.slice(0, 8)}...`);
    }

    try {
      await fetch(`/api/admin/withdrawals/${logId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    } catch (err) {
      console.warn('Network error during withdrawal action:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // Open Edit Modal for a User
  const handleOpenEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setEditUsdtBalance((user.usdtBalance || 0).toString());
    setEditOccupiedUSDT((user.occupiedUSDT || 0).toString());
    setEditUsdcBalance((user.usdcBalance || 0).toString());
    setEditBtcBalance((user.btcBalance || 0).toString());
    setEditEthBalance((user.ethBalance || 0).toString());
    setEditIsWithdrawLocked(!!user.isWithdrawLocked);
    setEditWithdrawLockNotice(user.withdrawLockNotice || 'Withdrawal Locked. Please contact support.');
  };

  // Save User Details Edit
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const addr = editingUser.walletAddress.toLowerCase();
    const updatedUser: UserAccount = {
      ...editingUser,
      usdtBalance: parseFloat(editUsdtBalance) || 0,
      occupiedUSDT: parseFloat(editOccupiedUSDT) || 0,
      usdcBalance: parseFloat(editUsdcBalance) || 0,
      btcBalance: parseFloat(editBtcBalance) || 0,
      ethBalance: parseFloat(editEthBalance) || 0,
      isWithdrawLocked: editIsWithdrawLocked,
      withdrawLockNotice: editWithdrawLockNotice,
      updatedAt: Date.now(),
    };

    // Save to LocalStorage
    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));

    // Save to Firestore
    try {
      await saveUserToFirestore(updatedUser);
    } catch (err) {
      console.warn('Firestore user edit error:', err);
    }

    // Save via backend API
    try {
      await fetch('/api/admin/update-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          walletAddress: addr,
          fullUser: updatedUser,
        }),
      });
    } catch (err) {
      console.warn('Backend update balance notice:', err);
    }

    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    setSuccessMsg(`User ${addr.slice(0, 8)}... details updated successfully!`);
    setEditingUser(null);
    fetchAdminStats(password);
    setLoading(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Toggle User Withdrawal Lock Status
  const handleToggleWithdrawLockUser = async (user: UserAccount) => {
    const addr = user.walletAddress.toLowerCase();
    const newLockStatus = !user.isWithdrawLocked;
    let notice = user.withdrawLockNotice || 'Your account withdrawal has been locked by admin.';
    if (newLockStatus) {
      const inputNotice = prompt('Enter withdrawal lock notice message for user:', notice);
      if (inputNotice !== null && inputNotice.trim()) {
        notice = inputNotice.trim();
      }
    }

    const updatedUser: UserAccount = {
      ...user,
      isWithdrawLocked: newLockStatus,
      withdrawLockNotice: notice,
      updatedAt: Date.now(),
    };

    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
    saveUserToFirestore(updatedUser).catch(err => console.warn('Firestore lock error:', err));

    try {
      await fetch('/api/admin/update-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          walletAddress: addr,
          isWithdrawLocked: newLockStatus,
          withdrawLockNotice: notice,
        }),
      });
    } catch (err) {
      console.warn('Backend withdraw lock notice:', err);
    }

    setUsersList((prev) =>
      prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u))
    );

    setSuccessMsg(`User ${getUserId(user)} (${addr.slice(0, 8)}...) withdrawal is now ${newLockStatus ? 'LOCKED' : 'UNLOCKED'}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Toggle User Block Status
  const handleToggleBlockUser = async (user: UserAccount) => {
    const addr = user.walletAddress.toLowerCase();
    const newBlockStatus = !user.isBlocked;

    const updatedUser: UserAccount = {
      ...user,
      isBlocked: newBlockStatus,
      updatedAt: Date.now(),
    };

    // LocalStorage
    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));

    // Firestore
    updateUserBlockInFirestore(addr, newBlockStatus).catch(err => console.warn('Firestore block error:', err));
    saveUserToFirestore(updatedUser).catch(err => console.warn('Firestore save user error:', err));

    // Backend API
    try {
      await fetch('/api/admin/update-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          walletAddress: addr,
          isBlocked: newBlockStatus,
        }),
      });
    } catch (err) {
      console.warn('Backend block endpoint notice:', err);
    }

    // Update state instantly
    setUsersList((prev) =>
      prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u))
    );

    setSuccessMsg(`User ${getUserId(user)} (${addr}) is now ${newBlockStatus ? 'BLOCKED' : 'UNBLOCKED'}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Handle Save / Update Airdrop for a specific user or ALL
  const handleSaveAirdrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!airdropTargetAddress) {
      setErrorMsg('Please select or enter a target user wallet address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const targetRaw = airdropTargetAddress.trim();
    const addr = targetRaw.toLowerCase();
    const isGlobal = addr === 'all' || targetRaw.toUpperCase() === 'ALL';

    const newConfig: UserAirdropConfig = {
      id: `airdrop_${isGlobal ? 'ALL' : addr}_${Date.now()}`,
      targetAddress: isGlobal ? 'ALL' : addr,
      standardUSDT: Number(airdropStandardUSDT) || 5000,
      outputETH: Number(airdropOutputETH) || 10,
      endTime: Date.now() + (Number(airdropDurationDays) || 7) * 86400 * 1000,
      durationDays: Number(airdropDurationDays) || 7,
      enabled: airdropEnabled,
      createdAt: Date.now(),
    };

    if (isGlobal) {
      setGlobalAirdrop(newConfig);

      // 1. Save global default in AppConfig
      await saveConfigToFirestore({
        airdropStandardUSDT: Number(airdropStandardUSDT) || 5000,
        airdropOutputETH: Number(airdropOutputETH) || 10,
        airdropCountdownDays: Number(airdropDurationDays) || 7,
        userAirdrops: [newConfig],
      }).catch((err) => console.warn('Firestore save config airdrop error:', err));

      try {
        await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password,
            airdropStandardUSDT: Number(airdropStandardUSDT) || 5000,
            airdropOutputETH: Number(airdropOutputETH) || 10,
            airdropCountdownDays: Number(airdropDurationDays) || 7,
            userAirdrops: [newConfig],
          }),
        });
      } catch (e) {}

      // 2. Assign & apply to ALL users in usersList
      const updatedList = await Promise.all(
        usersList.map(async (u) => {
          const userAddr = u.walletAddress.toLowerCase();
          const updatedUser: UserAccount = {
            ...u,
            airdropConfig: newConfig,
            updatedAt: Date.now(),
          };
          localStorage.setItem(`user_${userAddr}`, JSON.stringify(updatedUser));
          saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore save user airdrop error:', err));
          try {
            fetch('/api/admin/update-balance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                password,
                walletAddress: userAddr,
                airdropConfig: newConfig,
              }),
            });
          } catch (e) {}
          return updatedUser;
        })
      );

      setUsersList(updatedList);
      setSuccessMsg('Global Airdrop created and assigned to ALL users successfully!');
    } else {
      // Save directly to target user
      const targetUser = usersList.find((u) => u.walletAddress.toLowerCase() === addr);
      let updatedUser: UserAccount;
      if (targetUser) {
        updatedUser = {
          ...targetUser,
          airdropConfig: newConfig,
          updatedAt: Date.now(),
        };
        localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
        await saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore save user airdrop error:', err));
        setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
      } else {
        // Create user placeholder with airdropConfig
        updatedUser = {
          walletAddress: addr,
          usdtBalance: 0,
          occupiedUSDT: 0,
          totalYieldEarned: 0,
          lastYieldPayout: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          airdropConfig: newConfig,
        };
        localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
        await saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore save new user airdrop error:', err));
        setUsersList((prev) => [...prev, updatedUser]);
      }

      // Sync with server API
      try {
        await fetch('/api/admin/update-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password,
            walletAddress: addr,
            airdropConfig: newConfig,
          }),
        });
      } catch (err) {
        console.warn('Backend airdrop save notice:', err);
      }
      setSuccessMsg(`Airdrop configured successfully for target ${addr}!`);
    }

    setLoading(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Delete Airdrop from a specific user or ALL
  const handleDeleteAirdrop = async (targetAddr: string) => {
    if (!targetAddr) return;
    if (!window.confirm(`Are you sure you want to delete the airdrop for target ${targetAddr}?`)) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const addr = targetAddr.toLowerCase();
    const isGlobal = addr === 'all' || targetAddr.toUpperCase() === 'ALL';

    if (isGlobal) {
      setGlobalAirdrop(null);
      await saveConfigToFirestore({
        userAirdrops: [],
      }).catch((err) => console.warn('Firestore delete global airdrop error:', err));

      try {
        await fetch('/api/admin/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password,
            userAirdrops: [],
          }),
        });
      } catch (e) {}

      // Clear airdropConfig for ALL users in usersList
      const updatedList = await Promise.all(
        usersList.map(async (u) => {
          const userAddr = u.walletAddress.toLowerCase();
          const updatedUser: UserAccount = {
            ...u,
            airdropConfig: undefined,
            updatedAt: Date.now(),
          };
          localStorage.setItem(`user_${userAddr}`, JSON.stringify(updatedUser));
          saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore delete user airdrop error:', err));
          try {
            fetch('/api/admin/update-balance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                password,
                walletAddress: userAddr,
                airdropConfig: null,
              }),
            });
          } catch (e) {}
          return updatedUser;
        })
      );

      setUsersList(updatedList);
      setSuccessMsg('Global default airdrop removed from all users.');
      if (airdropTargetAddress.toUpperCase() === 'ALL' || airdropTargetAddress.toLowerCase() === 'all') {
        setAirdropTargetAddress('');
      }
      setLoading(false);
      setTimeout(() => setSuccessMsg(''), 4000);
      return;
    }

    const targetUser = usersList.find((u) => u.walletAddress.toLowerCase() === addr);
    const baseUser = targetUser || {
      walletAddress: addr,
      usdtBalance: 0,
      occupiedUSDT: 0,
      totalYieldEarned: 0,
      lastYieldPayout: Date.now(),
      createdAt: Date.now(),
    };

    const updatedUser: UserAccount = {
      ...baseUser,
      airdropConfig: undefined,
      updatedAt: Date.now(),
    };

    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
    await saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore delete user airdrop error:', err));

    try {
      await fetch('/api/admin/update-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          walletAddress: addr,
          airdropConfig: null,
        }),
      });
    } catch (err) {}

    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    if (airdropTargetAddress.toLowerCase() === addr) {
      setAirdropTargetAddress('');
    }
    setSuccessMsg(`Airdrop successfully deleted for ${addr}`);
    setLoading(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Filter users by searchQuery (User ID or Wallet address)
  const filteredUsers = usersList.filter((u) => {
    if (!searchQuery.trim()) return true;
    const queryLower = searchQuery.trim().toLowerCase();
    const userId = getUserId(u);
    const wallet = (u.walletAddress || '').toLowerCase();
    return userId.includes(queryLower) || wallet.includes(queryLower);
  });

  // Export / Download Backup JSON
  const handleExportBackup = async () => {
    try {
      const res = await fetch(`/api/admin/db.json?password=${encodeURIComponent(password)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `db.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccessMsg('db.json downloaded successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
        return;
      }
    } catch (err) {
      console.warn('Server download fallback notice:', err);
    }

    // Client-side fallback if server fetch unavailable
    const data = {
      timestamp: Date.now(),
      users: usersList,
      config: {
        recipientAddress,
        minDepositUSDT,
        minWithdrawUSDT,
        depositMode,
        depositSystems,
      },
      logs,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `db.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccessMsg('db.json generated and downloaded!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Restore Database File
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileContent = event.target?.result;
      if (typeof fileContent !== 'string') return;

      setUploadLoading(true);
      try {
        const parsed = JSON.parse(fileContent);
        if (parsed.users) {
          const userArr = Array.isArray(parsed.users) ? parsed.users : Object.values(parsed.users);
          userArr.forEach((u: any) => {
            if (u && u.walletAddress) {
              const addr = u.walletAddress.toLowerCase();
              localStorage.setItem(`user_${addr}`, JSON.stringify(u));
              saveUserToFirestore(u).catch(() => {});
            }
          });
        }
        setSuccessMsg('Database restored successfully!');
        fetchAdminStats(password);
      } catch (err: any) {
        setErrorMsg('Invalid JSON backup file: ' + err.message);
      } finally {
        setUploadLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Login Screen
  if (!isAuthorized) {
    return (
      <div className="bg-slate-100 min-h-screen text-slate-800 flex items-center justify-center p-4 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 max-w-sm w-full border border-slate-200 shadow-xl relative overflow-hidden"
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-50 text-[#0088ff] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-xs">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Admin Portal</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Enter admin password to manage users, approvals, and system parameters.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0088ff] focus:ring-2 focus:ring-blue-100 transition"
                  required
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs text-red-600 font-semibold text-center flex items-center justify-center gap-1.5 bg-red-50 p-3 rounded-xl border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0088ff] hover:bg-blue-600 active:bg-blue-700 text-white font-bold rounded-xl transition text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                'Login to Admin'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={onBack}
            className="mt-6 w-full text-center text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer transition"
          >
            &larr; Return to App
          </button>
        </motion.div>
      </div>
    );
  }

  const pendingDepositsCount = logs.filter((l) => l.type === 'deposit' && l.status === 'pending').length;
  const pendingWithdrawalsCount = logs.filter((l) => l.type === 'withdraw' && l.status === 'pending').length;
  const totalPending = pendingDepositsCount + pendingWithdrawalsCount;

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans pb-20">
      {/* Top Header Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0088ff] border border-blue-100 flex items-center justify-center font-bold shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                System Admin Panel
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  LIVE
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Manage accounts, deposit approvals, and wallet configurations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAdminStats(password)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              title="Refresh Stats"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Exit Admin
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 border-t border-slate-100 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'users', label: 'User Management', icon: Users, badge: usersList.length },
            { id: 'requests', label: 'Pending Requests', icon: ArrowDownCircle, badge: totalPending > 0 ? totalPending : undefined },
            { id: 'support', label: 'Support Chat', icon: Headset, badge: chatSessions.length > 0 ? chatSessions.length : undefined },
            { id: 'airdrops', label: 'Per-User Airdrops', icon: Gift },
            { id: 'settings', label: 'System Settings', icon: Settings },
            { id: 'backup', label: 'Backup & Logs', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 font-bold text-xs transition cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-[#0088ff] text-[#0088ff] bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      tab.id === 'requests' && totalPending > 0
                        ? 'bg-amber-500 text-white animate-pulse'
                        : isActive
                        ? 'bg-blue-100 text-[#0088ff]'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Notice Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 mb-3 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl flex items-center gap-2 mb-3 shadow-2xs">
            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
            {errorMsg}
          </div>
        )}
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 space-y-6">
        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                  <span>Registered Users</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-slate-900">{totalUsers}</div>
                <div className="text-[11px] text-slate-500">Active wallet profiles</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                  <span>Total Occupied Assets</span>
                  <Coins className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600">
                  ${(totals.usdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500">USDT compounding in nodes</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                  <span>Pending Requests</span>
                  <ArrowDownCircle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-amber-600">{totalPending}</div>
                <div className="text-[11px] text-slate-500">Deposits & withdrawals awaiting review</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex justify-between items-center text-slate-500 text-xs font-semibold">
                  <span>Forwarding Wallet</span>
                  <Wallet className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 truncate" title={recipientAddress}>
                  {recipientAddress ? `${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-6)}` : 'Not Set'}
                </div>
                <div className="text-[11px] text-slate-500">All deposits transfer here</div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0088ff]" /> Quick User Lookup
                </h3>
                <p className="text-xs text-slate-500">
                  Search user accounts by User ID or wallet address to edit balance details or block access.
                </p>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setActiveTab('users');
                    }}
                    placeholder="Enter User ID (e.g. 53466368) or 0x address..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0088ff]"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                >
                  Go to Full User Management <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-amber-500" /> Pending Approvals Queue
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-600 font-medium">Pending Deposit Proofs</span>
                    <span className="font-extrabold text-amber-600">{pendingDepositsCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-600 font-medium">Pending Cashout Requests</span>
                    <span className="font-extrabold text-amber-600">{pendingWithdrawalsCount}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                >
                  Review Pending Requests <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT (ইউজার আইডি দিয়ে খোজা, ডিটেইলস ইডিট, ব্লক করা) */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#0088ff]" /> User Accounts Management
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search by User ID or address, edit user balances, or block/unblock accounts.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by User ID or Wallet Address..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0088ff] focus:ring-2 focus:ring-blue-100 transition"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* User List Table */}
            <div className="overflow-x-auto">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-semibold">
                    No users found matching "{searchQuery}".
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">User ID</th>
                      <th className="py-3 px-4">Wallet Address</th>
                      <th className="py-3 px-4 text-right">Occupied USDT</th>
                      <th className="py-3 px-4 text-right">Available USDT</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Withdrawal</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredUsers.map((u, i) => {
                      const userId = getUserId(u);
                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            <span className="bg-blue-50 text-[#0088ff] border border-blue-100 px-2.5 py-1 rounded-lg text-xs">
                              ID: {userId}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-800 font-bold text-xs break-all select-all selection:bg-blue-100" title={u.walletAddress}>
                            {u.walletAddress}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                            ${(u.occupiedUSDT || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                            ${(u.usdtBalance || 0).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {u.isBlocked ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                                BLOCKED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                ACTIVE
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {u.isWithdrawLocked ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center gap-1 mx-auto w-max" title={u.withdrawLockNotice || 'Locked'}>
                                <ShieldAlert className="w-3 h-3 text-amber-600" /> LOCKED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 inline-block">
                                NORMAL
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Edit Details Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0088ff] font-bold text-[11px] rounded-lg transition cursor-pointer flex items-center gap-1 border border-blue-200"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </button>

                              {/* Toggle Withdraw Lock */}
                              <button
                                type="button"
                                onClick={() => handleToggleWithdrawLockUser(u)}
                                className={`px-2.5 py-1.5 font-bold text-[11px] rounded-lg transition cursor-pointer flex items-center gap-1 border ${
                                  u.isWithdrawLocked
                                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                }`}
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                {u.isWithdrawLocked ? 'Unlock W/D' : 'Lock W/D'}
                              </button>

                              {/* Block / Unblock Toggle Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleBlockUser(u)}
                                className={`px-2.5 py-1.5 font-bold text-[11px] rounded-lg transition cursor-pointer flex items-center gap-1 border ${
                                  u.isBlocked
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                                }`}
                              >
                                {u.isBlocked ? (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" /> Unblock
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5" /> Block
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PENDING DEPOSITS & WITHDRAWALS */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            {/* Pending Deposits Queue */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-600" /> Pending Deposit Requests
                </h3>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-bold border border-emerald-200">
                  {pendingDepositsCount} Pending
                </span>
              </div>

              {pendingDepositsCount === 0 ? (
                <p className="text-xs text-slate-500 py-4 italic">No pending deposit requests in queue.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-4">Time</th>
                        <th className="py-2.5 px-4">User Wallet</th>
                        <th className="py-2.5 px-4">Amount</th>
                        <th className="py-2.5 px-4">Screenshot Proof</th>
                        <th className="py-2.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {logs.filter((l) => l.type === 'deposit' && l.status === 'pending').map((depLog) => (
                        <tr key={depLog.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(depLog.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-900 font-bold break-all select-all selection:bg-blue-100">
                            {depLog.walletAddress}
                          </td>
                          <td className="py-3 px-4 text-emerald-600 font-extrabold text-sm">
                            ${depLog.amount} {depLog.currency || 'USDT'}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            {depLog.proofImage ? (
                              <button
                                type="button"
                                onClick={() => setSelectedProofModal(depLog.proofImage || null)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0088ff] text-[11px] rounded-lg font-bold flex items-center gap-1 cursor-pointer transition border border-blue-200"
                              >
                                <Camera className="w-3.5 h-3.5" /> View Proof
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">No image attached</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleDepositAction(depLog.id, 'approve')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve & Add Dollars
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDepositAction(depLog.id, 'reject')}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pending Withdrawals Queue */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" /> Pending Withdrawal Requests
                </h3>
                <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-bold border border-amber-200">
                  {pendingWithdrawalsCount} Pending
                </span>
              </div>

              {pendingWithdrawalsCount === 0 ? (
                <p className="text-xs text-slate-500 py-4 italic">No pending withdrawal requests in queue.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-4">Time</th>
                        <th className="py-2.5 px-4">User Wallet</th>
                        <th className="py-2.5 px-4">Amount to Cashout</th>
                        <th className="py-2.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {logs.filter((l) => l.type === 'withdraw' && l.status === 'pending').map((reqLog) => (
                        <tr key={reqLog.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(reqLog.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-900 font-bold break-all select-all selection:bg-blue-100">
                            {reqLog.walletAddress}
                          </td>
                          <td className="py-3 px-4 text-amber-600 font-bold text-sm">
                            ${reqLog.amount} {reqLog.currency}
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleWithdrawalAction(reqLog.id, 'approve')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve Cashout
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWithdrawalAction(reqLog.id, 'reject')}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <X className="w-3.5 h-3.5" /> Reject & Refund
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: LIVE CUSTOMER SUPPORT CHAT */}
        {activeTab === 'support' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col md:flex-row min-h-[580px]">
            {/* Left Column: Chat Sessions List */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col bg-slate-50/50">
              <div className="p-4 border-b border-slate-200 bg-white">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Headset className="w-4 h-4 text-blue-600" /> Support Conversations ({chatSessions.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Real-time live messaging with website users</p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {chatSessions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-medium">
                    No active support messages yet.
                  </div>
                ) : (
                  chatSessions.map((session) => {
                    const isSelected = selectedChatId === session.chatId;
                    const lastMsg = session.messages?.[session.messages.length - 1];
                    const userForSession = usersList.find(u => u.walletAddress.toLowerCase() === (session.walletAddress || session.chatId).toLowerCase());
                    const userId = userForSession ? getUserId(userForSession) : 'Guest';
                    return (
                      <button
                        key={session.chatId}
                        onClick={() => setSelectedChatId(session.chatId)}
                        className={`w-full text-left p-3.5 transition cursor-pointer flex items-start gap-3 ${
                          isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                          {userId !== 'Guest' ? 'U' : 'G'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              ID: {userId} ({session.chatId.slice(0, 6)}...)
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(session.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {lastMsg ? lastMsg.text : 'No messages'}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Chat Thread & Reply Box */}
            <div className="flex-1 flex flex-col bg-white">
              {selectedChatId ? (() => {
                const currentSession = chatSessions.find(s => s.chatId === selectedChatId);
                const currentMsgs = currentSession?.messages || [];
                const matchedUser = usersList.find(u => u.walletAddress.toLowerCase() === (currentSession?.walletAddress || selectedChatId).toLowerCase());
                return (
                  <>
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/30">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          User ID: {matchedUser ? getUserId(matchedUser) : 'Guest'}
                          <span className="text-xs font-mono font-normal text-slate-500">({selectedChatId})</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          USDT Balance: <strong className="text-emerald-600">${(matchedUser?.usdtBalance || 0).toFixed(2)}</strong> | Occupied Balance: <strong className="text-blue-600">${(matchedUser?.occupiedUSDT || 0).toFixed(2)}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCloseChatSession(selectedChatId)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Close & Delete Chat
                      </button>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 min-h-[360px]">
                      {currentMsgs.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                              msg.sender === 'agent'
                                ? 'bg-blue-600 text-white rounded-tr-none shadow-xs'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-2xs'
                            }`}
                          >
                            <div className="font-bold text-[10px] mb-1 opacity-80">
                              {msg.sender === 'agent' ? 'Admin Agent' : 'User'}
                            </div>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <span className="text-[9px] block text-right mt-1 opacity-70 font-mono">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Agent Reply Input */}
                    <form onSubmit={handleSendAgentReply} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                      <input
                        type="text"
                        value={agentReplyText}
                        onChange={(e) => setAgentReplyText(e.target.value)}
                        placeholder="Type reply to user..."
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="submit"
                        disabled={!agentReplyText.trim() || isSendingReply}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs cursor-pointer transition flex items-center gap-1.5 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" /> Send Reply
                      </button>
                    </form>
                  </>
                );
              })() : (
                <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs font-semibold">
                  Select a user conversation from the left menu to start chatting.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PER-USER AIRDROPS */}
        {activeTab === 'airdrops' && (
          <div className="space-y-6">
            {/* Form to Assign / Update Airdrop for a User */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-blue-600" /> Assign & Manage Per-User Airdrop
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Create custom Airdrop events for specific user addresses
                </span>
              </div>

              <form onSubmit={handleSaveAirdrop} className="space-y-4 max-w-3xl">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Target User (Wallet Address / User ID)
                  </label>
                  <select
                    value={airdropTargetAddress}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAirdropTargetAddress(val);
                      if ((val === 'ALL' || val.toLowerCase() === 'all') && globalAirdrop) {
                        setAirdropStandardUSDT(globalAirdrop.standardUSDT);
                        setAirdropOutputETH(globalAirdrop.outputETH);
                        setAirdropDurationDays(globalAirdrop.durationDays || 7);
                        setAirdropEnabled(globalAirdrop.enabled);
                      } else if (val) {
                        const match = usersList.find((u) => u.walletAddress.toLowerCase() === val.toLowerCase());
                        if (match && match.airdropConfig) {
                          setAirdropStandardUSDT(match.airdropConfig.standardUSDT);
                          setAirdropOutputETH(match.airdropConfig.outputETH);
                          setAirdropDurationDays(match.airdropConfig.durationDays || 7);
                          setAirdropEnabled(match.airdropConfig.enabled);
                        }
                      }
                    }}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">-- Select Target User --</option>
                    <option value="ALL">🌟 ALL Users (Global Default)</option>
                    {usersList.map((u) => (
                      <option key={u.walletAddress} value={u.walletAddress}>
                        User ID: {getUserId(u)} ({u.walletAddress.slice(0, 10)}...{u.walletAddress.slice(-6)}) {u.airdropConfig ? '✓ Has Airdrop' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={airdropTargetAddress}
                    onChange={(e) => setAirdropTargetAddress(e.target.value)}
                    placeholder="Or enter custom wallet address (0x...)"
                    className="w-full mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Standard Target ($ USDT)
                    </label>
                    <input
                      type="number"
                      value={airdropStandardUSDT}
                      onChange={(e) => setAirdropStandardUSDT(Number(e.target.value))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Output Reward (ETH)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={airdropOutputETH}
                      onChange={(e) => setAirdropOutputETH(Number(e.target.value))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Countdown Duration (Days)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={airdropDurationDays}
                      onChange={(e) => setAirdropDurationDays(Number(e.target.value))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="text-xs font-bold text-slate-700">
                    Airdrop Active Status:
                  </label>
                  <button
                    type="button"
                    onClick={() => setAirdropEnabled(!airdropEnabled)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border cursor-pointer ${
                      airdropEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-300'
                    }`}
                  >
                    {airdropEnabled ? '✓ Active / Enabled' : '✕ Disabled'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <Gift className="w-4 h-4" /> Save / Update Airdrop
                </button>
              </form>
            </div>

            {/* List of Users with Airdrops */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users className="w-5 h-5 text-slate-700" /> Active Per-User Airdrops
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-4">User ID / Target</th>
                      <th className="py-2.5 px-4">Wallet Address</th>
                      <th className="py-2.5 px-4">Standard USDT</th>
                      <th className="py-2.5 px-4">Output ETH</th>
                      <th className="py-2.5 px-4">Ends At</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {/* Global Airdrop row */}
                    {globalAirdrop && (
                      <tr className="bg-amber-50/60 hover:bg-amber-50 transition border-b-2 border-amber-200">
                        <td className="py-3 px-4 font-sans font-extrabold text-amber-900 flex items-center gap-1.5">
                          <span>🌟</span> ALL Users (Global Airdrop)
                        </td>
                        <td className="py-3 px-4 text-amber-800 font-bold font-mono">
                          ALL
                        </td>
                        <td className="py-3 px-4 text-slate-900 font-bold">
                          {globalAirdrop.standardUSDT} USDT
                        </td>
                        <td className="py-3 px-4 text-blue-600 font-bold">
                          {globalAirdrop.outputETH} ETH
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(globalAirdrop.endTime).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          {globalAirdrop.enabled ? (
                            Date.now() > globalAirdrop.endTime ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px]">
                                Ended
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                                Active (Global)
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-bold text-[10px]">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAirdropTargetAddress('ALL');
                                setAirdropStandardUSDT(globalAirdrop.standardUSDT);
                                setAirdropOutputETH(globalAirdrop.outputETH);
                                setAirdropDurationDays(globalAirdrop.durationDays || 7);
                                setAirdropEnabled(globalAirdrop.enabled);
                              }}
                              className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg font-bold text-xs transition cursor-pointer"
                              title="Edit Global Airdrop"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAirdrop('ALL')}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-bold text-xs transition cursor-pointer"
                              title="Delete Global Airdrop"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {!globalAirdrop && usersList.filter((u) => u.airdropConfig).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                          No active airdrops configured yet. Select a user above or choose "ALL Users" to create an Airdrop!
                        </td>
                      </tr>
                    ) : (
                      usersList
                        .filter((u) => u.airdropConfig && u.airdropConfig.targetAddress?.toUpperCase() !== 'ALL')
                        .map((u) => {
                          const cfg = u.airdropConfig!;
                          const isExpired = Date.now() > cfg.endTime;
                          return (
                            <tr key={u.walletAddress} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-4 font-sans font-bold text-slate-900">
                                User ID: {getUserId(u)}
                              </td>
                              <td className="py-3 px-4 text-slate-800 break-all select-all font-bold">
                                {u.walletAddress}
                              </td>
                              <td className="py-3 px-4 text-slate-900 font-bold">
                                {cfg.standardUSDT} USDT
                              </td>
                              <td className="py-3 px-4 text-blue-600 font-bold">
                                {cfg.outputETH} ETH
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                {new Date(cfg.endTime).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-center font-sans">
                                {cfg.enabled ? (
                                  isExpired ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
                                      Ended
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                                      Active
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-bold text-[10px]">
                                    Disabled
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-sans">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAirdropTargetAddress(u.walletAddress);
                                      setAirdropStandardUSDT(cfg.standardUSDT);
                                      setAirdropOutputETH(cfg.outputETH);
                                      setAirdropDurationDays(cfg.durationDays || 7);
                                      setAirdropEnabled(cfg.enabled);
                                    }}
                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-xs transition cursor-pointer"
                                    title="Edit Airdrop"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAirdrop(u.walletAddress)}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold text-xs transition cursor-pointer"
                                    title="Delete Airdrop"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Settings className="w-5 h-5 text-[#0088ff]" /> Forwarding & Deposit Parameters
              </h3>

              <form onSubmit={handleUpdateConfig} className="space-y-4 max-w-2xl">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Recipient Wallet Address (Funds automatically transfer here)
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#0088ff]"
                    placeholder="0x71C7656EC7ab88b098defB751B7401B5f6d1476B"
                    required
                  />
                  <span className="text-[11px] text-amber-600 font-medium mt-1 block">
                    ⚠️ Verify this address carefully. Customer deposits will be transferred directly to this wallet.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Minimum Deposit Limit ($ USDT)
                    </label>
                    <input
                      type="number"
                      value={minDepositUSDT}
                      onChange={(e) => setMinDepositUSDT(parseInt(e.target.value) || 0)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0088ff]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Minimum Withdrawal Limit ($ USDT)
                    </label>
                    <input
                      type="number"
                      value={minWithdrawUSDT}
                      onChange={(e) => setMinWithdrawUSDT(parseInt(e.target.value) || 0)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0088ff]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Node Participate Min ETH Amount
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={minParticipateETH}
                      onChange={(e) => setMinParticipateETH(parseFloat(e.target.value) || 0.5)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0088ff]"
                      required
                    />
                  </div>
                </div>



                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="py-3.5 px-8 bg-[#0088ff] hover:bg-blue-600 active:bg-blue-700 text-white font-black rounded-xl transition text-xs shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Save System Parameters & Profit Rates
                  </button>
                </div>
              </form>
            </div>

            {/* Change Admin Password Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Key className="w-5 h-5 text-[#0088ff]" /> Change Admin Password
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Update your system administrator password.
              </p>

              <form onSubmit={handleChangeAdminPassword} className="space-y-4 max-w-md">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0088ff]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPasswordVal}
                    onChange={(e) => setConfirmPasswordVal(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0088ff]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="py-3 px-6 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-extrabold rounded-xl transition text-xs shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isChangingPass ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Update Admin Password
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: BACKUP & SYSTEM LOGS */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Database className="w-5 h-5 text-[#0088ff]" /> Database Backup & Restore
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">Export System Data</h4>
                  <p className="text-xs text-slate-500">
                    Download complete snapshot of user accounts, balances, logs, and system settings as JSON.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="w-full py-2.5 bg-[#0088ff] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download Backup JSON
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">Restore System Data</h4>
                  <p className="text-xs text-slate-500">
                    Upload a previously saved backup file to restore registered users and balances.
                  </p>
                  <label className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />
                    {uploadLoading ? 'Restoring...' : 'Upload & Restore File'}
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreFile}
                      className="hidden"
                      disabled={uploadLoading}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* System Activity Logs Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <History className="w-5 h-5 text-slate-700" /> Recent Activity Logs
              </h3>

              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Event Type</th>
                      <th className="py-2.5 px-4">User Wallet</th>
                      <th className="py-2.5 px-4">Amount</th>
                      <th className="py-2.5 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {logs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-4 font-sans">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {log.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-800 font-bold break-all select-all selection:bg-blue-100" title={log.walletAddress}>
                          {log.walletAddress}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {log.amount > 0 ? `$${log.amount} ${log.currency}` : '-'}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-600 truncate max-w-[200px]" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* EDIT USER DETAILS MODAL (ইউজার এর ডিটেইলস ইডিট) */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl relative space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#0088ff]" /> Edit User Details
                </h4>
                <p className="text-xs text-slate-600 font-mono font-bold break-all mt-0.5 select-all">
                  User ID: {getUserId(editingUser)} | Address: {editingUser.walletAddress}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Occupied USDT (Compounding in node)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editOccupiedUSDT}
                  onChange={(e) => setEditOccupiedUSDT(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-[#0088ff]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Available USDT (Withdrawal Balance)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editUsdtBalance}
                  onChange={(e) => setEditUsdtBalance(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-[#0088ff]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    USDC Balance
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editUsdcBalance}
                    onChange={(e) => setEditUsdcBalance(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0088ff]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    BTC Balance
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editBtcBalance}
                    onChange={(e) => setEditBtcBalance(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0088ff]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ETH Balance
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editEthBalance}
                    onChange={(e) => setEditEthBalance(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0088ff]"
                  />
                </div>
              </div>

              {/* Withdrawal Lock Controls */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5 cursor-pointer">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    Lock Withdrawal for this user
                  </label>
                  <input
                    type="checkbox"
                    checked={editIsWithdrawLocked}
                    onChange={(e) => setEditIsWithdrawLocked(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                  />
                </div>

                {editIsWithdrawLocked && (
                  <div>
                    <label className="text-[11px] font-bold text-amber-800 block mb-1">
                      Withdrawal Lock Notice (Shown to user)
                    </label>
                    <input
                      type="text"
                      value={editWithdrawLockNotice}
                      onChange={(e) => setEditWithdrawLockNotice(e.target.value)}
                      placeholder="e.g. Account undergoing verification notice..."
                      className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-[#0088ff] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* PAYMENT SCREENSHOT PROOF MODAL */}
      {selectedProofModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-5 max-w-lg w-full border border-slate-200 shadow-2xl relative space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#0088ff]" /> Payment Screenshot Proof
              </h4>
              <button
                type="button"
                onClick={() => setSelectedProofModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
              <img src={selectedProofModal} alt="Deposit Proof" className="max-w-full h-auto object-contain rounded-lg" />
            </div>
            <button
              type="button"
              onClick={() => setSelectedProofModal(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
