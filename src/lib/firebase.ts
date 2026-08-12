import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteField,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, AppConfig, TransactionLog } from '../types';

// Silence Firestore internal log warnings in sandbox environments
try {
  setLogLevel('silent');
} catch {
  // Ignore error
}

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with experimentalAutoDetectLongPolling
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId || undefined
);

// Collection References
const USERS_COL = 'users';
const SETTINGS_COL = 'settings';
const LOGS_COL = 'logs';
const CHATS_COL = 'support_chats';

// Helper to wrap Firestore promises with a timeout and safe catch to prevent hanging or backend unreachable errors
function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000): Promise<T | null> {
  let timer: any;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([
    promise
      .then((res) => {
        clearTimeout(timer);
        return res;
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn('Firestore operation offline/failed:', err?.message || err);
        return null;
      }),
    timeoutPromise,
  ]);
}

/**
 * Save or update user in Firestore
 */
export async function saveUserToFirestore(user: UserAccount): Promise<void> {
  if (!user || !user.walletAddress) return;
  const address = user.walletAddress.toLowerCase();
  try {
    const userRef = doc(db, USERS_COL, address);
    const existingSnap = await withTimeout(getDoc(userRef));
    if (existingSnap && existingSnap.exists()) {
      await withTimeout(updateDoc(userRef, {
        usdtBalance: user.usdtBalance ?? 0,
        occupiedUSDT: user.occupiedUSDT ?? 0,
        totalYieldEarned: user.totalYieldEarned ?? 0,
        lastYieldPayout: user.lastYieldPayout || Date.now(),
        updatedAt: user.updatedAt || Date.now(),
        ...(user.usdcBalance !== undefined && { usdcBalance: user.usdcBalance }),
        ...(user.occupiedUSDC !== undefined && { occupiedUSDC: user.occupiedUSDC }),
        ...(user.btcBalance !== undefined && { btcBalance: user.btcBalance }),
        ...(user.occupiedBTC !== undefined && { occupiedBTC: user.occupiedBTC }),
        ...(user.ethBalance !== undefined && { ethBalance: user.ethBalance }),
        ...(user.occupiedETH !== undefined && { occupiedETH: user.occupiedETH }),
        ...(user.fundPassword !== undefined && { fundPassword: user.fundPassword }),
        ...(user.isBlocked !== undefined && { isBlocked: user.isBlocked }),
        ...(user.isWithdrawLocked !== undefined && { isWithdrawLocked: user.isWithdrawLocked }),
        ...(user.withdrawLockNotice !== undefined && { withdrawLockNotice: user.withdrawLockNotice }),
        ...(user.airdropPledgedUSDT !== undefined && { airdropPledgedUSDT: user.airdropPledgedUSDT }),
        airdropConfig: user.airdropConfig ? user.airdropConfig : deleteField(),
      }));
    } else {
      await withTimeout(setDoc(userRef, {
        walletAddress: address,
        usdtBalance: user.usdtBalance ?? 0,
        occupiedUSDT: user.occupiedUSDT ?? 0,
        usdcBalance: user.usdcBalance ?? 0,
        occupiedUSDC: user.occupiedUSDC ?? 0,
        btcBalance: user.btcBalance ?? 0,
        occupiedBTC: user.occupiedBTC ?? 0,
        ethBalance: user.ethBalance ?? 0,
        occupiedETH: user.occupiedETH ?? 0,
        totalYieldEarned: user.totalYieldEarned ?? 0,
        lastYieldPayout: user.lastYieldPayout || Date.now(),
        createdAt: user.createdAt || Date.now(),
        updatedAt: user.updatedAt || Date.now(),
        isBlocked: user.isBlocked ?? false,
        isWithdrawLocked: user.isWithdrawLocked ?? true,
        withdrawLockNotice: user.withdrawLockNotice || 'Withdrawal Locked. Please contact support.',
        airdropPledgedUSDT: user.airdropPledgedUSDT ?? 0,
        ...(user.fundPassword !== undefined && { fundPassword: user.fundPassword }),
        ...(user.airdropConfig !== undefined && { airdropConfig: user.airdropConfig }),
      }));
    }
  } catch (err) {
    console.warn('Firestore saveUser error:', err);
  }
}

/**
 * Fetch a single user from Firestore
 */
export async function fetchUserFromFirestore(walletAddress: string): Promise<UserAccount | null> {
  if (!walletAddress) return null;
  const address = walletAddress.toLowerCase();
  try {
    const userRef = doc(db, USERS_COL, address);
    const snap = await withTimeout(getDoc(userRef));
    if (snap && snap.exists()) {
      const data = snap.data();
      return {
        walletAddress: address,
        usdtBalance: data.usdtBalance ?? 0,
        occupiedUSDT: data.occupiedUSDT ?? 0,
        totalYieldEarned: data.totalYieldEarned ?? 0,
        lastYieldPayout: data.lastYieldPayout || Date.now(),
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || undefined,
        usdcBalance: data.usdcBalance ?? 0,
        occupiedUSDC: data.occupiedUSDC ?? 0,
        btcBalance: data.btcBalance ?? 0,
        occupiedBTC: data.occupiedBTC ?? 0,
        ethBalance: data.ethBalance ?? 0,
        occupiedETH: data.occupiedETH ?? 0,
        fundPassword: data.fundPassword || undefined,
        isBlocked: data.isBlocked ?? false,
        isWithdrawLocked: data.isWithdrawLocked !== undefined ? data.isWithdrawLocked : true,
        withdrawLockNotice: data.withdrawLockNotice || 'Withdrawal Locked. Please contact support.',
        airdropPledgedUSDT: data.airdropPledgedUSDT ?? 0,
        airdropConfig: data.airdropConfig || undefined,
      };
    }
  } catch (err) {
    console.warn('Firestore fetchUser error:', err);
  }
  return null;
}

/**
 * Fetch all users from Firestore
 */
export async function fetchUsersFromFirestore(): Promise<Record<string, UserAccount>> {
  const usersMap: Record<string, UserAccount> = {};
  try {
    const snap = await withTimeout(getDocs(collection(db, USERS_COL)));
    if (snap) {
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.walletAddress) {
          const addr = data.walletAddress.toLowerCase();
          usersMap[addr] = {
            walletAddress: addr,
            usdtBalance: data.usdtBalance ?? 0,
            occupiedUSDT: data.occupiedUSDT ?? 0,
            totalYieldEarned: data.totalYieldEarned ?? 0,
            lastYieldPayout: data.lastYieldPayout || Date.now(),
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || undefined,
            usdcBalance: data.usdcBalance ?? 0,
            occupiedUSDC: data.occupiedUSDC ?? 0,
            btcBalance: data.btcBalance ?? 0,
            occupiedBTC: data.occupiedBTC ?? 0,
            ethBalance: data.ethBalance ?? 0,
            occupiedETH: data.occupiedETH ?? 0,
            fundPassword: data.fundPassword || undefined,
            isBlocked: data.isBlocked ?? false,
            isWithdrawLocked: data.isWithdrawLocked !== undefined ? data.isWithdrawLocked : true,
            withdrawLockNotice: data.withdrawLockNotice || 'Withdrawal Locked. Please contact support.',
            airdropPledgedUSDT: data.airdropPledgedUSDT ?? 0,
            airdropConfig: data.airdropConfig || undefined,
          };
        }
      });
    }
  } catch (err) {
    console.warn('Firestore fetchUsers error:', err);
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
    const userRef = doc(db, USERS_COL, address);
    await withTimeout(setDoc(
      userRef,
      {
        walletAddress: address,
        isBlocked,
        updatedAt: Date.now(),
      },
      { merge: true }
    ));
  } catch (err) {
    console.warn('Firestore updateUserBlock error:', err);
  }
}

/**
 * Update user balance in Firestore
 */
export async function updateUserBalanceInFirestore(
  walletAddress: string,
  balanceType: string,
  value: number
): Promise<void> {
  if (!walletAddress) return;
  const address = walletAddress.toLowerCase();
  try {
    const userRef = doc(db, USERS_COL, address);
    await withTimeout(setDoc(
      userRef,
      {
        walletAddress: address,
        [balanceType]: value,
        updatedAt: Date.now(),
      },
      { merge: true }
    ));
  } catch (err) {
    console.warn('Firestore updateUserBalance error:', err);
  }
}

/**
 * Save System Config in Firestore
 */
export async function saveConfigToFirestore(config: Partial<AppConfig>): Promise<void> {
  try {
    const configRef = doc(db, SETTINGS_COL, 'app_config');
    await withTimeout(setDoc(configRef, { ...config, updatedAt: Date.now() }, { merge: true }));
  } catch (err) {
    console.warn('Firestore saveConfig error:', err);
  }
}

/**
 * Fetch System Config from Firestore
 */
export async function fetchConfigFromFirestore(): Promise<AppConfig | null> {
  try {
    const configRef = doc(db, SETTINGS_COL, 'app_config');
    const snap = await withTimeout(getDoc(configRef));
    if (snap && snap.exists()) {
      return snap.data() as AppConfig;
    }
  } catch (err) {
    console.warn('Firestore fetchConfig error:', err);
  }
  return null;
}

/**
 * Log transaction in Firestore
 */
export async function addLogToFirestore(log: Omit<TransactionLog, 'id'>): Promise<void> {
  try {
    await withTimeout(addDoc(collection(db, LOGS_COL), {
      ...log,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.warn('Firestore addLog error:', err);
  }
}

/**
 * Fetch logs from Firestore
 */
export async function fetchLogsFromFirestore(): Promise<TransactionLog[]> {
  const logsList: TransactionLog[] = [];
  try {
    const q = query(collection(db, LOGS_COL), orderBy('timestamp', 'desc'), limit(100));
    const snap = await withTimeout(getDocs(q));
    if (snap) {
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        logsList.push({
          id: docSnap.id,
          timestamp: data.timestamp || Date.now(),
          type: data.type || 'info',
          walletAddress: data.walletAddress || '',
          currency: data.currency || 'USDT',
          amount: data.amount,
          txHash: data.txHash,
          status: data.status,
          details: data.details || '',
          proofImage: data.proofImage || '',
        });
      });
    }
  } catch (err) {
    console.warn('Firestore fetchLogs error:', err);
  }
  return logsList;
}

/**
 * Update Log Status in Firestore
 */
export async function updateLogStatusInFirestore(
  logId: string,
  status: 'success' | 'pending' | 'failed',
  details?: string
): Promise<void> {
  if (!logId) return;
  try {
    const logRef = doc(db, LOGS_COL, logId);
    await withTimeout(updateDoc(logRef, {
      status,
      ...(details && { details }),
      updatedAt: Date.now(),
    }));
  } catch (err) {
    console.warn('Firestore updateLogStatus error:', err);
  }
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

/**
 * Save / Send message in a Support Chat session
 */
export async function sendMessageToChatInFirestore(
  chatId: string,
  message: ChatMessage,
  walletAddress?: string
): Promise<void> {
  if (!chatId) return;

  const cleanId = chatId.toLowerCase();
  const addressToSave = walletAddress ? walletAddress.toLowerCase() : cleanId;

  // 1. Sync to LocalStorage (Instant local persistence)
  try {
    const localKey = 'support_chat_' + cleanId;
    const rawLocal = localStorage.getItem(localKey);
    let existingMsgs: ChatMessage[] = [];
    if (rawLocal) {
      try {
        const parsed = JSON.parse(rawLocal);
        if (parsed && Array.isArray(parsed.messages)) existingMsgs = parsed.messages;
      } catch (e) {}
    }
    const combinedMap = new Map<string, ChatMessage>();
    existingMsgs.forEach(m => combinedMap.set(m.id, m));
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
    localStorage.setItem(localKey, JSON.stringify(updatedSession));
  } catch (e) {}

  // 2. Post to Express Backend API for persistent server-side JSON storage
  try {
    await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: cleanId, message, walletAddress: addressToSave }),
    });
  } catch (apiErr) {
    console.warn('API sendMessage notice:', apiErr);
  }

  // 3. Sync to Firestore
  try {
    const chatRef = doc(db, CHATS_COL, cleanId);
    const snap = await withTimeout(getDoc(chatRef), 2500);
    if (snap && snap.exists()) {
      const data = snap.data();
      const existingMsgs: ChatMessage[] = data.messages || [];
      await withTimeout(updateDoc(chatRef, {
        messages: [...existingMsgs, message],
        status: 'active',
        updatedAt: Date.now(),
        ...(message.sender === 'user' ? { unreadForAdmin: true } : { unreadForUser: true }),
        walletAddress: addressToSave,
      }), 2500);
    } else {
      await withTimeout(setDoc(chatRef, {
        chatId: cleanId,
        walletAddress: addressToSave,
        messages: [message],
        status: 'active',
        updatedAt: Date.now(),
        unreadForAdmin: message.sender === 'user',
        unreadForUser: message.sender === 'agent',
      }), 2500);
    }
  } catch (err) {
    console.warn('Firestore sendMessageToChat notice:', err);
  }
}

/**
 * Fetch a single chat session with LocalStorage, Firestore, and API merge
 */
export async function fetchChatFromFirestore(chatId: string): Promise<SupportChatSession | null> {
  if (!chatId) return null;

  const cleanId = chatId.toLowerCase();
  let localChat: SupportChatSession | null = null;
  let apiChat: SupportChatSession | null = null;
  let fsChat: SupportChatSession | null = null;

  try {
    const raw = localStorage.getItem('support_chat_' + cleanId);
    if (raw) localChat = JSON.parse(raw);
  } catch (e) {}

  try {
    const res = await fetch(`/api/chat/get?chatId=${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.chat) apiChat = data.chat;
    }
  } catch (e) {}

  try {
    const chatRef = doc(db, CHATS_COL, cleanId);
    const snap = await withTimeout(getDoc(chatRef), 2500);
    if (snap && snap.exists()) {
      fsChat = snap.data() as SupportChatSession;
    }
  } catch (err) {}

  const sources = [localChat, apiChat, fsChat].filter(Boolean) as SupportChatSession[];
  if (sources.length === 0) return null;

  const combinedMap = new Map<string, ChatMessage>();
  let walletAddress = cleanId;
  let status: 'active' | 'closed' = 'active';
  let updatedAt = 0;

  sources.forEach((s) => {
    (s.messages || []).forEach((m) => combinedMap.set(m.id, m));
    if (s.walletAddress) walletAddress = s.walletAddress;
    if (s.status) status = s.status;
    if (s.updatedAt && s.updatedAt > updatedAt) updatedAt = s.updatedAt;
  });

  const sortedMsgs = Array.from(combinedMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  return {
    chatId: cleanId,
    walletAddress,
    messages: sortedMsgs,
    status,
    updatedAt: updatedAt || Date.now(),
  };
}

/**
 * Fetch all chat sessions (for Admin) from LocalStorage, Express API, and Firestore
 */
export async function fetchAllChatsFromFirestore(): Promise<SupportChatSession[]> {
  const map = new Map<string, SupportChatSession>();

  // 1. LocalStorage scanning (Instant local results)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('support_chat_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const c = JSON.parse(raw);
          if (c && c.chatId) {
            map.set(c.chatId.toLowerCase(), c);
          }
        }
      }
    }
  } catch (e) {}

  // 2. Fetch from Express Backend API
  try {
    const res = await fetch('/api/chat/all');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.chats)) {
        data.chats.forEach((c: SupportChatSession) => {
          if (c && c.chatId) {
            const cleanId = c.chatId.toLowerCase();
            const existing = map.get(cleanId);
            if (existing) {
              const combinedMap = new Map<string, ChatMessage>();
              (existing.messages || []).forEach(m => combinedMap.set(m.id, m));
              (c.messages || []).forEach(m => combinedMap.set(m.id, m));
              const sorted = Array.from(combinedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
              map.set(cleanId, {
                ...existing,
                ...c,
                messages: sorted,
                updatedAt: Math.max(existing.updatedAt || 0, c.updatedAt || 0),
              });
            } else {
              map.set(cleanId, c);
            }
          }
        });
      }
    }
  } catch (e) {}

  // 3. Fetch from Firestore (Fast query with timeout)
  try {
    const snap = await withTimeout(getDocs(collection(db, CHATS_COL)), 2500);
    if (snap) {
      snap.forEach((docSnap) => {
        const data = docSnap.data() as SupportChatSession;
        if (data && data.chatId) {
          const cleanId = data.chatId.toLowerCase();
          const existing = map.get(cleanId);
          if (existing) {
            const combinedMap = new Map<string, ChatMessage>();
            (existing.messages || []).forEach(m => combinedMap.set(m.id, m));
            (data.messages || []).forEach(m => combinedMap.set(m.id, m));
            const sorted = Array.from(combinedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
            map.set(cleanId, {
              ...existing,
              ...data,
              messages: sorted,
              updatedAt: Math.max(existing.updatedAt || 0, data.updatedAt || 0),
            });
          } else {
            map.set(cleanId, data);
          }
        }
      });
    }
  } catch (err) {
    console.warn('Firestore fetchAllChats notice:', err);
  }

  const result = Array.from(map.values()).filter(c => c && c.status !== 'closed');
  result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return result;
}

/**
 * Close and delete support chat session from all persistence layers
 */
export async function closeChatInFirestore(chatId: string, deleteHistory = true): Promise<void> {
  if (!chatId) return;
  const cleanId = chatId.toLowerCase();

  // 1. Thoroughly remove from LocalStorage (all case variations)
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const keyLower = key.toLowerCase();
        if (keyLower === 'support_chat_' + cleanId || keyLower === cleanId) {
          keysToRemove.push(key);
        } else if (keyLower.startsWith('support_chat_')) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const c = JSON.parse(raw);
              if (c && c.chatId && c.chatId.toLowerCase() === cleanId) {
                keysToRemove.push(key);
              }
            }
          } catch (e) {}
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    if (localStorage.getItem('support_guest_id')?.toLowerCase() === cleanId) {
      localStorage.removeItem('support_guest_id');
    }
  } catch (e) {}

  // 2. Remove from Express Backend API
  try {
    await fetch('/api/chat/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: cleanId }),
    });
  } catch (e) {}

  // 3. Remove from Firestore
  try {
    const chatRef = doc(db, CHATS_COL, cleanId);
    if (deleteHistory) {
      await withTimeout(deleteDoc(chatRef), 2500);
      if (chatId !== cleanId) {
        await withTimeout(deleteDoc(doc(db, CHATS_COL, chatId)), 2500);
      }
    } else {
      await withTimeout(updateDoc(chatRef, {
        status: 'closed',
        updatedAt: Date.now(),
      }), 2500);
    }
  } catch (err) {
    console.warn('Firestore closeChat notice:', err);
  }
}
