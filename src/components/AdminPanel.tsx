import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
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
  ArrowUpCircle,
  Search,
  Lock,
  Unlock,
  LayoutDashboard,
  Wallet,
  Coins,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Gift,
  Headset,
  Send,
  Eye,
  EyeOff,
  UserPlus,
  UserCheck,
  User,
  Menu,
} from 'lucide-react';
import {
  AppConfig,
  TransactionLog,
  UserAccount,
  YieldTier,
  YIELD_TIERS,
  UserAirdropConfig,
  SubAdmin,
  SubAdminPermissions,
  DEFAULT_SUBADMIN_PERMISSIONS,
} from '../types';
import { sha256Hex } from '../lib/crypto';
import { calculateAccruedYield } from '../lib/yieldCalculator';
import {
  saveConfigToFirestore,
  fetchConfigFromFirestore,
  fetchUserFromFirestore,
  fetchUsersFromFirestore,
  subscribeUsersFromFirestore,
  updateUserBlockInFirestore,
  fetchLogsFromFirestore,
  subscribeLogsFromFirestore,
  updateLogStatusInFirestore,
  approveDepositInFirestore,
  updateUserDailyProfitInFirestore,
  saveUserToFirestore,
  fetchAllChatsFromFirestore,
  sendMessageToChatInFirestore,
  closeChatInFirestore,
  fetchSubAdminsFromFirestore,
  saveSubAdminToFirestore,
  deleteSubAdminFromFirestore,
  subscribeSubAdminsFromFirestore,
  SupportChatSession,
  ChatMessage,
} from '../lib/firebase';

const ALL_ADMIN_PERMISSIONS: SubAdminPermissions = {
  viewDashboard: true,
  manageUsersView: true,
  editUserBalances: true,
  manageDailyProfit: true,
  manageUserStatus: true,
  approveDeposits: true,
  approveWithdrawals: true,
  supportChat: true,
  manageAirdrops: true,
  manageSettings: true,
  viewBackupLogs: true,
};

const SUB_ADMIN_PERMISSION_META: Array<{ key: keyof SubAdminPermissions; label: string; desc: string }> = [
  { key: 'viewDashboard', label: 'Dashboard Overview', desc: 'View summary stats & quick actions' },
  { key: 'manageUsersView', label: 'View & Search Users', desc: 'Access User Management table and lookup' },
  { key: 'editUserBalances', label: 'Edit User Balances', desc: 'Edit USDT, ETH, Profit & 3rd-party Wallet balances' },
  { key: 'manageDailyProfit', label: 'Daily Profit Controls', desc: 'Turn ON/OFF and set user daily profit ($/day)' },
  { key: 'manageUserStatus', label: 'Lock / Block Users', desc: 'Lock withdrawals & block/unblock users' },
  { key: 'approveDeposits', label: 'Approve / Reject Deposits', desc: 'Handle pending deposit verification requests' },
  { key: 'approveWithdrawals', label: 'Approve / Reject Withdrawals', desc: 'Handle pending cashout requests' },
  { key: 'supportChat', label: 'Support Chat', desc: 'View, reply, and close customer support chats' },
  { key: 'manageAirdrops', label: 'Per-User Airdrops', desc: 'Assign, edit, and delete user/global airdrops' },
  { key: 'manageSettings', label: 'System Settings & Profit Chart', desc: 'Edit forwarding/limits & Profit Chart Hide/Show' },
  { key: 'viewBackupLogs', label: 'Backup & Activity Logs', desc: 'View logs and export/restore database JSON' },
];

const DEFAULT_ADMIN_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
const DEFAULT_ADMIN123_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

type AdminTab = 'dashboard' | 'users' | 'deposits' | 'withdrawals' | 'airdrops' | 'support' | 'settings' | 'subadmins' | 'backup';

const TAB_TITLES: Record<AdminTab, string> = {
  dashboard: 'Dashboard Overview',
  users: 'User Management',
  deposits: 'Deposit Requests',
  withdrawals: 'Withdraw Requests',
  support: 'Support Chat',
  airdrops: 'Per-User Airdrops',
  settings: 'System Settings',
  subadmins: 'Sub-Admins',
  backup: 'Backup & Logs',
};

interface AdminPanelProps {
  onBack?: () => void;
  onConfigUpdated?: () => void;
}

export default function AdminPanel({ onConfigUpdated }: AdminPanelProps) {
  const [loginUsername, setLoginUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminRole, setAdminRole] = useState<'main' | 'sub'>('main');
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const [loggedInSubAdminId, setLoggedInSubAdminId] = useState<string | null>(null);
  const [activePermissions, setActivePermissions] = useState<SubAdminPermissions>(ALL_ADMIN_PERMISSIONS);
  const [mainAdminUsername, setMainAdminUsername] = useState('admin');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  const hasPerm = (perm: keyof SubAdminPermissions): boolean => {
    if (adminRole === 'main') return true;
    return !!activePermissions[perm];
  };

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
  const [baseYieldRatePercent, setBaseYieldRatePercent] = useState<number>(2);
  const [showProfitChart, setShowProfitChart] = useState<boolean>(true);

  const [totalUsers, setTotalUsers] = useState(0);
  const [totals, setTotals] = useState({ usdt: 0 });
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [logs, setLogs] = useState<TransactionLog[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'blocked' | 'locked' | 'daily'>('all');
  const [requestSearchQuery, setRequestSearchQuery] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const [isSearchingFirestore, setIsSearchingFirestore] = useState(false);

  // User Edit Modal States
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUsdtBalance, setEditUsdtBalance] = useState('');
  const [editOccupiedUSDT, setEditOccupiedUSDT] = useState('');
  const [editUsdcBalance, setEditUsdcBalance] = useState('');
  const [editBtcBalance, setEditBtcBalance] = useState('');
  const [editEthBalance, setEditEthBalance] = useState('');
  const [editIsWithdrawLocked, setEditIsWithdrawLocked] = useState(false);
  const [editWithdrawLockNotice, setEditWithdrawLockNotice] = useState('');
  const [editDailyProfitEnabled, setEditDailyProfitEnabled] = useState(false);
  const [editDailyProfitAmount, setEditDailyProfitAmount] = useState('0');
  const [editTotalYieldEarned, setEditTotalYieldEarned] = useState('0');
  const [editThirdPartyEnabled, setEditThirdPartyEnabled] = useState(false);
  const [editThirdPartyBalance, setEditThirdPartyBalance] = useState('0');

  // Quick Balance Modal State
  const [quickBalanceModalUser, setQuickBalanceModalUser] = useState<UserAccount | null>(null);
  const [quickUsdtVal, setQuickUsdtVal] = useState('');
  const [quickOccupiedVal, setQuickOccupiedVal] = useState('');
  const [quickEthVal, setQuickEthVal] = useState('');
  const [quickProfitVal, setQuickProfitVal] = useState('');
  const [quickThirdPartyEnabled, setQuickThirdPartyEnabled] = useState(false);
  const [quickThirdPartyVal, setQuickThirdPartyVal] = useState('');

  // General Loading States
  const [loading, setLoading] = useState(false);
  const [approvingLogId, setApprovingLogId] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedProofModal, setSelectedProofModal] = useState<string | null>(null);

  // Admin Change Password States (Main Admin Only)
  const [newMainUsernameVal, setNewMainUsernameVal] = useState('admin');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [showNewMainPass, setShowNewMainPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Sub-Admin Management States (Main Admin Only)
  const [subAdminsList, setSubAdminsList] = useState<SubAdmin[]>([]);
  const [editingSubAdminId, setEditingSubAdminId] = useState<string | null>(null);
  const [subUsername, setSubUsername] = useState('');
  const [subPassword, setSubPassword] = useState('');
  const [showSubPass, setShowSubPass] = useState(false);
  const [subNote, setSubNote] = useState('');
  const [subActive, setSubActive] = useState(true);
  const [subPermissions, setSubPermissions] = useState<SubAdminPermissions>({ ...DEFAULT_SUBADMIN_PERMISSIONS });
  const [savingSubAdmin, setSavingSubAdmin] = useState(false);

  const pickFirstAllowedTab = (role: 'main' | 'sub', perms: SubAdminPermissions): AdminTab => {
    if (role === 'main') return 'dashboard';
    if (perms.viewDashboard) return 'dashboard';
    if (perms.manageUsersView) return 'users';
    if (perms.approveDeposits) return 'deposits';
    if (perms.approveWithdrawals) return 'withdrawals';
    if (perms.supportChat) return 'support';
    if (perms.manageAirdrops) return 'airdrops';
    if (perms.manageSettings) return 'settings';
    if (perms.viewBackupLogs) return 'backup';
    return 'dashboard';
  };

  // Authenticate Admin or Sub-Admin against Firestore
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const cleanUsername = loginUsername.trim().toLowerCase();
    if (!cleanUsername || !password) {
      setErrorMsg('Please enter both username and password.');
      setLoading(false);
      return;
    }

    try {
      const enteredHash = await sha256Hex(password);
      const fsConfig = await fetchConfigFromFirestore();
      const configuredMainUser = (fsConfig?.adminUsername || 'admin').trim().toLowerCase();
      setMainAdminUsername(fsConfig?.adminUsername || 'admin');
      setNewMainUsernameVal(fsConfig?.adminUsername || 'admin');

      if (cleanUsername === configuredMainUser) {
        const storedHash = fsConfig?.adminPasswordHash || DEFAULT_ADMIN123_HASH;
        const isCustomSet = fsConfig?.adminPasswordCustom === true;
        const isLegacyUntouched =
          !isCustomSet && (storedHash === DEFAULT_ADMIN_HASH || storedHash === DEFAULT_ADMIN123_HASH);

        const isMainPasswordValid = isCustomSet
          ? enteredHash === storedHash
          : isLegacyUntouched
          ? enteredHash === DEFAULT_ADMIN123_HASH || enteredHash === storedHash
          : enteredHash === storedHash;

        if (isMainPasswordValid) {
          setAdminRole('main');
          setLoggedInUsername(fsConfig?.adminUsername || 'admin');
          setLoggedInSubAdminId(null);
          setActivePermissions({ ...ALL_ADMIN_PERMISSIONS });
          setActiveTab('dashboard');
          setIsAuthorized(true);
          fetchAdminStats(password, true);
          setSuccessMsg('Signed in as Main Administrator.');
          setTimeout(() => setSuccessMsg(''), 4000);
          setLoading(false);
          return;
        } else {
          setErrorMsg('Incorrect username or password.');
          setLoading(false);
          return;
        }
      }

      // Check Sub-Admins in Firestore
      const subAdmins = await fetchSubAdminsFromFirestore();
      const matchedSub = subAdmins.find((s) => s.username.trim().toLowerCase() === cleanUsername);

      if (!matchedSub || enteredHash !== matchedSub.passwordHash) {
        setErrorMsg('Incorrect username or password.');
        setLoading(false);
        return;
      }

      if (!matchedSub.active) {
        setErrorMsg('This sub-admin account is currently disabled. Contact Main Admin.');
        setLoading(false);
        return;
      }

      const mergedPerms: SubAdminPermissions = {
        ...DEFAULT_SUBADMIN_PERMISSIONS,
        ...(matchedSub.permissions || {}),
      };
      setAdminRole('sub');
      setLoggedInUsername(matchedSub.username);
      setLoggedInSubAdminId(matchedSub.id);
      setActivePermissions(mergedPerms);
      setActiveTab(pickFirstAllowedTab('sub', mergedPerms));
      setIsAuthorized(true);
      fetchAdminStats(password, true);
      setSuccessMsg(`Signed in as Sub-Admin (${matchedSub.username}).`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Login verification failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setIsAuthorized(false);
    setAdminRole('main');
    setLoggedInUsername('');
    setLoggedInSubAdminId(null);
    setActivePermissions({ ...ALL_ADMIN_PERMISSIONS });
    setActiveTab('dashboard');
    setMobileMenuOpen(false);
    setSubAdminsList([]);
    setChatSessions([]);
    setSelectedChatId(null);
    setEditingUser(null);
    setQuickBalanceModalUser(null);
    setSelectedProofModal(null);
    setEditingSubAdminId(null);
    setPassword('');
    setLoginUsername('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Master persistent users dictionary
  const masterUsersMapRef = useRef<Record<string, UserAccount>>({});

  const loadLocalUsers = (): Record<string, UserAccount> => {
    const localUsersMap: Record<string, UserAccount> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('user_0x')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const u = JSON.parse(raw);
            if (u && (u.walletAddress || key)) {
              const addr = (u.walletAddress || key.replace('user_', '')).toLowerCase();
              localUsersMap[addr] = { ...u, walletAddress: addr };
            }
          }
        }
      }
      const conn = localStorage.getItem('connectedAddress');
      if (conn && conn !== 'null' && conn !== 'undefined') {
        const cAddr = conn.toLowerCase();
        if (!localUsersMap[cAddr]) {
          localUsersMap[cAddr] = {
            walletAddress: cAddr,
            usdtBalance: 0,
            occupiedUSDT: 0,
            totalYieldEarned: 0,
            lastYieldPayout: Date.now(),
            createdAt: Date.now(),
            isBlocked: false,
          };
        }
      }
    } catch (e) {
      console.warn('Failed scanning local storage users:', e);
    }
    return localUsersMap;
  };

  const getUserId = (user: UserAccount) => {
    if (user.customId) return user.customId;
    const clean = (user.walletAddress || '').toLowerCase().replace(/^0x/, '');
    const hash = parseInt(clean.slice(-8), 16);
    return (isNaN(hash) ? 10000000 : (hash % 89999999 + 10000000)).toString();
  };

  const refreshUsersListFromMaster = (additionalUsers?: Record<string, UserAccount>) => {
    const localUsers = loadLocalUsers();

    Object.entries(localUsers).forEach(([addr, u]) => {
      const cleanAddr = addr.toLowerCase();
      if (!masterUsersMapRef.current[cleanAddr]) {
        masterUsersMapRef.current[cleanAddr] = u;
      } else {
        masterUsersMapRef.current[cleanAddr] = {
          ...u,
          ...masterUsersMapRef.current[cleanAddr],
        };
      }
    });

    if (additionalUsers) {
      Object.entries(additionalUsers).forEach(([addr, u]) => {
        const cleanAddr = (u.walletAddress || addr).toLowerCase();
        const existing = masterUsersMapRef.current[cleanAddr];
        if (!existing) {
          masterUsersMapRef.current[cleanAddr] = { ...u, walletAddress: cleanAddr };
        } else {
          masterUsersMapRef.current[cleanAddr] = {
            ...existing,
            ...u,
            walletAddress: cleanAddr,
          };
        }
      });
    }

    const now = Date.now();
    const currentConfig: Partial<AppConfig> = {
      recipientAddress,
      minDepositUSDT,
      minWithdrawUSDT,
      minParticipateETH,
      depositMode,
      depositSystems,
      yieldTiers,
      baseYieldRate: baseYieldRatePercent / 100,
    };

    const calculatedList: UserAccount[] = (Object.values(masterUsersMapRef.current) as UserAccount[]).map((base) => {
      const { updatedUser } = calculateAccruedYield(base, currentConfig, now);
      return updatedUser;
    });

    let totalUSDT = 0;
    calculatedList.forEach((u) => {
      totalUSDT += u.occupiedUSDT || 0;
    });

    setUsersList(calculatedList);
    setTotalUsers(calculatedList.length);
    setTotals({ usdt: totalUSDT });
  };

  // Real-time Firestore subscriptions
  useEffect(() => {
    if (!isAuthorized) return;

    fetchAdminStats(password, true);

    const unsubscribeUsers = subscribeUsersFromFirestore((fsUsersMap) => {
      refreshUsersListFromMaster(fsUsersMap);
    });

    const unsubscribeLogs = subscribeLogsFromFirestore((fsLogs) => {
      if (fsLogs && fsLogs.length > 0) {
        setLogs(fsLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      }
    });

    const unsubscribeSubAdmins = subscribeSubAdminsFromFirestore((list) => {
      if (adminRole === 'main') {
        setSubAdminsList(list);
      } else if (adminRole === 'sub' && loggedInSubAdminId) {
        const self = list.find((s) => s.id === loggedInSubAdminId);
        if (!self || !self.active) {
          handleAdminLogout();
          setErrorMsg('Your sub-admin access has been disabled or removed by Main Admin.');
          return;
        }
        const nextPerms: SubAdminPermissions = {
          ...DEFAULT_SUBADMIN_PERMISSIONS,
          ...(self.permissions || {}),
        };
        setActivePermissions(nextPerms);
        setActiveTab((prevTab) => {
          if (prevTab === 'subadmins') return pickFirstAllowedTab('sub', nextPerms);
          if (prevTab === 'dashboard' && !nextPerms.viewDashboard) return pickFirstAllowedTab('sub', nextPerms);
          if (prevTab === 'users' && !nextPerms.manageUsersView) return pickFirstAllowedTab('sub', nextPerms);
          if (prevTab === 'deposits' && !nextPerms.approveDeposits) return pickFirstAllowedTab('sub', nextPerms);
          if (prevTab === 'withdrawals' && !nextPerms.approveWithdrawals) return pickFirstAllowedTab('sub', nextPerms);
          if (prevTab === 'support' && !nextPerms.supportChat) return pickFirstAllowedTab('sub', nextPerms);
          if (prevTab === 'airdrops' && !nextPerms.manageAirdrops) return pickFirstAllowedTab('sub', nextPerms);
          if (prevTab === 'settings' && !nextPerms.manageSettings) return pickFirstAllowedTab('sub', nextPerms);
          if (prevTab === 'backup' && !nextPerms.viewBackupLogs) return pickFirstAllowedTab('sub', nextPerms);
          return prevTab;
        });
      }
    });

    const interval = setInterval(() => {
      refreshUsersListFromMaster();
    }, 4000);

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
      unsubscribeSubAdmins();
      clearInterval(interval);
    };
  }, [isAuthorized, adminRole, loggedInSubAdminId]);

  const fetchAdminStats = async (_adminPass: string, isInitial: boolean = false) => {
    let loadedConfig: any = null;

    if (isInitial) {
      try {
        const fsConfig = await fetchConfigFromFirestore();
        if (fsConfig && fsConfig.recipientAddress) {
          loadedConfig = fsConfig;
        }
      } catch (err) {
        console.warn('Config fetch notice:', err);
      }

      if (loadedConfig) {
        if (loadedConfig.adminUsername) {
          setMainAdminUsername(loadedConfig.adminUsername);
          setNewMainUsernameVal(loadedConfig.adminUsername);
        }
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
        if (loadedConfig.showProfitChart !== undefined) {
          setShowProfitChart(loadedConfig.showProfitChart !== false);
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
      console.warn('fetchUsers notice:', err);
    }

    let fsLogs: TransactionLog[] = [];
    try {
      fsLogs = await fetchLogsFromFirestore();
    } catch (err) {
      console.warn('fetchLogs notice:', err);
    }

    refreshUsersListFromMaster(firestoreUsers);
    if (fsLogs && fsLogs.length > 0) {
      setLogs(fsLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    }
  };

  // Real-time Support Chat Polling
  useEffect(() => {
    if (!isAuthorized || !hasPerm('supportChat')) return;
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
  }, [isAuthorized, deletedChatIds, adminRole, activePermissions.supportChat]);

  const handleSendAgentReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('supportChat')) return;
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
    if (!hasPerm('supportChat')) return;
    if (!window.confirm('Are you sure you want to close and delete this support chat history?')) return;
    const cleanId = chatId.toLowerCase();

    setDeletedChatIds((prev) => new Set([...prev, cleanId]));
    setChatSessions((prev) => prev.filter((s) => s.chatId.toLowerCase() !== cleanId));
    if (selectedChatId?.toLowerCase() === cleanId) {
      setSelectedChatId(null);
    }
    setSuccessMsg('Support chat closed and deleted successfully.');
    setTimeout(() => setSuccessMsg(''), 3000);

    closeChatInFirestore(cleanId, true).catch((err) => console.warn('Error closing chat:', err));
  };

  const handleUpdateConfig = async (e?: React.FormEvent, customSystems?: any[]) => {
    if (e) e.preventDefault();
    if (!hasPerm('manageSettings')) return;
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
      showProfitChart,
    }).catch((err) => console.warn('saveConfig notice:', err));

    setLoading(false);
    if (onConfigUpdated) onConfigUpdated();
    setSuccessMsg('System configuration updated successfully.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleToggleProfitChart = async (nextVisible: boolean) => {
    if (!hasPerm('manageSettings')) return;
    setShowProfitChart(nextVisible);
    try {
      await saveConfigToFirestore({ showProfitChart: nextVisible });
      if (onConfigUpdated) onConfigUpdated();
      setSuccessMsg(
        `Profit Chart is now ${nextVisible ? 'visible' : 'hidden'} on the user homepage. Profit calculation remains active.`
      );
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.warn('Toggle profit chart notice:', err);
    }
  };

  // Main Admin Credentials Update (Stored in Firestore across all devices)
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminRole !== 'main') return;

    const cleanMainUser = newMainUsernameVal.trim().toLowerCase() || 'admin';
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(cleanMainUser)) {
      setErrorMsg('Main Admin username must be 3-32 characters (letters, numbers, ., _, -).');
      return;
    }
    if (!newPasswordVal.trim()) {
      setErrorMsg('New password cannot be empty.');
      return;
    }
    if (newPasswordVal.trim().length < 4) {
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
      const updatedPass = newPasswordVal.trim();
      const newHash = await sha256Hex(updatedPass);
      await saveConfigToFirestore({
        adminUsername: cleanMainUser,
        adminPasswordHash: newHash,
        adminPasswordCustom: true,
      });
      localStorage.removeItem('admin_custom_password');
      setMainAdminUsername(cleanMainUser);
      setLoggedInUsername(cleanMainUser);
      setPassword(updatedPass);
      setNewPasswordVal('');
      setConfirmPasswordVal('');
      if (onConfigUpdated) onConfigUpdated();
      setSuccessMsg('Main Admin password updated in database. All devices now require the new password.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg('Failed to save password to database: ' + (err?.message || 'Error'));
    } finally {
      setIsChangingPass(false);
    }
  };

  // Sub-Admin CRUD Handlers (Main Admin Only)
  const resetSubAdminForm = () => {
    setEditingSubAdminId(null);
    setSubUsername('');
    setSubPassword('');
    setSubNote('');
    setSubActive(true);
    setSubPermissions({ ...DEFAULT_SUBADMIN_PERMISSIONS });
  };

  const handleSaveSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminRole !== 'main') return;
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUser = subUsername.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(cleanUser)) {
      setErrorMsg('Sub-admin username must be 3-32 characters without spaces.');
      return;
    }
    if (cleanUser === mainAdminUsername.trim().toLowerCase()) {
      setErrorMsg('Sub-admin username cannot be the same as Main Admin username.');
      return;
    }
    const duplicate = subAdminsList.find(
      (s) => s.username.trim().toLowerCase() === cleanUser && s.id !== editingSubAdminId
    );
    if (duplicate) {
      setErrorMsg(`Username "${cleanUser}" is already used by another sub-admin.`);
      return;
    }

    const existingRecord = editingSubAdminId
      ? subAdminsList.find((s) => s.id === editingSubAdminId)
      : undefined;

    if (!existingRecord && subPassword.trim().length < 4) {
      setErrorMsg('Password must be at least 4 characters when adding a sub-admin.');
      return;
    }
    if (subPassword.trim() && subPassword.trim().length < 4) {
      setErrorMsg('New sub-admin password must be at least 4 characters.');
      return;
    }

    setSavingSubAdmin(true);
    try {
      const now = Date.now();
      const passwordHash = subPassword.trim()
        ? await sha256Hex(subPassword.trim())
        : existingRecord!.passwordHash;

      const record: SubAdmin = {
        id: existingRecord?.id || `sub_${cleanUser}_${now}`,
        username: cleanUser,
        passwordHash,
        note: subNote.trim(),
        active: subActive,
        permissions: { ...subPermissions },
        createdAt: existingRecord?.createdAt || now,
        updatedAt: now,
      };

      await saveSubAdminToFirestore(record);
      setSuccessMsg(
        existingRecord
          ? `Sub-Admin "${cleanUser}" updated successfully.`
          : `Sub-Admin "${cleanUser}" created successfully.`
      );
      resetSubAdminForm();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Failed to save sub-admin: ' + (err?.message || 'Error'));
    } finally {
      setSavingSubAdmin(false);
    }
  };

  const handleEditSubAdminClick = (sub: SubAdmin) => {
    if (adminRole !== 'main') return;
    setEditingSubAdminId(sub.id);
    setSubUsername(sub.username);
    setSubPassword('');
    setSubNote(sub.note || '');
    setSubActive(sub.active);
    setSubPermissions({ ...DEFAULT_SUBADMIN_PERMISSIONS, ...(sub.permissions || {}) });
  };

  const handleToggleSubAdminActive = async (sub: SubAdmin) => {
    if (adminRole !== 'main') return;
    try {
      await saveSubAdminToFirestore({
        ...sub,
        active: !sub.active,
        updatedAt: Date.now(),
      });
      setSuccessMsg(`Sub-Admin "${sub.username}" is now ${!sub.active ? 'active' : 'disabled'}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Failed to update sub-admin status.');
    }
  };

  const handleDeleteSubAdmin = async (sub: SubAdmin) => {
    if (adminRole !== 'main') return;
    if (!window.confirm(`Delete sub-admin "${sub.username}"? They will lose access immediately.`)) return;
    try {
      await deleteSubAdminFromFirestore(sub.id);
      if (editingSubAdminId === sub.id) resetSubAdminForm();
      setSuccessMsg(`Sub-Admin "${sub.username}" deleted.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Failed to delete sub-admin.');
    }
  };

  // Deposit Action
  const handleDepositAction = async (logId: string, action: 'approve' | 'reject') => {
    if (!hasPerm('approveDeposits')) return;
    setApprovingLogId(logId);
    setErrorMsg('');
    setSuccessMsg('');

    const targetLog = logs.find((l) => l.id === logId);
    if (!targetLog) {
      setApprovingLogId(null);
      return;
    }

    const addr = (targetLog.walletAddress || '').toLowerCase();
    const amount = Number(targetLog.amount) || 0;
    const currency = (targetLog.currency || 'USDT').toUpperCase();

    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, status: action === 'approve' ? 'success' : 'failed' } : l))
    );

    if (action === 'approve') {
      try {
        const res = await approveDepositInFirestore(logId);
        if (res.success && res.updatedUser) {
          masterUsersMapRef.current[addr] = res.updatedUser;
          setUsersList((prev) =>
            prev.map((u) => (u.walletAddress.toLowerCase() === addr ? res.updatedUser! : u))
          );
          setSuccessMsg(`Deposit approved: $${amount} ${currency} credited to ${addr.slice(0, 8)}...`);
        } else {
          await updateLogStatusInFirestore(logId, 'success', `Approved by Admin. $${amount} ${currency} added.`);
          const refreshed = await fetchUserFromFirestore(addr);
          if (refreshed) {
            masterUsersMapRef.current[addr] = refreshed;
            setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? refreshed : u)));
          }
          setSuccessMsg(`Deposit approved: $${amount} ${currency} credited.`);
        }
      } catch (err: any) {
        console.warn('Approve error:', err);
        setErrorMsg('Error approving deposit: ' + (err?.message || 'Failed'));
      } finally {
        setApprovingLogId(null);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
      return;
    } else {
      try {
        await updateLogStatusInFirestore(logId, 'failed', 'Deposit request rejected by Admin.');
        setSuccessMsg('Deposit request rejected.');
      } catch {
        setErrorMsg('Error rejecting request.');
      } finally {
        setApprovingLogId(null);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    }
  };

  // Withdrawal Action
  const handleWithdrawalAction = async (logId: string, action: 'approve' | 'reject') => {
    if (!hasPerm('approveWithdrawals')) return;
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

    setLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, status: action === 'approve' ? 'success' : 'failed' } : l))
    );

    if (action === 'approve') {
      await updateLogStatusInFirestore(logId, 'success', `Withdrawal of ${amount} ${currency} approved by Admin.`);
      setSuccessMsg(`Withdrawal approved for ${addr.slice(0, 8)}...`);
    } else {
      await updateLogStatusInFirestore(
        logId,
        'failed',
        `Withdrawal request rejected by Admin. Refunded ${amount} ${currency}.`
      );
      const refreshedUser = await fetchUserFromFirestore(addr);
      if (refreshedUser) {
        localStorage.setItem(`user_${addr}`, JSON.stringify(refreshedUser));
        setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? refreshedUser : u)));
      }
      setSuccessMsg(`Withdrawal rejected and refunded to ${addr.slice(0, 8)}...`);
    }

    setLoading(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Open Edit Modal for a User
  const handleOpenEditUser = (user: UserAccount) => {
    if (!hasPerm('editUserBalances') && !hasPerm('manageDailyProfit') && !hasPerm('manageUserStatus')) return;
    setEditingUser(user);
    setEditUsdtBalance((user.usdtBalance || 0).toString());
    setEditOccupiedUSDT((user.occupiedUSDT || 0).toString());
    setEditUsdcBalance((user.usdcBalance || 0).toString());
    setEditBtcBalance((user.btcBalance || 0).toString());
    setEditEthBalance((user.ethBalance || 0).toString());
    setEditIsWithdrawLocked(!!user.isWithdrawLocked);
    setEditWithdrawLockNotice(user.withdrawLockNotice || 'Withdrawal Locked. Please contact support.');
    setEditDailyProfitEnabled(!!user.dailyProfitEnabled);
    setEditDailyProfitAmount((user.dailyProfitAmount ?? 0).toString());
    setEditTotalYieldEarned((user.totalYieldEarned ?? 0).toString());
    setEditThirdPartyEnabled(!!user.thirdPartyWithdrawEnabled);
    setEditThirdPartyBalance((user.thirdPartyBalance ?? 0).toString());
  };

  // Save User Details Edit
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const canBalances = hasPerm('editUserBalances');
    const canDaily = hasPerm('manageDailyProfit');
    const canStatus = hasPerm('manageUserStatus');
    if (!canBalances && !canDaily && !canStatus) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const addr = editingUser.walletAddress.toLowerCase();
    const now = Date.now();
    const dailyProfitEnabled = canDaily ? editDailyProfitEnabled : !!editingUser.dailyProfitEnabled;
    const dailyProfitAmount = canDaily
      ? Math.max(0, parseFloat(editDailyProfitAmount) || 0)
      : editingUser.dailyProfitAmount || 0;
    const tpEnabled = canBalances ? editThirdPartyEnabled : !!editingUser.thirdPartyWithdrawEnabled;
    const tpBalance = canBalances
      ? Math.max(0, parseFloat(editThirdPartyBalance) || 0)
      : editingUser.thirdPartyBalance || 0;

    const updatedUser: UserAccount = {
      ...editingUser,
      usdtBalance: canBalances ? parseFloat(editUsdtBalance) || 0 : editingUser.usdtBalance || 0,
      occupiedUSDT: canBalances ? parseFloat(editOccupiedUSDT) || 0 : editingUser.occupiedUSDT || 0,
      usdcBalance: canBalances ? parseFloat(editUsdcBalance) || 0 : editingUser.usdcBalance || 0,
      btcBalance: canBalances ? parseFloat(editBtcBalance) || 0 : editingUser.btcBalance || 0,
      ethBalance: canBalances ? parseFloat(editEthBalance) || 0 : editingUser.ethBalance || 0,
      totalYieldEarned: canBalances
        ? Math.max(0, parseFloat(editTotalYieldEarned) || 0)
        : editingUser.totalYieldEarned || 0,
      thirdPartyWithdrawEnabled: tpEnabled,
      thirdPartyBalance: tpBalance,
      dailyProfitEnabled,
      dailyProfitAmount,
      isWithdrawLocked: canStatus
        ? tpEnabled
          ? false
          : editIsWithdrawLocked
        : tpEnabled && canBalances
        ? false
        : !!editingUser.isWithdrawLocked,
      withdrawLockNotice: canStatus ? editWithdrawLockNotice : editingUser.withdrawLockNotice,
      lastYieldPayout: now,
      updatedAt: now,
    };

    masterUsersMapRef.current[addr] = updatedUser;
    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));

    try {
      await saveUserToFirestore(updatedUser);
    } catch (err) {
      console.warn('Firestore user edit error:', err);
    }

    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    setSuccessMsg(`Account ${addr.slice(0, 8)}... updated successfully.`);
    setEditingUser(null);
    setLoading(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Quick Balance Modal Handlers
  const handleOpenQuickBalance = (user: UserAccount) => {
    if (!hasPerm('editUserBalances')) return;
    setQuickBalanceModalUser(user);
    setQuickUsdtVal((user.usdtBalance || 0).toString());
    setQuickOccupiedVal((user.occupiedUSDT || 0).toString());
    setQuickEthVal((user.ethBalance || 0).toString());
    setQuickProfitVal((user.totalYieldEarned || 0).toString());
    setQuickThirdPartyEnabled(!!user.thirdPartyWithdrawEnabled);
    setQuickThirdPartyVal((user.thirdPartyBalance || 0).toString());
  };

  const handleSaveQuickBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('editUserBalances') || !quickBalanceModalUser) return;
    const addr = quickBalanceModalUser.walletAddress.toLowerCase();
    const newUsdt = parseFloat(quickUsdtVal) || 0;
    const newOccupied = parseFloat(quickOccupiedVal) || 0;
    const newEth = parseFloat(quickEthVal) || 0;
    const newProfit = Math.max(0, parseFloat(quickProfitVal) || 0);
    const newTpVal = Math.max(0, parseFloat(quickThirdPartyVal) || 0);

    const updatedUser: UserAccount = {
      ...quickBalanceModalUser,
      usdtBalance: newUsdt,
      occupiedUSDT: newOccupied,
      ethBalance: newEth,
      totalYieldEarned: newProfit,
      thirdPartyWithdrawEnabled: quickThirdPartyEnabled,
      thirdPartyBalance: newTpVal,
      isWithdrawLocked: quickThirdPartyEnabled ? false : quickBalanceModalUser.isWithdrawLocked,
      updatedAt: Date.now(),
      lastYieldPayout: Date.now(),
    };

    masterUsersMapRef.current[addr] = updatedUser;
    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
    await saveUserToFirestore(updatedUser);

    setSuccessMsg(
      `Balance updated for ${addr.slice(0, 8)}...: Assets $${newUsdt.toFixed(2)}, Profit $${newProfit.toFixed(2)}${
        quickThirdPartyEnabled ? `, 3P Wallet $${newTpVal.toFixed(2)}` : ''
      }.`
    );
    setQuickBalanceModalUser(null);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Toggle User Daily Profit
  const handleToggleDailyProfitUser = async (user: UserAccount) => {
    if (!hasPerm('manageDailyProfit')) return;
    const addr = user.walletAddress.toLowerCase();
    const newEnabled = !user.dailyProfitEnabled;
    let newAmount = user.dailyProfitAmount || 10;
    if (newEnabled && (!user.dailyProfitAmount || user.dailyProfitAmount <= 0)) {
      const inputVal = prompt(`Enter Daily Profit in USD for ${addr.slice(0, 8)}... (e.g. 10, 25, 50, 100):`, '10');
      if (inputVal !== null) {
        const parsed = parseFloat(inputVal);
        if (!isNaN(parsed) && parsed > 0) {
          newAmount = parsed;
        }
      }
    }

    const updatedUser: UserAccount = {
      ...user,
      dailyProfitEnabled: newEnabled,
      dailyProfitAmount: newAmount,
      updatedAt: Date.now(),
      lastYieldPayout: Date.now(),
    };

    masterUsersMapRef.current[addr] = updatedUser;
    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
    updateUserDailyProfitInFirestore(addr, newEnabled, newAmount).catch(console.warn);

    setSuccessMsg(`Daily profit for ${addr.slice(0, 8)}... is now ${newEnabled ? `ON ($${newAmount}/day)` : 'OFF'}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Set User Daily Profit Amount
  const handleSetDailyProfitAmount = async (user: UserAccount) => {
    if (!hasPerm('manageDailyProfit')) return;
    const addr = user.walletAddress.toLowerCase();
    const currentAmount = user.dailyProfitAmount || 10;
    const inputVal = prompt(
      `Set Daily Profit in USD for ${addr.slice(0, 8)}... (current: $${currentAmount}/day):`,
      currentAmount.toString()
    );
    if (inputVal === null) return;
    const parsed = parseFloat(inputVal);
    if (isNaN(parsed) || parsed < 0) {
      setErrorMsg('Please enter a valid dollar amount.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const updatedUser: UserAccount = {
      ...user,
      dailyProfitEnabled: true,
      dailyProfitAmount: parsed,
      updatedAt: Date.now(),
      lastYieldPayout: Date.now(),
    };

    masterUsersMapRef.current[addr] = updatedUser;
    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
    updateUserDailyProfitInFirestore(addr, true, parsed).catch(console.warn);

    setSuccessMsg(`Daily profit for ${addr.slice(0, 8)}... set to $${parsed}/day.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Direct Address Lookup
  const handleDirectAddressLookup = async () => {
    const q = searchQuery.trim().toLowerCase().replace(/^["']|["']$/g, '');
    if (!q) return;
    setIsSearchingFirestore(true);
    try {
      const u = await fetchUserFromFirestore(q);
      if (u) {
        masterUsersMapRef.current[q] = u;
        setUsersList((prev) => {
          const exists = prev.some((x) => x.walletAddress.toLowerCase() === q);
          if (exists) return prev.map((x) => (x.walletAddress.toLowerCase() === q ? u : x));
          return [u, ...prev];
        });
        setSuccessMsg(`Found user account in database: ${q}`);
      } else {
        setErrorMsg(`No account found in database for: ${q}`);
      }
    } catch {
      setErrorMsg(`Lookup error for ${q}`);
    } finally {
      setIsSearchingFirestore(false);
      setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
      }, 4000);
    }
  };

  // Toggle User Withdrawal Lock
  const handleToggleWithdrawLockUser = async (user: UserAccount) => {
    if (!hasPerm('manageUserStatus')) return;
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
    saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore lock error:', err));

    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    setSuccessMsg(`User ${getUserId(user)} (${addr.slice(0, 8)}...) withdrawal ${newLockStatus ? 'locked' : 'unlocked'}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Toggle User Block Status
  const handleToggleBlockUser = async (user: UserAccount) => {
    if (!hasPerm('manageUserStatus')) return;
    const addr = user.walletAddress.toLowerCase();
    const newBlockStatus = !user.isBlocked;

    const updatedUser: UserAccount = {
      ...user,
      isBlocked: newBlockStatus,
      updatedAt: Date.now(),
    };

    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
    updateUserBlockInFirestore(addr, newBlockStatus).catch((err) => console.warn('Firestore block error:', err));
    saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore save user error:', err));

    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    setSuccessMsg(`User ${getUserId(user)} (${addr.slice(0, 8)}...) is now ${newBlockStatus ? 'blocked' : 'active'}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Save Airdrop
  const handleSaveAirdrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('manageAirdrops')) return;
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
      await saveConfigToFirestore({
        airdropStandardUSDT: Number(airdropStandardUSDT) || 5000,
        airdropOutputETH: Number(airdropOutputETH) || 10,
        airdropCountdownDays: Number(airdropDurationDays) || 7,
        userAirdrops: [newConfig],
      }).catch((err) => console.warn('Firestore save config airdrop error:', err));

      const updatedList = await Promise.all(
        usersList.map(async (u) => {
          const userAddr = u.walletAddress.toLowerCase();
          const updatedUser: UserAccount = { ...u, airdropConfig: newConfig, updatedAt: Date.now() };
          localStorage.setItem(`user_${userAddr}`, JSON.stringify(updatedUser));
          saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore save user airdrop error:', err));
          return updatedUser;
        })
      );

      setUsersList(updatedList);
      setSuccessMsg('Global airdrop configured and applied to all users.');
    } else {
      const targetUser = usersList.find((u) => u.walletAddress.toLowerCase() === addr);
      let updatedUser: UserAccount;
      if (targetUser) {
        updatedUser = { ...targetUser, airdropConfig: newConfig, updatedAt: Date.now() };
        localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
        await saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore save user airdrop error:', err));
        setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
      } else {
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
      setSuccessMsg(`Airdrop configured for ${addr.slice(0, 10)}...`);
    }

    setLoading(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Delete Airdrop
  const handleDeleteAirdrop = async (targetAddr: string) => {
    if (!hasPerm('manageAirdrops') || !targetAddr) return;
    if (!window.confirm(`Delete the airdrop for target ${targetAddr}?`)) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const addr = targetAddr.toLowerCase();
    const isGlobal = addr === 'all' || targetAddr.toUpperCase() === 'ALL';

    if (isGlobal) {
      setGlobalAirdrop(null);
      await saveConfigToFirestore({ userAirdrops: [] }).catch((err) =>
        console.warn('Firestore delete global airdrop error:', err)
      );

      const updatedList = await Promise.all(
        usersList.map(async (u) => {
          const userAddr = u.walletAddress.toLowerCase();
          const updatedUser: UserAccount = { ...u, airdropConfig: undefined, updatedAt: Date.now() };
          localStorage.setItem(`user_${userAddr}`, JSON.stringify(updatedUser));
          saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore delete user airdrop error:', err));
          return updatedUser;
        })
      );

      setUsersList(updatedList);
      setSuccessMsg('Global airdrop removed from all users.');
      if (airdropTargetAddress.toUpperCase() === 'ALL') {
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

    const updatedUser: UserAccount = { ...baseUser, airdropConfig: undefined, updatedAt: Date.now() };
    localStorage.setItem(`user_${addr}`, JSON.stringify(updatedUser));
    await saveUserToFirestore(updatedUser).catch((err) => console.warn('Firestore delete user airdrop error:', err));

    setUsersList((prev) => prev.map((u) => (u.walletAddress.toLowerCase() === addr ? updatedUser : u)));
    if (airdropTargetAddress.toLowerCase() === addr) {
      setAirdropTargetAddress('');
    }
    setSuccessMsg(`Airdrop deleted for ${addr.slice(0, 10)}...`);
    setLoading(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Filtered Users
  const cleanSearch = searchQuery.trim().toLowerCase().replace(/^["']|["']$/g, '');
  const filteredUsers = usersList.filter((u) => {
    if (userFilter === 'active' && u.isBlocked) return false;
    if (userFilter === 'blocked' && !u.isBlocked) return false;
    if (userFilter === 'locked' && !u.isWithdrawLocked) return false;
    if (userFilter === 'daily' && !u.dailyProfitEnabled) return false;

    if (!cleanSearch) return true;
    const userId = getUserId(u);
    const wallet = (u.walletAddress || '').toLowerCase();
    const refCode = (u.referralCode || '').toLowerCase();
    return (
      userId.includes(cleanSearch) ||
      wallet.includes(cleanSearch) ||
      cleanSearch.includes(wallet) ||
      refCode.includes(cleanSearch)
    );
  });

  // Export Backup
  const handleExportBackup = async () => {
    if (!hasPerm('viewBackupLogs')) return;
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
    a.download = 'db.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccessMsg('Backup JSON downloaded.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Restore Backup
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasPerm('viewBackupLogs')) return;
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
        setSuccessMsg('Database restored successfully.');
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

  // ---------------------------------------------------------------------------
  // PREMIUM CLEAN ADMIN LOGIN VIEW
  // ---------------------------------------------------------------------------
  if (!isAuthorized) {
    return (
      <div className="font-admin min-h-screen bg-[#F8FAFC] text-slate-900 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-9 shadow-sm"
        >
          <div className="flex items-center gap-3 pb-6 mb-6 border-b border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Treasury Console</div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Admin Portal
              </h1>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full h-11 pl-10 pr-11 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-400 text-white text-sm font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // AUTHENTICATED ENTERPRISE ADMIN WORKSPACE
  // ---------------------------------------------------------------------------
  const pendingDepositsCount = logs.filter((l) => l.type === 'deposit' && l.status === 'pending').length;
  const pendingWithdrawalsCount = logs.filter((l) => l.type === 'withdraw' && l.status === 'pending').length;
  const totalPending = pendingDepositsCount + pendingWithdrawalsCount;

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    ...(hasPerm('viewDashboard') ? [{ id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(hasPerm('manageUsersView')
      ? [{ id: 'users' as const, label: 'User Management', icon: Users, count: usersList.length }]
      : []),
    ...(hasPerm('approveDeposits')
      ? [
          {
            id: 'deposits' as const,
            label: 'Deposit Requests',
            icon: ArrowDownCircle,
            count: pendingDepositsCount > 0 ? pendingDepositsCount : undefined,
          },
        ]
      : []),
    ...(hasPerm('approveWithdrawals')
      ? [
          {
            id: 'withdrawals' as const,
            label: 'Withdraw Requests',
            icon: ArrowUpCircle,
            count: pendingWithdrawalsCount > 0 ? pendingWithdrawalsCount : undefined,
          },
        ]
      : []),
    ...(hasPerm('supportChat')
      ? [
          {
            id: 'support' as const,
            label: 'Support Chat',
            icon: Headset,
            count: chatSessions.length > 0 ? chatSessions.length : undefined,
          },
        ]
      : []),
    ...(hasPerm('manageAirdrops') ? [{ id: 'airdrops' as const, label: 'Per-User Airdrops', icon: Gift }] : []),
    ...(hasPerm('manageSettings') || adminRole === 'main'
      ? [{ id: 'settings' as const, label: 'System Settings', icon: Settings }]
      : []),
    ...(adminRole === 'main'
      ? [{ id: 'subadmins' as const, label: 'Sub-Admins', icon: UserPlus, count: subAdminsList.length }]
      : []),
    ...(hasPerm('viewBackupLogs') ? [{ id: 'backup' as const, label: 'Backup & Logs', icon: Database }] : []),
  ];

  const uniqueLogTypes = Array.from(new Set(logs.map((l) => l.type))).filter(Boolean);
  const filteredActivityLogs =
    logTypeFilter === 'all' ? logs : logs.filter((l) => l.type === logTypeFilter);

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-300">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight whitespace-nowrap truncate">
            Treasury Console
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full h-10 px-3 rounded-lg text-[13px] font-semibold transition flex items-center justify-between gap-2 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span
                  className={`font-admin-mono text-[11px] font-semibold shrink-0 ${
                    (item.id === 'deposits' || item.id === 'withdrawals') && item.count > 0
                      ? 'text-amber-400'
                      : isActive
                      ? 'text-slate-200'
                      : 'text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold uppercase shrink-0">
            {loggedInUsername.slice(0, 2) || 'AD'}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{loggedInUsername}</div>
            <div className="text-[11px] text-slate-400 truncate">
              {adminRole === 'main' ? 'Main Administrator' : 'Sub-Administrator'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdminLogout}
          className="w-full h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="font-admin min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 left-0 z-30 border-r border-slate-800">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl">{SidebarContent}</aside>
        </div>
      )}

      {/* Workspace Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-10 h-10 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-400 font-medium hidden sm:inline">Administration</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-bold text-slate-900 truncate">{TAB_TITLES[activeTab]}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchAdminStats(password)}
              className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
              title="Refresh live data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
          {/* Action Feedback Notices */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg('')}
                className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="text-red-600 hover:text-red-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && hasPerm('viewDashboard') && (
            <div className="space-y-6">
              {/* Unified 4-Column KPI Strip (Single Elevation, Hairline Dividers) */}
              <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Registered Users</span>
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="font-admin-mono text-2xl font-bold text-slate-900">{totalUsers}</div>
                  <div className="text-xs text-slate-500">Connected wallet accounts</div>
                </div>

                <div className="p-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Total Occupied Assets</span>
                    <Coins className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="font-admin-mono text-2xl font-bold text-emerald-700">
                    ${(totals.usdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500">Active USDT compounding in nodes</div>
                </div>

                <div className="p-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Pending Approvals</span>
                    <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="font-admin-mono text-2xl font-bold text-amber-700">{totalPending}</div>
                  <div className="text-xs text-slate-500">
                    {pendingDepositsCount} deposits · {pendingWithdrawalsCount} cashouts
                  </div>
                </div>

                <div className="p-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Forwarding Wallet</span>
                    <Wallet className="w-4 h-4 text-blue-600" />
                  </div>
                  <div
                    className="font-admin-mono text-sm font-bold text-slate-900 truncate pt-1"
                    title={recipientAddress}
                  >
                    {recipientAddress
                      ? `${recipientAddress.slice(0, 10)}...${recipientAddress.slice(-6)}`
                      : 'Not configured'}
                  </div>
                  <div className="text-xs text-slate-500">Primary settlement destination</div>
                </div>
              </div>

              {/* 2-Column Operational Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {hasPerm('manageUsersView') && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
                    <div className="space-y-1.5">
                      <h2 className="text-base font-bold text-slate-900">Quick User Lookup</h2>
                      <p className="text-xs text-slate-500">
                        Jump straight to any account by User ID or 0x wallet address to inspect balances, daily profit, or lock status.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setActiveTab('users');
                          }}
                          placeholder="Search by User ID or 0x wallet address..."
                          className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('users')}
                        className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <span>Open User Management</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {(hasPerm('approveDeposits') || hasPerm('approveWithdrawals')) && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
                    <div className="space-y-3">
                      <h2 className="text-base font-bold text-slate-900">Pending Settlement Queue</h2>
                      <div className="divide-y divide-slate-200/80 border-t border-b border-slate-200/80 text-xs">
                        {hasPerm('approveDeposits') && (
                          <div className="py-3 flex items-center justify-between">
                            <span className="text-slate-600 font-medium">Deposit Verification Requests</span>
                            <span className="font-admin-mono font-bold text-emerald-700">{pendingDepositsCount}</span>
                          </div>
                        )}
                        {hasPerm('approveWithdrawals') && (
                          <div className="py-3 flex items-center justify-between">
                            <span className="text-slate-600 font-medium">Withdrawal Cashout Requests</span>
                            <span className="font-admin-mono font-bold text-amber-700">{pendingWithdrawalsCount}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {hasPerm('approveDeposits') && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('deposits')}
                          className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3"
                        >
                          <ArrowDownCircle className="w-4 h-4 shrink-0" />
                          <span>Deposits ({pendingDepositsCount})</span>
                        </button>
                      )}
                      {hasPerm('approveWithdrawals') && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('withdrawals')}
                          className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3"
                        >
                          <ArrowUpCircle className="w-4 h-4 shrink-0" />
                          <span>Withdrawals ({pendingWithdrawalsCount})</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Homepage Profit Chart Visibility Control */}
              {hasPerm('manageSettings') && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-sm font-bold text-slate-900">Homepage Profit Chart (Tier Yield Rate)</h2>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          showProfitChart
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {showProfitChart ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {showProfitChart ? 'Shown' : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Control whether the Tier Yield Rate chart appears on the user homepage. Profit calculations always continue normally.
                    </p>
                  </div>

                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleToggleProfitChart(true)}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                        showProfitChart ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Show</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleProfitChart(false)}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                        !showProfitChart ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && hasPerm('manageUsersView') && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">User Accounts</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {filteredUsers.length} of {usersList.length} accounts shown
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Filter Segmented Control */}
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
                    {(
                      [
                        { key: 'all', label: 'All' },
                        { key: 'active', label: 'Active' },
                        { key: 'blocked', label: 'Blocked' },
                        { key: 'locked', label: 'Locked' },
                        { key: 'daily', label: 'Daily $' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setUserFilter(f.key)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                          userFilter === f.key
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search User ID or 0x address..."
                      className="w-full h-9 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                {filteredUsers.length === 0 ? (
                  <div className="py-14 px-6 text-center space-y-3">
                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-semibold">
                      No matching users found{searchQuery ? ` for "${searchQuery}"` : ''}.
                    </p>
                    {cleanSearch && (
                      <button
                        type="button"
                        onClick={handleDirectAddressLookup}
                        disabled={isSearchingFirestore}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isSearchingFirestore ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        <span>Lookup Directly in Database</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Mobile Card Layout */}
                    <div className="md:hidden divide-y divide-slate-200/80">
                      {filteredUsers.map((u, i) => {
                        const userId = getUserId(u);
                        return (
                          <div key={u.walletAddress || i} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-admin-mono text-xs font-bold text-slate-900">
                                  ID: {userId}
                                </div>
                                <div className="font-admin-mono text-[11px] text-slate-600 break-all select-all mt-0.5">
                                  {u.walletAddress}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                {u.isBlocked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                    Blocked
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Active
                                  </span>
                                )}
                                {u.isWithdrawLocked && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    Locked
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs font-admin-mono bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                              <div>
                                <div className="text-[10px] font-admin text-slate-500">Available</div>
                                <div className="font-bold text-slate-900">${(u.usdtBalance || 0).toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] font-admin text-slate-500">Occupied</div>
                                <div className="font-bold text-emerald-700">
                                  ${(u.occupiedUSDT || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-admin text-slate-500">Total Profit</div>
                                <div className="font-semibold text-emerald-700">
                                  ${(u.totalYieldEarned || 0).toFixed(4)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-admin text-slate-500">Daily Profit</div>
                                <div className="font-semibold text-slate-800">
                                  {u.dailyProfitEnabled ? `$${u.dailyProfitAmount || 0}/day` : 'Rate %'}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {hasPerm('editUserBalances') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickBalance(u)}
                                  className="h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-lg inline-flex items-center gap-1 border border-emerald-200 cursor-pointer"
                                >
                                  <Coins className="w-3.5 h-3.5" /> Balance
                                </button>
                              )}
                              {(hasPerm('editUserBalances') ||
                                hasPerm('manageDailyProfit') ||
                                hasPerm('manageUserStatus')) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(u)}
                                  className="h-9 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg inline-flex items-center gap-1 border border-blue-200 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Details
                                </button>
                              )}
                              {hasPerm('manageDailyProfit') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDailyProfitUser(u)}
                                    className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 cursor-pointer"
                                  >
                                    {u.dailyProfitEnabled ? 'Daily OFF' : 'Daily ON'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetDailyProfitAmount(u)}
                                    className="h-9 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 cursor-pointer"
                                  >
                                    Set $
                                  </button>
                                </>
                              )}
                              {hasPerm('manageUserStatus') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleWithdrawLockUser(u)}
                                    className="h-9 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs rounded-lg border border-amber-200 cursor-pointer"
                                  >
                                    {u.isWithdrawLocked ? 'Unlock' : 'Lock'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBlockUser(u)}
                                    className={`h-9 px-3 font-semibold text-xs rounded-lg border cursor-pointer ${
                                      u.isBlocked
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                    }`}
                                  >
                                    {u.isBlocked ? 'Unblock' : 'Block'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                            <th className="py-3 px-4">User ID</th>
                            <th className="py-3 px-4">Wallet Address</th>
                            <th className="py-3 px-4 text-right">Available · Profit</th>
                            <th className="py-3 px-4 text-right">Occupied USDT</th>
                            <th className="py-3 px-4 text-center">Daily Profit</th>
                            <th className="py-3 px-4 text-center">Account</th>
                            <th className="py-3 px-4 text-center">Cashout</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70">
                          {filteredUsers.map((u, i) => {
                            const userId = getUserId(u);
                            return (
                              <tr key={u.walletAddress || i} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-admin-mono font-semibold text-slate-900 whitespace-nowrap">
                                  {userId}
                                </td>
                                <td
                                  className="py-3 px-4 font-admin-mono text-slate-700 text-[11px] max-w-[210px] truncate select-all"
                                  title={u.walletAddress}
                                >
                                  {u.walletAddress}
                                </td>
                                <td className="py-3 px-4 text-right font-admin-mono whitespace-nowrap">
                                  <div className="font-bold text-slate-900">
                                    ${(u.usdtBalance || 0).toFixed(2)} USDT
                                  </div>
                                  <div className="text-[11px] text-emerald-700 font-medium">
                                    Profit ${(u.totalYieldEarned || 0).toFixed(4)}
                                  </div>
                                  {u.thirdPartyWithdrawEnabled && (
                                    <div className="text-[11px] text-blue-700 font-medium">
                                      3P ${(u.thirdPartyBalance || 0).toFixed(2)}
                                    </div>
                                  )}
                                  {(u.ethBalance || 0) > 0 && (
                                    <div className="text-[11px] text-slate-500">
                                      {(u.ethBalance || 0).toFixed(4)} ETH
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right font-admin-mono font-semibold text-emerald-700 whitespace-nowrap">
                                  ${(u.occupiedUSDT || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex flex-col items-center gap-1.5">
                                    {u.dailyProfitEnabled ? (
                                      <span className="font-admin-mono text-[11px] font-semibold text-emerald-700">
                                        ${u.dailyProfitAmount || 0} / day
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 font-medium">Rate %</span>
                                    )}
                                    {hasPerm('manageDailyProfit') && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleDailyProfitUser(u)}
                                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer whitespace-nowrap border ${
                                            u.dailyProfitEnabled
                                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                          }`}
                                        >
                                          {u.dailyProfitEnabled ? 'Turn OFF' : 'Turn ON'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSetDailyProfitAmount(u)}
                                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer whitespace-nowrap"
                                        >
                                          Set $
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                  {u.isBlocked ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                      <XCircle className="w-3 h-3" /> Blocked
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" /> Active
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                  {u.isWithdrawLocked ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                                      title={u.withdrawLockNotice || 'Locked'}
                                    >
                                      <Lock className="w-3 h-3" /> Locked
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-medium text-slate-600">Open</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    {hasPerm('editUserBalances') && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenQuickBalance(u)}
                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] rounded-md transition cursor-pointer inline-flex items-center gap-1 border border-emerald-200 whitespace-nowrap"
                                      >
                                        <Coins className="w-3 h-3" /> Balance
                                      </button>
                                    )}
                                    {(hasPerm('editUserBalances') ||
                                      hasPerm('manageDailyProfit') ||
                                      hasPerm('manageUserStatus')) && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditUser(u)}
                                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] rounded-md transition cursor-pointer inline-flex items-center gap-1 border border-blue-200 whitespace-nowrap"
                                      >
                                        <Edit3 className="w-3 h-3" /> Details
                                      </button>
                                    )}
                                    {hasPerm('manageUserStatus') && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleWithdrawLockUser(u)}
                                          className={`px-2.5 py-1.5 font-semibold text-[11px] rounded-md transition cursor-pointer inline-flex items-center gap-1 border whitespace-nowrap ${
                                            u.isWithdrawLocked
                                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                          }`}
                                        >
                                          {u.isWithdrawLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                          {u.isWithdrawLocked ? 'Unlock' : 'Lock'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleBlockUser(u)}
                                          className={`px-2.5 py-1.5 font-semibold text-[11px] rounded-md transition cursor-pointer inline-flex items-center gap-1 border whitespace-nowrap ${
                                            u.isBlocked
                                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                              : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                                          }`}
                                        >
                                          {u.isBlocked ? 'Unblock' : 'Block'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 3A: DEPOSIT REQUESTS (SEPARATE PAGE - MOBILE + DESKTOP FRIENDLY) */}
          {activeTab === 'deposits' && hasPerm('approveDeposits') && (() => {
            const pendingDeposits = logs.filter(
              (l) =>
                l.type === 'deposit' &&
                l.status === 'pending' &&
                (!requestSearchQuery.trim() ||
                  l.walletAddress.toLowerCase().includes(requestSearchQuery.trim().toLowerCase()))
            );
            return (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Pending Deposit Requests</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {pendingDepositsCount} awaiting verification
                    </p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={requestSearchQuery}
                      onChange={(e) => setRequestSearchQuery(e.target.value)}
                      placeholder="Filter by wallet address..."
                      className="w-full h-10 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                    {requestSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setRequestSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {pendingDeposits.length === 0 ? (
                  <div className="py-14 px-6 text-center space-y-2">
                    <ArrowDownCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-semibold">
                      No pending deposit requests{requestSearchQuery ? ` matching "${requestSearchQuery}"` : ''}.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-slate-200/80">
                      {pendingDeposits.map((depLog) => (
                        <div key={depLog.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-admin-mono text-base font-bold text-emerald-700">
                                ${depLog.amount} {depLog.currency || 'USDT'}
                              </div>
                              <div className="font-admin-mono text-[11px] text-slate-500 mt-0.5">
                                {new Date(depLog.timestamp).toLocaleString()}
                              </div>
                            </div>
                            {depLog.proofImage ? (
                              <button
                                type="button"
                                onClick={() => setSelectedProofModal(depLog.proofImage || null)}
                                className="h-9 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer border border-blue-200 shrink-0"
                              >
                                <Camera className="w-3.5 h-3.5" /> View Proof
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">No proof</span>
                            )}
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                            <div className="text-[10px] font-semibold text-slate-500 mb-0.5">User Wallet</div>
                            <div className="font-admin-mono text-[11px] font-semibold text-slate-900 break-all select-all">
                              {depLog.walletAddress}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={approvingLogId === depLog.id}
                              onClick={() => handleDepositAction(depLog.id, 'approve')}
                              className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-semibold text-xs transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                            >
                              {approvingLogId === depLog.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>{approvingLogId === depLog.id ? 'Crediting...' : 'Approve'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={approvingLogId === depLog.id}
                              onClick={() => handleDepositAction(depLog.id, 'reject')}
                              className="h-10 px-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-semibold text-xs transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                            <th className="py-3 px-4">Timestamp</th>
                            <th className="py-3 px-4">User Wallet</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                            <th className="py-3 px-4 text-center">Proof</th>
                            <th className="py-3 px-4 text-right">Decision</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70">
                          {pendingDeposits.map((depLog) => (
                            <tr key={depLog.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 font-admin-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {new Date(depLog.timestamp).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 font-admin-mono text-[11px] font-semibold text-slate-900 break-all select-all">
                                {depLog.walletAddress}
                              </td>
                              <td className="py-3 px-4 text-right font-admin-mono font-bold text-emerald-700 whitespace-nowrap">
                                ${depLog.amount} {depLog.currency || 'USDT'}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {depLog.proofImage ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedProofModal(depLog.proofImage || null)}
                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer border border-blue-200"
                                  >
                                    <Camera className="w-3.5 h-3.5" /> View Proof
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">No image</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={approvingLogId === depLog.id}
                                    onClick={() => handleDepositAction(depLog.id, 'approve')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-md font-semibold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                                  >
                                    {approvingLogId === depLog.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                    <span>{approvingLogId === depLog.id ? 'Crediting...' : 'Approve & Credit'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={approvingLogId === depLog.id}
                                    onClick={() => handleDepositAction(depLog.id, 'reject')}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-md font-semibold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
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
                  </>
                )}
              </div>
            );
          })()}

          {/* TAB 3B: WITHDRAW REQUESTS (SEPARATE PAGE - MOBILE + DESKTOP FRIENDLY) */}
          {activeTab === 'withdrawals' && hasPerm('approveWithdrawals') && (() => {
            const pendingWithdrawals = logs.filter(
              (l) =>
                l.type === 'withdraw' &&
                l.status === 'pending' &&
                (!requestSearchQuery.trim() ||
                  l.walletAddress.toLowerCase().includes(requestSearchQuery.trim().toLowerCase()))
            );
            return (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Pending Withdrawal Requests</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {pendingWithdrawalsCount} awaiting cashout review
                    </p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={requestSearchQuery}
                      onChange={(e) => setRequestSearchQuery(e.target.value)}
                      placeholder="Filter by wallet address..."
                      className="w-full h-10 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                    {requestSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setRequestSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {pendingWithdrawals.length === 0 ? (
                  <div className="py-14 px-6 text-center space-y-2">
                    <ArrowUpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-semibold">
                      No pending withdrawal requests{requestSearchQuery ? ` matching "${requestSearchQuery}"` : ''}.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-slate-200/80">
                      {pendingWithdrawals.map((reqLog) => (
                        <div key={reqLog.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-admin-mono text-base font-bold text-amber-700">
                                ${reqLog.amount} {reqLog.currency || 'USDT'}
                              </div>
                              <div className="font-admin-mono text-[11px] text-slate-500 mt-0.5">
                                {new Date(reqLog.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                            <div className="text-[10px] font-semibold text-slate-500 mb-0.5">User Wallet</div>
                            <div className="font-admin-mono text-[11px] font-semibold text-slate-900 break-all select-all">
                              {reqLog.walletAddress}
                            </div>
                            {reqLog.details && (
                              <div className="text-[11px] text-slate-600 mt-1 break-words">{reqLog.details}</div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleWithdrawalAction(reqLog.id, 'approve')}
                              className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWithdrawalAction(reqLog.id, 'reject')}
                              className="h-10 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject &amp; Refund</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                            <th className="py-3 px-4">Timestamp</th>
                            <th className="py-3 px-4">User Wallet</th>
                            <th className="py-3 px-4">Details</th>
                            <th className="py-3 px-4 text-right">Cashout Amount</th>
                            <th className="py-3 px-4 text-right">Decision</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70">
                          {pendingWithdrawals.map((reqLog) => (
                            <tr key={reqLog.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4 font-admin-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {new Date(reqLog.timestamp).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 font-admin-mono text-[11px] font-semibold text-slate-900 break-all select-all">
                                {reqLog.walletAddress}
                              </td>
                              <td className="py-3 px-4 text-slate-600 max-w-[240px] truncate" title={reqLog.details}>
                                {reqLog.details || '-'}
                              </td>
                              <td className="py-3 px-4 text-right font-admin-mono font-bold text-amber-700 whitespace-nowrap">
                                ${reqLog.amount} {reqLog.currency}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleWithdrawalAction(reqLog.id, 'approve')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleWithdrawalAction(reqLog.id, 'reject')}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <X className="w-3.5 h-3.5" /> Reject &amp; Refund
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* TAB 4: SUPPORT CHAT */}
          {activeTab === 'support' && hasPerm('supportChat') && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
              <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col bg-slate-50/40">
                <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Conversations</span>
                  <span className="font-admin-mono text-xs text-slate-500">{chatSessions.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70">
                  {chatSessions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">No active support conversations.</div>
                  ) : (
                    chatSessions.map((session) => {
                      const isSelected = selectedChatId === session.chatId;
                      const lastMsg = session.messages?.[session.messages.length - 1];
                      const userForSession = usersList.find(
                        (u) => u.walletAddress.toLowerCase() === (session.walletAddress || session.chatId).toLowerCase()
                      );
                      const userId = userForSession ? getUserId(userForSession) : 'Guest';
                      return (
                        <button
                          key={session.chatId}
                          type="button"
                          onClick={() => setSelectedChatId(session.chatId)}
                          className={`w-full text-left p-3.5 transition cursor-pointer flex items-start gap-3 ${
                            isSelected ? 'bg-blue-50/80 text-blue-950' : 'hover:bg-slate-100/70 text-slate-800'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {userId !== 'Guest' ? 'U' : 'G'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs truncate">
                                ID: {userId} ({session.chatId.slice(0, 6)}...)
                              </span>
                              <span className="font-admin-mono text-[10px] text-slate-400 shrink-0">
                                {new Date(session.updatedAt || Date.now()).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
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

              <div className="flex-1 flex flex-col bg-white">
                {selectedChatId ? (
                  (() => {
                    const currentSession = chatSessions.find((s) => s.chatId === selectedChatId);
                    const currentMsgs = currentSession?.messages || [];
                    const matchedUser = usersList.find(
                      (u) =>
                        u.walletAddress.toLowerCase() ===
                        (currentSession?.walletAddress || selectedChatId).toLowerCase()
                    );
                    return (
                      <>
                        <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
                          <div>
                            <h3 className="font-bold text-sm text-slate-900">
                              User {matchedUser ? getUserId(matchedUser) : 'Guest'}
                              <span className="font-admin-mono text-xs font-normal text-slate-500 ml-2">
                                {selectedChatId}
                              </span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 font-admin-mono">
                              Available ${(matchedUser?.usdtBalance || 0).toFixed(2)} · Occupied $
                              {(matchedUser?.occupiedUSDT || 0).toFixed(2)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCloseChatSession(selectedChatId)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            Close &amp; Delete Chat
                          </button>
                        </div>

                        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 bg-slate-50/50 min-h-[380px]">
                          {currentMsgs.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] px-4 py-3 rounded-xl text-xs leading-relaxed ${
                                  msg.sender === 'agent'
                                    ? 'bg-[#0F172A] text-white'
                                    : 'bg-white text-slate-800 border border-slate-200'
                                }`}
                              >
                                <div className="font-semibold text-[11px] mb-1 opacity-75">
                                  {msg.sender === 'agent' ? 'Support Agent' : 'User'}
                                </div>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                <span className="font-admin-mono text-[10px] block text-right mt-1.5 opacity-60">
                                  {new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <form onSubmit={handleSendAgentReply} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                          <input
                            type="text"
                            value={agentReplyText}
                            onChange={(e) => setAgentReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 h-10 px-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
                          />
                          <button
                            type="submit"
                            disabled={!agentReplyText.trim() || isSendingReply}
                            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs cursor-pointer transition inline-flex items-center gap-1.5 shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send</span>
                          </button>
                        </form>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">
                    Select a conversation on the left to view messages.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: PER-USER AIRDROPS */}
          {activeTab === 'airdrops' && hasPerm('manageAirdrops') && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="border-b border-slate-200 pb-4">
                  <h2 className="text-base font-bold text-slate-900">Configure Airdrop Campaign</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assign a global reward target or configure custom parameters for an individual wallet.
                  </p>
                </div>

                <form onSubmit={handleSaveAirdrop} className="space-y-4 max-w-3xl">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Target Account (Wallet Address or Global)
                    </label>
                    <select
                      value={airdropTargetAddress}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAirdropTargetAddress(val);
                        if (val.toUpperCase() === 'ALL' && globalAirdrop) {
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
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                    >
                      <option value="">-- Select Target User --</option>
                      <option value="ALL">ALL Users (Global Default)</option>
                      {usersList.map((u) => (
                        <option key={u.walletAddress} value={u.walletAddress}>
                          ID: {getUserId(u)} ({u.walletAddress.slice(0, 10)}...{u.walletAddress.slice(-6)})
                          {u.airdropConfig ? ' · Configured' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={airdropTargetAddress}
                      onChange={(e) => setAirdropTargetAddress(e.target.value)}
                      placeholder="Or paste custom 0x wallet address..."
                      className="w-full mt-2 h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Standard Target (USDT)
                      </label>
                      <input
                        type="number"
                        value={airdropStandardUSDT}
                        onChange={(e) => setAirdropStandardUSDT(Number(e.target.value))}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Output Reward (ETH)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={airdropOutputETH}
                        onChange={(e) => setAirdropOutputETH(Number(e.target.value))}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Duration (Days)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={airdropDurationDays}
                        onChange={(e) => setAirdropDurationDays(Number(e.target.value))}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs font-semibold text-slate-700">Status:</span>
                    <button
                      type="button"
                      onClick={() => setAirdropEnabled(!airdropEnabled)}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition border cursor-pointer inline-flex items-center gap-1.5 ${
                        airdropEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {airdropEnabled ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      <span>{airdropEnabled ? 'Enabled' : 'Disabled'}</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition cursor-pointer inline-flex items-center gap-2"
                  >
                    <Gift className="w-4 h-4" />
                    <span>Save Airdrop Configuration</span>
                  </button>
                </form>
              </div>

              {/* Active Airdrops Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Configured Airdrops</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                        <th className="py-3 px-4">Target</th>
                        <th className="py-3 px-4">Wallet Address</th>
                        <th className="py-3 px-4 text-right">Standard USDT</th>
                        <th className="py-3 px-4 text-right">Output ETH</th>
                        <th className="py-3 px-4">Ends At</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {globalAirdrop && (
                        <tr className="bg-amber-50/40 hover:bg-amber-50/70 transition">
                          <td className="py-3 px-4 font-semibold text-amber-900">All Users (Global)</td>
                          <td className="py-3 px-4 font-admin-mono text-amber-800 font-semibold">ALL</td>
                          <td className="py-3 px-4 text-right font-admin-mono font-semibold text-slate-900">
                            {globalAirdrop.standardUSDT} USDT
                          </td>
                          <td className="py-3 px-4 text-right font-admin-mono font-semibold text-blue-700">
                            {globalAirdrop.outputETH} ETH
                          </td>
                          <td className="py-3 px-4 font-admin-mono text-[11px] text-slate-500">
                            {new Date(globalAirdrop.endTime).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-[11px] font-semibold text-emerald-700">
                              {globalAirdrop.enabled
                                ? Date.now() > globalAirdrop.endTime
                                  ? 'Ended'
                                  : 'Active'
                                : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setAirdropTargetAddress('ALL');
                                  setAirdropStandardUSDT(globalAirdrop.standardUSDT);
                                  setAirdropOutputETH(globalAirdrop.outputETH);
                                  setAirdropDurationDays(globalAirdrop.durationDays || 7);
                                  setAirdropEnabled(globalAirdrop.enabled);
                                }}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md cursor-pointer"
                                title="Edit Global Airdrop"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAirdrop('ALL')}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md cursor-pointer"
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
                          <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                            No custom airdrops configured yet.
                          </td>
                        </tr>
                      ) : (
                        usersList
                          .filter((u) => u.airdropConfig && u.airdropConfig.targetAddress?.toUpperCase() !== 'ALL')
                          .map((u) => {
                            const cfg = u.airdropConfig!;
                            const isExpired = Date.now() > cfg.endTime;
                            return (
                              <tr key={u.walletAddress} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-admin-mono font-semibold text-slate-900">
                                  ID: {getUserId(u)}
                                </td>
                                <td className="py-3 px-4 font-admin-mono text-[11px] text-slate-700 break-all select-all">
                                  {u.walletAddress}
                                </td>
                                <td className="py-3 px-4 text-right font-admin-mono font-semibold text-slate-900">
                                  {cfg.standardUSDT} USDT
                                </td>
                                <td className="py-3 px-4 text-right font-admin-mono font-semibold text-blue-700">
                                  {cfg.outputETH} ETH
                                </td>
                                <td className="py-3 px-4 font-admin-mono text-[11px] text-slate-500">
                                  {new Date(cfg.endTime).toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`text-[11px] font-semibold ${
                                      !cfg.enabled
                                        ? 'text-slate-500'
                                        : isExpired
                                        ? 'text-amber-700'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    {!cfg.enabled ? 'Disabled' : isExpired ? 'Ended' : 'Active'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAirdropTargetAddress(u.walletAddress);
                                        setAirdropStandardUSDT(cfg.standardUSDT);
                                        setAirdropOutputETH(cfg.outputETH);
                                        setAirdropDurationDays(cfg.durationDays || 7);
                                        setAirdropEnabled(cfg.enabled);
                                      }}
                                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAirdrop(u.walletAddress)}
                                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md cursor-pointer"
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

          {/* TAB 6: SYSTEM SETTINGS */}
          {activeTab === 'settings' && (hasPerm('manageSettings') || adminRole === 'main') && (
            <div className="space-y-6">
              {hasPerm('manageSettings') && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <h2 className="text-base font-bold text-slate-900">Forwarding &amp; Deposit Parameters</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure settlement destination wallet, deposit thresholds, and homepage profit chart visibility.
                    </p>
                  </div>

                  <form onSubmit={handleUpdateConfig} className="space-y-6 max-w-2xl">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Recipient Wallet Address
                      </label>
                      <input
                        type="text"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        placeholder="0x71C7656EC7ab88b098defB751B7401B5f6d1476B"
                        required
                      />
                      <span className="text-[11px] text-amber-700 font-medium mt-1.5 block">
                        Customer deposits settle directly to this wallet address. Verify carefully before saving.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Minimum Deposit (USDT)
                        </label>
                        <input
                          type="number"
                          value={minDepositUSDT}
                          onChange={(e) => setMinDepositUSDT(parseInt(e.target.value) || 0)}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Minimum Withdrawal (USDT)
                        </label>
                        <input
                          type="number"
                          value={minWithdrawUSDT}
                          onChange={(e) => setMinWithdrawUSDT(parseInt(e.target.value) || 0)}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          Participate Min ETH
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={minParticipateETH}
                          onChange={(e) => setMinParticipateETH(parseFloat(e.target.value) || 0.5)}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Profit Chart Display (Tier Yield Rate)
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Hide or show the table on the user homepage. Profit calculations remain active.
                        </p>
                      </div>
                      <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleToggleProfitChart(true)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 ${
                            showProfitChart ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" /> Show
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleProfitChart(false)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 ${
                            !showProfitChart ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <EyeOff className="w-3.5 h-3.5" /> Hide
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-xs cursor-pointer inline-flex items-center gap-2"
                      >
                        {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>Save System Parameters</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Main Admin Login Credentials (MAIN ADMIN ONLY) */}
              {adminRole === 'main' && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                  <div className="border-b border-slate-200 pb-4">
                    <h2 className="text-base font-bold text-slate-900">Main Admin Credentials</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Update the Main Admin username and password in the cloud database. Once changed, default credentials stop working on every device.
                    </p>
                  </div>

                  <form onSubmit={handleChangeAdminPassword} className="space-y-4 max-w-md">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Main Admin Username
                      </label>
                      <input
                        type="text"
                        value={newMainUsernameVal}
                        onChange={(e) => setNewMainUsernameVal(e.target.value)}
                        placeholder="admin"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewMainPass ? 'text' : 'password'}
                          value={newPasswordVal}
                          onChange={(e) => setNewPasswordVal(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full h-10 pl-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewMainPass((prev) => !prev)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          aria-label={showNewMainPass ? 'Hide password' : 'Show password'}
                        >
                          {showNewMainPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        type={showNewMainPass ? 'text' : 'password'}
                        value={confirmPasswordVal}
                        onChange={(e) => setConfirmPasswordVal(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isChangingPass}
                      className="h-10 px-5 bg-[#0F172A] hover:bg-slate-800 text-white font-semibold rounded-lg transition text-xs cursor-pointer inline-flex items-center gap-2"
                    >
                      {isChangingPass ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>Update Credentials</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: SUB-ADMIN MANAGEMENT (MAIN ADMIN ONLY) */}
          {activeTab === 'subadmins' && adminRole === 'main' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {editingSubAdminId ? `Edit Sub-Admin · ${subUsername}` : 'Add New Sub-Admin'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create sub-admin login accounts and control feature permissions. Sub-admins cannot view or edit this section.
                    </p>
                  </div>
                  {editingSubAdminId && (
                    <button
                      type="button"
                      onClick={resetSubAdminForm}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer self-start"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveSubAdmin} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Sub-Admin Username
                      </label>
                      <input
                        type="text"
                        value={subUsername}
                        onChange={(e) => setSubUsername(e.target.value)}
                        placeholder="e.g. manager1"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        {editingSubAdminId ? 'New Password (optional)' : 'Password'}
                      </label>
                      <div className="relative">
                        <input
                          type={showSubPass ? 'text' : 'password'}
                          value={subPassword}
                          onChange={(e) => setSubPassword(e.target.value)}
                          placeholder={editingSubAdminId ? 'Leave blank to keep existing' : 'Min 4 characters'}
                          className="w-full h-10 pl-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                          required={!editingSubAdminId}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSubPass((prev) => !prev)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          aria-label={showSubPass ? 'Hide password' : 'Show password'}
                        >
                          {showSubPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Role Label (Optional)
                      </label>
                      <input
                        type="text"
                        value={subNote}
                        onChange={(e) => setSubNote(e.target.value)}
                        placeholder="e.g. Support Agent"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="py-3 border-t border-b border-slate-200 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Account Active Status</div>
                      <p className="text-[11px] text-slate-500">
                        Disabled sub-admins cannot sign in to the Admin Portal.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={subActive}
                        onChange={(e) => setSubActive(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                      <span>{subActive ? 'Active' : 'Disabled'}</span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">Assign Sub-Admin Permissions</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSubPermissions({ ...ALL_ADMIN_PERMISSIONS })}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[11px] font-semibold border border-blue-200 cursor-pointer"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubPermissions({ ...DEFAULT_SUBADMIN_PERMISSIONS })}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold border border-slate-200 cursor-pointer"
                        >
                          Default Preset
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSubPermissions({
                              viewDashboard: false,
                              manageUsersView: false,
                              editUserBalances: false,
                              manageDailyProfit: false,
                              manageUserStatus: false,
                              approveDeposits: false,
                              approveWithdrawals: false,
                              supportChat: false,
                              manageAirdrops: false,
                              manageSettings: false,
                              viewBackupLogs: false,
                            })
                          }
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-[11px] font-semibold border border-slate-200 cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {SUB_ADMIN_PERMISSION_META.map((item) => {
                        const checked = !!subPermissions[item.key];
                        return (
                          <label
                            key={item.key}
                            className={`p-3 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                              checked
                                ? 'bg-blue-50/70 border-blue-200'
                                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSubPermissions((prev) => ({ ...prev, [item.key]: e.target.checked }))
                              }
                              className="w-4 h-4 mt-0.5 accent-blue-600 rounded cursor-pointer shrink-0"
                            />
                            <div>
                              <div className="text-xs font-semibold text-slate-900">{item.label}</div>
                              <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{item.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={savingSubAdmin}
                      className="h-10 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition text-xs cursor-pointer inline-flex items-center gap-2"
                    >
                      {savingSubAdmin ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>{editingSubAdminId ? 'Update Sub-Admin' : 'Create Sub-Admin'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Sub-Admin Accounts Directory */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Sub-Admin Accounts</h2>
                  <span className="font-admin-mono text-xs text-slate-500">{subAdminsList.length} total</span>
                </div>

                {subAdminsList.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No sub-admins created yet. Use the form above to add one.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                          <th className="py-3 px-4">Username</th>
                          <th className="py-3 px-4">Permissions</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {subAdminsList.map((sub) => {
                          const enabledPerms = SUB_ADMIN_PERMISSION_META.filter(
                            (m) => sub.permissions?.[m.key]
                          );
                          return (
                            <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-3.5 px-4 align-top">
                                <div className="font-bold text-slate-900">{sub.username}</div>
                                {sub.note && <div className="text-[11px] text-slate-500 mt-0.5">{sub.note}</div>}
                              </td>
                              <td className="py-3.5 px-4 align-top text-[11px] text-slate-600 leading-relaxed">
                                {enabledPerms.length === 0 ? (
                                  <span className="text-slate-400">No permissions assigned</span>
                                ) : (
                                  enabledPerms.map((p) => p.label).join(' · ')
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubAdminActive(sub)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition ${
                                    sub.active
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                  }`}
                                >
                                  {sub.active ? 'Active' : 'Disabled'}
                                </button>
                              </td>
                              <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleEditSubAdminClick(sub)}
                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] rounded-md border border-blue-200 cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Edit3 className="w-3 h-3" /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubAdmin(sub)}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-[11px] rounded-md border border-red-200 cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: BACKUP & LOGS */}
          {activeTab === 'backup' && hasPerm('viewBackupLogs') && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                <div className="p-6 space-y-3">
                  <h2 className="text-sm font-bold text-slate-900">Export Database Snapshot</h2>
                  <p className="text-xs text-slate-500">
                    Download a JSON snapshot of registered user accounts, balances, logs, and settings.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition cursor-pointer inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Backup JSON</span>
                  </button>
                </div>

                <div className="p-6 space-y-3">
                  <h2 className="text-sm font-bold text-slate-900">Restore Database Snapshot</h2>
                  <p className="text-xs text-slate-500">
                    Upload a previously exported backup JSON file to restore user accounts and balances.
                  </p>
                  <label className="h-10 px-4 bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition cursor-pointer inline-flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span>{uploadLoading ? 'Restoring...' : 'Upload & Restore JSON'}</span>
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

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-bold text-slate-900">Activity Ledger</h2>
                  </div>

                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setLogTypeFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        logTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      All
                    </button>
                    {uniqueLogTypes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLogTypeFilter(t)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                          logTypeFilter === t ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[460px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">User Wallet</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {filteredActivityLogs.map((log, i) => (
                        <tr key={log.id || i} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-4 font-admin-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 capitalize font-semibold text-slate-700 whitespace-nowrap">
                            {log.type}
                          </td>
                          <td
                            className="py-2.5 px-4 font-admin-mono text-[11px] text-slate-800 max-w-[200px] truncate select-all"
                            title={log.walletAddress}
                          >
                            {log.walletAddress}
                          </td>
                          <td className="py-2.5 px-4 text-right font-admin-mono font-semibold text-slate-900 whitespace-nowrap">
                            {log.amount > 0 ? `$${log.amount} ${log.currency}` : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 truncate max-w-[260px]" title={log.details}>
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
      </div>

      {/* EDIT USER DETAILS MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="font-admin bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl space-y-5"
          >
            <div className="flex justify-between items-start border-b border-slate-200 pb-4 gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-base text-slate-900">Edit Account Details</h3>
                <p className="text-xs text-slate-500 font-admin-mono mt-1 break-all select-all">
                  ID: {getUserId(editingUser)} · {editingUser.walletAddress}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-5">
              {hasPerm('editUserBalances') && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Occupied USDT (Node)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editOccupiedUSDT}
                        onChange={(e) => setEditOccupiedUSDT(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Available USDT
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editUsdtBalance}
                        onChange={(e) => setEditUsdtBalance(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">USDC</label>
                      <input
                        type="number"
                        step="any"
                        value={editUsdcBalance}
                        onChange={(e) => setEditUsdcBalance(e.target.value)}
                        className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">BTC</label>
                      <input
                        type="number"
                        step="any"
                        value={editBtcBalance}
                        onChange={(e) => setEditBtcBalance(e.target.value)}
                        className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">ETH</label>
                      <input
                        type="number"
                        step="any"
                        value={editEthBalance}
                        onChange={(e) => setEditEthBalance(e.target.value)}
                        className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Total Profit Balance (System Wallet Withdrawable)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editTotalYieldEarned}
                      onChange={(e) => setEditTotalYieldEarned(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-bold text-emerald-700 focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {hasPerm('manageDailyProfit') && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Daily Profit Override</div>
                      <p className="text-[11px] text-slate-500">
                        Credit a fixed daily dollar yield every 24 hours instead of percentage tiers.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editDailyProfitEnabled}
                      onChange={(e) => setEditDailyProfitEnabled(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                    />
                  </div>

                  {editDailyProfitEnabled && (
                    <div className="space-y-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                          $
                        </span>
                        <input
                          type="number"
                          step="any"
                          value={editDailyProfitAmount}
                          onChange={(e) => setEditDailyProfitAmount(e.target.value)}
                          placeholder="e.g. 10, 25, 50"
                          className="w-full h-10 pl-7 pr-20 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">
                          USDT / day
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[5, 10, 25, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setEditDailyProfitAmount(amt.toString())}
                            className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                          >
                            +${amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {hasPerm('editUserBalances') && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Third-party Wallet Withdrawal</div>
                      <p className="text-[11px] text-slate-500">
                        Allow external wallet withdrawal using the assigned balance below.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editThirdPartyEnabled}
                      onChange={(e) => setEditThirdPartyEnabled(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">Third-party Balance (USDT)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const fullBal =
                          (parseFloat(editUsdtBalance) || 0) +
                          (parseFloat(editOccupiedUSDT) || 0) +
                          (parseFloat(editTotalYieldEarned) || 0);
                        setEditThirdPartyBalance(fullBal.toFixed(4));
                        setEditThirdPartyEnabled(true);
                        setEditIsWithdrawLocked(false);
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-md transition cursor-pointer"
                    >
                      Add Full Balance
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={editThirdPartyBalance}
                    onChange={(e) => setEditThirdPartyBalance(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-admin-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>
              )}

              {hasPerm('manageUserStatus') && (
                <div className="pt-4 border-t border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-slate-900 cursor-pointer">
                      Lock Withdrawal for this Account
                    </label>
                    <input
                      type="checkbox"
                      checked={editIsWithdrawLocked}
                      onChange={(e) => setEditIsWithdrawLocked(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded cursor-pointer shrink-0"
                    />
                  </div>

                  {editIsWithdrawLocked && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Notice Shown to User
                      </label>
                      <input
                        type="text"
                        value={editWithdrawLockNotice}
                        onChange={(e) => setEditWithdrawLockNotice(e.target.value)}
                        placeholder="e.g. Account verification required..."
                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* QUICK BALANCE EDIT MODAL */}
      {quickBalanceModalUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="font-admin bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-5"
          >
            <div className="flex justify-between items-start border-b border-slate-200 pb-3.5">
              <div className="min-w-0">
                <h3 className="font-bold text-base text-slate-900">Update Account Balances</h3>
                <p className="text-[11px] text-slate-500 font-admin-mono mt-0.5 truncate max-w-[260px]">
                  {quickBalanceModalUser.walletAddress}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickBalanceModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickBalance} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Available USDT Balance
                </label>
                <input
                  type="number"
                  step="any"
                  value={quickUsdtVal}
                  onChange={(e) => setQuickUsdtVal(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-admin-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Occupied Node Mining USDT
                </label>
                <input
                  type="number"
                  step="any"
                  value={quickOccupiedVal}
                  onChange={(e) => setQuickOccupiedVal(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-admin-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ETH Balance</label>
                <input
                  type="number"
                  step="any"
                  value={quickEthVal}
                  onChange={(e) => setQuickEthVal(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-admin-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Total Profit Balance (System Wallet)
                </label>
                <input
                  type="number"
                  step="any"
                  value={quickProfitVal}
                  onChange={(e) => setQuickProfitVal(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-admin-mono font-bold text-emerald-700 focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 cursor-pointer">
                    Enable Third-party Wallet
                  </label>
                  <input
                    type="checkbox"
                    checked={quickThirdPartyEnabled}
                    onChange={(e) => setQuickThirdPartyEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600">3P Balance (USDT)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const fullBal =
                        (parseFloat(quickUsdtVal) || 0) +
                        (parseFloat(quickOccupiedVal) || 0) +
                        (parseFloat(quickProfitVal) || 0);
                      setQuickThirdPartyVal(fullBal.toFixed(4));
                      setQuickThirdPartyEnabled(true);
                    }}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-md transition cursor-pointer"
                  >
                    Add Full Balance
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  value={quickThirdPartyVal}
                  onChange={(e) => setQuickThirdPartyVal(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-admin-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuickBalanceModalUser(null)}
                  className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Balance</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* PAYMENT SCREENSHOT PROOF MODAL */}
      {selectedProofModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="font-admin bg-white rounded-2xl p-5 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Payment Screenshot Proof</h3>
              <button
                type="button"
                onClick={() => setSelectedProofModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
              <img
                src={selectedProofModal}
                alt="Deposit Proof"
                referrerPolicy="no-referrer"
                className="max-w-full h-auto object-contain rounded-lg"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedProofModal(null)}
              className="w-full h-10 bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
