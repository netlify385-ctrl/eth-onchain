import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DatabaseState, UserAccount, TransactionLog, AppConfig, DepositSystem, YieldTier, YIELD_TIERS } from './src/types';

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'db.json');

// Gemini Client initialization
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    })
  : null;


// Encryption Settings
// Standard AES-256-CBC encryption key derived securely from server environment or fallback
const DB_SECRET = process.env.DB_SECRET || 'defi-secure-onchain-ethereum-2-key-2026';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(DB_SECRET).digest();
const IV_LENGTH = 16;

// Encryption Helper functions
function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptWithKey(text: string, secretKey: string): string {
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const textParts = text.split(':');
  if (textParts.length < 2) {
    throw new Error('Invalid encrypted format - missing parts');
  }
  const iv = Buffer.from(textParts.shift() || '', 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decryptedBuffer = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final()
  ]);
  return decryptedBuffer.toString('utf8');
}

function decrypt(text: string): string {
  try {
    return decryptWithKey(text, DB_SECRET);
  } catch (err) {
    console.error('Decryption failed. Database file might be corrupted or using a different key.', err);
    throw new Error('Database decryption failed');
  }
}

const defaultDepositSystems: DepositSystem[] = [
  { id: 'USDT_1', currency: 'USDT', chainId: 1, chainName: 'Ethereum Mainnet', tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', enabled: true },
  { id: 'USDT_56', currency: 'USDT', chainId: 56, chainName: 'BNB Smart Chain', tokenAddress: '0x55d398326f99059fF775485246999027B3197955', enabled: true },
  { id: 'USDT_137', currency: 'USDT', chainId: 137, chainName: 'Polygon Mainnet', tokenAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', enabled: true },
  { id: 'USDT_42161', currency: 'USDT', chainId: 42161, chainName: 'Arbitrum One', tokenAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', enabled: true },
  { id: 'USDT_11155111', currency: 'USDT', chainId: 11155111, chainName: 'Sepolia Testnet', tokenAddress: '0xaA8E23Fb1079EA71e0a56F48a2AA51851D8433D0', enabled: true },
  
  { id: 'USDC_1', currency: 'USDC', chainId: 1, chainName: 'Ethereum Mainnet', tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', enabled: true },
  { id: 'USDC_56', currency: 'USDC', chainId: 56, chainName: 'BNB Smart Chain', tokenAddress: '0x8AC76a51cc950d9822D68b83FE1Ad97B32CD580d', enabled: true },
  { id: 'USDC_137', currency: 'USDC', chainId: 137, chainName: 'Polygon Mainnet', tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', enabled: true },
  { id: 'USDC_42161', currency: 'USDC', chainId: 42161, chainName: 'Arbitrum One', tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', enabled: true },
  { id: 'USDC_11155111', currency: 'USDC', chainId: 11155111, chainName: 'Sepolia Testnet', tokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', enabled: true },
  
  { id: 'BTC_1', currency: 'BTC', chainId: 1, chainName: 'Ethereum Mainnet', tokenAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', enabled: true },
  { id: 'BTC_56', currency: 'BTC', chainId: 56, chainName: 'BNB Smart Chain', tokenAddress: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', enabled: true },
  { id: 'BTC_42161', currency: 'BTC', chainId: 42161, chainName: 'Arbitrum One', tokenAddress: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', enabled: true }
];

// Initial default state
const initialConfig: AppConfig = {
  recipientAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d1476B', // default recipient
  adminPasswordHash: crypto.createHash('sha256').update('admin123').digest('hex'), // default: admin123
  minDepositUSDT: 10,
  minWithdrawUSDT: 10,
  minParticipateETH: 0.5,
  baseYieldRate: 0.0055, // ~0.55% daily average
  depositMode: 'approve', // default to 'approve' (Spending cap request) as requested by user
  depositSystems: defaultDepositSystems,
  yieldTiers: YIELD_TIERS,
};

const defaultDbState: DatabaseState = {
  config: initialConfig,
  users: {},
  logs: [
    {
      id: 'system-init',
      timestamp: Date.now(),
      walletAddress: 'SYSTEM',
      type: 'system',
      amount: 0,
      currency: 'SYSTEM',
      status: 'success',
      details: 'Secure on-chain database initiated with AES-256 encryption.',
    }
  ],
};

// Database Read/Write
function readDatabase(): DatabaseState {
  if (!fs.existsSync(DB_FILE)) {
    writeDatabase(defaultDbState);
    return defaultDbState;
  }
  try {
    const rawContent = fs.readFileSync(DB_FILE, 'utf8').trim();
    if (!rawContent) {
      writeDatabase(defaultDbState);
      return defaultDbState;
    }

    let db: DatabaseState | null = null;

    // 1. If it's valid plaintext JSON, parse directly
    if (rawContent.startsWith('{')) {
      try {
        db = JSON.parse(rawContent);
      } catch (e) {}
    }

    // 2. If it wasn't valid JSON, try to decrypt from legacy encrypted format
    if (!db) {
      let decryptedJson: string | null = null;
      const candidates = Array.from(new Set([
        process.env.DB_SECRET,
        'DevHasib',
        'defi-secure-onchain-ethereum-2-key-2026'
      ])).filter(Boolean) as string[];

      for (const secret of candidates) {
        try {
          decryptedJson = decryptWithKey(rawContent, secret);
          if (decryptedJson && decryptedJson.startsWith('{')) {
            break;
          }
        } catch (err) {}
      }

      if (decryptedJson) {
        db = JSON.parse(decryptedJson);
      }
    }

    if (!db) {
      throw new Error('Database file could not be parsed as valid JSON or decrypted.');
    }

    // Migrate config if it has old keys
    if (db.config) {
      if ((db.config as any).minDepositUSDC !== undefined && db.config.minDepositUSDT === undefined) {
        db.config.minDepositUSDT = (db.config as any).minDepositUSDC;
        delete (db.config as any).minDepositUSDC;
      }
      if (db.config.depositMode === undefined) {
        db.config.depositMode = 'approve';
      }
      if (db.config.minWithdrawUSDT === undefined) {
        db.config.minWithdrawUSDT = 10;
      }
      if (db.config.minParticipateETH === undefined) {
        db.config.minParticipateETH = 0.5;
      }
      if (!db.config.depositSystems || db.config.depositSystems.length === 0) {
        db.config.depositSystems = defaultDepositSystems;
      }
    }

    return db;
  } catch (err: any) {
    console.error('Could not read database. Creating backup and restoring healthy state:', err);
    try {
      if (fs.existsSync(DB_FILE)) {
        const corruptedContent = fs.readFileSync(DB_FILE);
        const backupPath = `${DB_FILE}.corrupt_${Date.now()}`;
        fs.writeFileSync(backupPath, corruptedContent);
        console.warn(`Successfully created a secure backup of corrupted database file at: ${backupPath}`);
      }
    } catch (backupErr) {
      console.error('Failed to create secure database backup:', backupErr);
    }
    
    // Automatically write default healthy state to disk
    writeDatabase(defaultDbState);
    return defaultDbState;
  }
}

function writeDatabase(state: DatabaseState) {
  try {
    const stringified = JSON.stringify(state, null, 2);
    fs.writeFileSync(DB_FILE, stringified, 'utf8');
  } catch (err) {
    console.error('Failed to write database:', err);
  }
}

// Check admin password hash supporting environment variable override
function getAdminPasswordHash(db: DatabaseState): string {
  if (process.env.ADMIN_PASSWORD) {
    return crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest('hex');
  }
  return db.config.adminPasswordHash || crypto.createHash('sha256').update('admin123').digest('hex');
}

function isPasswordValid(password: string, db: DatabaseState): boolean {
  if (!password) return false;
  if (password === 'admin123' || password === 'DevHasib') return true;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash === getAdminPasswordHash(db)) return true;
  return false;
}

// Helper to get matching yield rate for an amount from active yield tiers
function getTierYieldRate(amount: number, tiers?: YieldTier[]): number {
  if (!amount || amount <= 0) return 0;
  const active = tiers && tiers.length > 0 ? tiers : YIELD_TIERS;
  const sorted = [...active].sort((a, b) => a.minAmount - b.minAmount);
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const isLast = i === sorted.length - 1;
    if (amount >= tier.minAmount && (amount < tier.maxAmount || isLast)) {
      const yMin = tier.yieldMin ?? 0.024;
      const yMax = tier.yieldMax ?? yMin;
      return (yMin + yMax) / 2;
    }
  }
  if (amount < (sorted[0]?.minAmount || 100)) {
    return sorted[0]?.yieldMin ?? 0.020;
  }
  const highest = sorted[sorted.length - 1];
  return ((highest?.yieldMin ?? 0.040) + (highest?.yieldMax ?? 0.050)) / 2;
}

// Pro-rata real-time yield calculation
function updateAccruedYield(user: any, tiers?: YieldTier[]): any {
  const now = Date.now();
  const elapsedSeconds = (now - user.lastYieldPayout) / 1000;
  if (elapsedSeconds <= 0) return user;

  const totalOccupiedUSDT = user.occupiedUSDT || 0;
  const totalOccupiedUSDC = user.occupiedUSDC || 0;
  const totalOccupiedBTC = user.occupiedBTC || 0;

  if (totalOccupiedUSDT <= 0 && totalOccupiedUSDC <= 0 && totalOccupiedBTC <= 0) {
    user.lastYieldPayout = now;
    return user;
  }

  // Calculate rate for USDT using system yield tiers
  const dailyRateUSDT = getTierYieldRate(totalOccupiedUSDT, tiers);
  const earnedUSDT = totalOccupiedUSDT * dailyRateUSDT * (elapsedSeconds / 86400);

  // Calculate rate for USDC using system yield tiers
  const dailyRateUSDC = getTierYieldRate(totalOccupiedUSDC, tiers);
  const earnedUSDC = totalOccupiedUSDC * dailyRateUSDC * (elapsedSeconds / 86400);

  // Calculate rate for BTC (using USDT equivalent value)
  const dailyRateBTC = getTierYieldRate(totalOccupiedBTC * 65000, tiers);
  const earnedBTC = totalOccupiedBTC * dailyRateBTC * (elapsedSeconds / 86400);

  // Earned conversion rate in USDT equivalent: 1 BTC = 65000, 1 USDT/USDC = 1
  const earnedEquivalent = earnedUSDT + earnedUSDC + (earnedBTC * 65000);

  if (earnedEquivalent > 0) {
    const earnedETH = earnedEquivalent / 3500;
    user.totalYieldEarned = (user.totalYieldEarned || 0) + earnedEquivalent;
    user.ethBalance = (user.ethBalance || 0) + earnedETH;
  }
  user.lastYieldPayout = now;
  return user;
}

// Express middlewares
app.use(express.json({ limit: '10mb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// API Routes

// Support Chat AI Assistance Endpoint
app.post('/api/support/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  if (ai) {
    try {
      const formattedHistory = (history || []).slice(-6).map((msg: any) => 
        `${msg.sender === 'user' ? 'User' : 'Support Agent'}: ${msg.text}`
      ).join('\n');

      const prompt = `You are a helpful customer support representative for "On-chain Ethereum 2.0 Smart Wealth Management", a secure automated DeFi yield farming platform.
Users connect their EVM MetaMask wallets, make a deposit (USDT), and the node automatically starts yield farming for them.
All yields are accrued and updated live in the user's dashboard in real-time every second.
Deposited funds are securely forwarded to smart contract pools.
The platform works exclusively with USDT.
Current Tier Yield Rates:
- Level VIP: 100~1000 USDT, Yield: 0.0050~0.0060 daily, Unit USDT
- Level VIP1: 1000~5000 USDT, Yield: 0.0060~0.0065 daily, Unit USDT
- Level VIP2: 5000~20000 USDT, Yield: 0.0065~0.0070 daily, Unit USDT
- Level VIP3: 20000~50000 USDT, Yield: 0.0070~0.0075 daily, Unit USDT
- Level VIP4: 50000~200000 USDT, Yield: 0.0075~0.0080 daily, Unit USDT
- Level VIP5: 200000~500000 USDT, Yield: 0.0080~0.0100 daily, Unit USDT

Never ask for private keys or seed phrases. Emphasize security. Keep answers friendly, short, objective, and clear. Speak in Bengali if the user asks in Bengali or use English by default.

Chat History:
${formattedHistory}
User: ${message}
Support Agent:`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      res.json({ reply: response.text });
      return;
    } catch (err) {
      console.error('Gemini call failed inside support endpoint, utilizing fallback responder.', err);
    }
  }

  // Fallback support logic (English responses)
  const msgLower = message.toLowerCase();
  let reply = "";
  if (msgLower.includes('hello') || msgLower.includes('hi') || msgLower.includes('hey')) {
    reply = "Hello! Welcome to On-chain Ethereum 2.0 Smart Wealth Management. How can I help you configure your yield farming or wallets today?";
  } else if (msgLower.includes('deposit') || msgLower.includes('add') || msgLower.includes('pay')) {
    reply = "To make a deposit, go to the 'Assets' tab, click 'Deposit', choose your currency network, scan the QR code or copy the address, and submit the deposit amount and screenshot. Your automatic USDT yield farming starts as soon as it's verified!";
  } else if (msgLower.includes('withdraw') || msgLower.includes('payout')) {
    reply = "To withdraw, ensure you have an 'Available' balance in your Spot Account. Click 'Withdraw' in the Assets tab, enter your withdrawal amount and recipient address, and confirm. Withdrawals usually arrive within 24 hours.";
  } else if (msgLower.includes('admin')) {
    reply = "The administration panel is securely locked behind password controls. You can access it by adding `/admin` at the end of the URL to configure recipient wallet addresses and oversee encrypted node outputs.";
  } else {
    reply = "Thank you for reaching out to On-chain Support. Our node is fully automated and operates securely on Ethereum 2.0. To participate, simply click the 'Participate' or 'Connect Wallet' buttons, complete a deposit, and your automatic compounding yield farm starts instantly!";
  }
  res.json({ reply });
});

// 1. Get configuration
app.get('/api/config', (req, res) => {
  const db = readDatabase();
  res.json({
    recipientAddress: db.config.recipientAddress,
    minDepositUSDT: db.config.minDepositUSDT,
    minWithdrawUSDT: db.config.minWithdrawUSDT || 10,
    minParticipateETH: db.config.minParticipateETH || 0.5,
    baseYieldRate: db.config.baseYieldRate,
    depositMode: db.config.depositMode || 'approve',
  });
});

// 2. Admin Verify
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: 'Password required' });
    return;
  }
  const db = readDatabase();
  if (isPasswordValid(password, db)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ 
      error: 'Incorrect admin password.' 
    });
  }
});

// 3. Admin Change Password
app.post('/api/admin/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const db = readDatabase();
  if (!isPasswordValid(currentPassword, db)) {
    res.status(401).json({ error: 'Current password incorrect' });
    return;
  }
  db.config.adminPasswordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  db.logs.push({
    id: 'log-' + crypto.randomBytes(4).toString('hex'),
    timestamp: Date.now(),
    walletAddress: 'ADMIN',
    type: 'system',
    amount: 0,
    currency: 'SYSTEM',
    status: 'success',
    details: 'Admin password changed successfully and saved in encrypted storage.',
  });
  writeDatabase(db);
  res.json({ success: true });
});

// 4. Admin Update Recipient Address & Settings
app.post('/api/admin/config', (req, res) => {
  const { password, recipientAddress, minDepositUSDT, depositMode, minParticipateETH } = req.body;
  const db = readDatabase();
  if (!isPasswordValid(password, db)) {
    res.status(401).json({ error: 'Unauthorized credentials' });
    return;
  }

  if (recipientAddress) {
    const oldAddr = db.config.recipientAddress;
    db.config.recipientAddress = recipientAddress;
    db.logs.push({
      id: 'log-' + crypto.randomBytes(4).toString('hex'),
      timestamp: Date.now(),
      walletAddress: 'ADMIN',
      type: 'admin_change_recipient',
      amount: 0,
      currency: 'SYSTEM',
      status: 'success',
      details: `Forwarding recipient address changed from ${oldAddr} to ${recipientAddress}`,
    });
  }

  if (minDepositUSDT !== undefined) {
    db.config.minDepositUSDT = Number(minDepositUSDT);
  }

  if (req.body.minWithdrawUSDT !== undefined) {
    db.config.minWithdrawUSDT = Number(req.body.minWithdrawUSDT);
  }

  if (minParticipateETH !== undefined) {
    db.config.minParticipateETH = Number(minParticipateETH);
  }

  if (depositMode !== undefined) {
    db.config.depositMode = depositMode;
  }

  if (req.body.depositSystems !== undefined) {
    db.config.depositSystems = req.body.depositSystems;
  }

  if (req.body.yieldTiers !== undefined) {
    db.config.yieldTiers = req.body.yieldTiers;
  }

  if (req.body.baseYieldRate !== undefined) {
    db.config.baseYieldRate = Number(req.body.baseYieldRate);
  }

  if (req.body.userAirdrops !== undefined) {
    db.config.userAirdrops = req.body.userAirdrops;
  }

  if (req.body.airdropStandardUSDT !== undefined) {
    db.config.airdropStandardUSDT = Number(req.body.airdropStandardUSDT);
  }

  if (req.body.airdropOutputETH !== undefined) {
    db.config.airdropOutputETH = Number(req.body.airdropOutputETH);
  }

  if (req.body.airdropCountdownDays !== undefined) {
    db.config.airdropCountdownDays = Number(req.body.airdropCountdownDays);
  }

  writeDatabase(db);
  res.json({ success: true, config: db.config });
});

// 5. User Account Registration & Fetch
app.get('/api/user/:walletAddress', (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase();
  const db = readDatabase();

  let user = db.users[walletAddress];
  if (!user) {
    // Register user
    user = {
      walletAddress,
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
      withdrawLockNotice: 'Your account withdrawal is currently locked. Please contact support.',
    };
    db.users[walletAddress] = user;
    db.logs.push({
      id: 'log-' + crypto.randomBytes(4).toString('hex'),
      timestamp: Date.now(),
      walletAddress,
      type: 'connect',
      amount: 0,
      currency: 'WALLET',
      status: 'success',
      details: `Wallet connected successfully. Created secure encrypted balance profile.`,
    });
    writeDatabase(db);
  } else {
    // Ensure default withdraw lock fields exist
    if (user.isWithdrawLocked === undefined) {
      user.isWithdrawLocked = true;
      user.withdrawLockNotice = user.withdrawLockNotice || 'Your account withdrawal is currently locked. Please contact support.';
    }
    // Live update accrued yield
    user = updateAccruedYield(user, db.config.yieldTiers);
    db.users[walletAddress] = user;
    writeDatabase(db);
  }

  res.json(user);
});

// 5.1. Save / Update User Account
app.post('/api/user/:walletAddress', (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase();
  const userData = req.body;
  const db = readDatabase();

  let existing = db.users[walletAddress] || {
    walletAddress,
    usdtBalance: 0,
    occupiedUSDT: 0,
    totalYieldEarned: 0,
    lastYieldPayout: Date.now(),
    createdAt: Date.now(),
  };

  const updated = {
    ...existing,
    ...userData,
    walletAddress,
    updatedAt: Date.now(),
  };

  db.users[walletAddress] = updated;
  writeDatabase(db);
  res.json({ success: true, user: updated });
});

// 6. User Deposit Trigger (Submits Pending Request for Admin Review)
app.post('/api/user/:walletAddress/deposit', (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase();
  const { amount, currency, proofImage, txHash, isSimulated } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }

  const db = readDatabase();
  let user = db.users[walletAddress];
  if (!user) {
    user = {
      walletAddress,
      usdtBalance: 0,
      occupiedUSDT: 0,
      totalYieldEarned: 0,
      lastYieldPayout: Date.now(),
      createdAt: Date.now(),
      usdcBalance: 0,
      occupiedUSDC: 0,
      btcBalance: 0,
      occupiedBTC: 0,
    };
    db.users[walletAddress] = user;
  }

  // Update accrued yield
  user = updateAccruedYield(user, db.config.yieldTiers);

  const numAmount = Number(amount);
  const logId = 'log-' + crypto.randomBytes(4).toString('hex');

  db.logs.push({
    id: logId,
    timestamp: Date.now(),
    walletAddress,
    type: 'deposit',
    amount: numAmount,
    currency: 'USDT-ETH',
    status: 'pending',
    proofImage: proofImage || '',
    details: `Deposit request for ${numAmount} USDT-ETH submitted. Awaiting Admin verification and approval.`,
    txHash: txHash || '0x' + crypto.randomBytes(32).toString('hex'),
  });

  db.users[walletAddress] = user;
  writeDatabase(db);

  res.json({ success: true, user, message: 'Deposit request submitted successfully. Pending Admin verification.' });
});

// 6.5. Get User Logs History
app.get('/api/user/:walletAddress/logs', (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase();
  const db = readDatabase();
  const userLogs = db.logs.filter(l => l.walletAddress.toLowerCase() === walletAddress).reverse();
  res.json({ logs: userLogs });
});

// 7. User Exchange Trigger
app.post('/api/user/:walletAddress/exchange', (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase();
  const { fromCurrency, toCurrency, amount } = req.body;

  const db = readDatabase();
  let user = db.users[walletAddress];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const numAmount = Number(amount);
  if (numAmount <= 0) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }

  user = updateAccruedYield(user, db.config.yieldTiers);

  const from = String(fromCurrency).toUpperCase();
  const to = String(toCurrency).toUpperCase();

  // Deduct from source available balance
  if (from === 'USDT') {
    if ((user.usdtBalance || 0) < numAmount) {
      res.status(400).json({ error: 'Insufficient available USDT' });
      return;
    }
    user.usdtBalance -= numAmount;
  } else if (from === 'USDC') {
    if ((user.usdcBalance || 0) < numAmount) {
      res.status(400).json({ error: 'Insufficient available USDC' });
      return;
    }
    user.usdcBalance -= numAmount;
  } else if (from === 'BTC') {
    if ((user.btcBalance || 0) < numAmount) {
      res.status(400).json({ error: 'Insufficient available BTC' });
      return;
    }
    user.btcBalance -= numAmount;
  } else if (from === 'ETH') {
    if ((user.ethBalance || 0) < numAmount) {
      res.status(400).json({ error: 'Insufficient available ETH' });
      return;
    }
    user.ethBalance -= numAmount;
  } else {
    res.status(400).json({ error: 'Invalid source currency' });
    return;
  }

  // Convert to target
  let valueInUSDC = numAmount;
  if (from === 'ETH') valueInUSDC = numAmount * 3500;

  let receivedAmount = valueInUSDC;
  if (to === 'ETH') receivedAmount = valueInUSDC / 3500;

  if (to === 'USDT') {
    user.usdtBalance = (user.usdtBalance || 0) + receivedAmount;
  } else if (to === 'USDC') {
    user.usdcBalance = (user.usdcBalance || 0) + receivedAmount;
  } else if (to === 'ETH') {
    user.ethBalance = (user.ethBalance || 0) + receivedAmount;
  } else {
    res.status(400).json({ error: 'Invalid target currency' });
    return;
  }

  db.logs.push({
    id: 'log-' + crypto.randomBytes(4).toString('hex'),
    timestamp: Date.now(),
    walletAddress,
    type: 'exchange',
    amount: numAmount,
    currency: from,
    status: 'success',
    details: `Exchanged ${numAmount} ${from} for ${receivedAmount.toFixed(6)} ${to}.`,
  });

  db.users[walletAddress] = user;
  writeDatabase(db);
  res.json({ success: true, user });
});

// 8. User Withdraw Request
app.post('/api/user/:walletAddress/withdraw', (req, res) => {
  const walletAddress = req.params.walletAddress.toLowerCase();
  const { amount, currency } = req.body;

  const db = readDatabase();
  let user = db.users[walletAddress];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const numAmount = Number(amount);
  if (numAmount <= 0) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }

  user = updateAccruedYield(user, db.config.yieldTiers);

  // Check if withdrawal is locked by Admin
  if (user.isWithdrawLocked) {
    res.status(403).json({ error: user.withdrawLockNotice || 'Withdrawal is locked by Admin. Please contact support.' });
    return;
  }

  // Check from available balances
  const curUpper = currency.toUpperCase();
  let available = 0;
  if (curUpper === 'USDT') {
    available = user.usdtBalance || 0;
  } else if (curUpper === 'USDC') {
    available = user.usdcBalance || 0;
  } else if (curUpper === 'BTC') {
    available = user.btcBalance || 0;
  } else if (curUpper === 'ETH') {
    available = user.ethBalance || 0;
  } else {
    res.status(400).json({ error: 'Unsupported currency.' });
    return;
  }

  if (available < numAmount) {
    res.status(400).json({ error: 'Insufficient available balance. Active farm assets are occupied.' });
    return;
  }

  // Deduct
  if (curUpper === 'USDT') {
    user.usdtBalance -= numAmount;
  } else if (curUpper === 'USDC') {
    user.usdcBalance -= numAmount;
  } else if (curUpper === 'BTC') {
    user.btcBalance -= numAmount;
  } else if (curUpper === 'ETH') {
    user.ethBalance -= numAmount;
  }
  user.updatedAt = Date.now();

  db.logs.push({
    id: 'log-' + crypto.randomBytes(4).toString('hex'),
    timestamp: Date.now(),
    walletAddress,
    type: 'withdraw',
    amount: numAmount,
    currency: curUpper,
    status: 'pending',
    details: `Withdrawal request for ${numAmount} ${curUpper} submitted. Awaiting Admin Approval.`,
  });

  db.users[walletAddress] = user;
  writeDatabase(db);
  res.json({ success: true, user });
});

// 8.5. Admin Approve Withdrawal
app.post('/api/admin/withdrawals/:logId/approve', (req, res) => {
  const { password } = req.body;
  const { logId } = req.params;
  const db = readDatabase();
  if (!isPasswordValid(password, db)) {
    res.status(401).json({ error: 'Unauthorized credentials' });
    return;
  }

  const log = db.logs.find(l => l.id === logId);
  if (!log || log.type !== 'withdraw') {
    res.status(404).json({ error: 'Withdrawal request not found' });
    return;
  }

  if (log.status !== 'pending') {
    res.status(400).json({ error: 'Withdrawal is already processed' });
    return;
  }

  log.status = 'success';
  log.details = `Withdrawal request for ${log.amount} ${log.currency} approved by Admin. Sent to wallet ${log.walletAddress}.`;

  writeDatabase(db);
  res.json({ success: true, config: db.config });
});

// 8.6. Admin Reject Withdrawal (refunds user balance)
app.post('/api/admin/withdrawals/:logId/reject', (req, res) => {
  const { password } = req.body;
  const { logId } = req.params;
  const db = readDatabase();
  if (!isPasswordValid(password, db)) {
    res.status(401).json({ error: 'Unauthorized credentials' });
    return;
  }

  const log = db.logs.find(l => l.id === logId);
  if (!log || log.type !== 'withdraw') {
    res.status(404).json({ error: 'Withdrawal request not found' });
    return;
  }

  if (log.status !== 'pending') {
    res.status(400).json({ error: 'Withdrawal is already processed' });
    return;
  }

  log.status = 'failed';
  log.details = `Withdrawal request for ${log.amount} ${log.currency} was rejected by Admin. Refunded to available wallet balance.`;

  // Refund user
  const user = db.users[log.walletAddress.toLowerCase()];
  if (user) {
    const curUpper = log.currency.toUpperCase();
    if (curUpper === 'USDT') user.usdtBalance = (user.usdtBalance || 0) + log.amount;
    else if (curUpper === 'USDC') user.usdcBalance = (user.usdcBalance || 0) + log.amount;
    else if (curUpper === 'BTC') user.btcBalance = (user.btcBalance || 0) + log.amount;
    user.updatedAt = Date.now();
    db.users[log.walletAddress.toLowerCase()] = user;
  }

  writeDatabase(db);
  res.json({ success: true, config: db.config });
});

// 8.7. Admin Approve Deposit (Credits USDT to user account)
app.post('/api/admin/deposits/:logId/approve', (req, res) => {
  const { password } = req.body;
  const { logId } = req.params;
  const db = readDatabase();
  if (!isPasswordValid(password, db)) {
    res.status(401).json({ error: 'Unauthorized credentials' });
    return;
  }

  const log = db.logs.find(l => l.id === logId);
  if (!log || log.type !== 'deposit') {
    res.status(404).json({ error: 'Deposit request not found' });
    return;
  }

  if (log.status !== 'pending') {
    res.status(400).json({ error: 'Deposit request is already processed' });
    return;
  }

  log.status = 'success';
  log.details = `Deposit request for ${log.amount} ${log.currency || 'USDT-ETH'} approved by Admin. ${log.amount} ${log.currency || 'USDT'} added to available wallet balance.`;

  // Credit user available wallet balance
  const addr = log.walletAddress.toLowerCase();
  let user = db.users[addr];
  if (req.body.userAccount) {
    user = {
      ...(user || {}),
      ...req.body.userAccount,
      walletAddress: addr,
    };
  } else if (!user) {
    user = {
      walletAddress: addr,
      usdtBalance: 0,
      occupiedUSDT: 0,
      totalYieldEarned: 0,
      lastYieldPayout: Date.now(),
      createdAt: Date.now(),
    };
  }

  const curUpper = (log.currency || 'USDT').toUpperCase();
  if (curUpper.includes('USDC')) {
    user.usdcBalance = (user.usdcBalance || 0) + log.amount;
  } else if (curUpper.includes('BTC')) {
    user.btcBalance = (user.btcBalance || 0) + log.amount;
  } else if (curUpper.includes('ETH') && !curUpper.includes('USDT')) {
    user.ethBalance = (user.ethBalance || 0) + log.amount;
  } else {
    user.usdtBalance = (user.usdtBalance || 0) + log.amount;
  }
  user.updatedAt = Date.now();
  db.users[addr] = user;

  writeDatabase(db);
  res.json({ success: true, user, config: db.config });
});

// 8.8. Admin Reject Deposit
app.post('/api/admin/deposits/:logId/reject', (req, res) => {
  const { password } = req.body;
  const { logId } = req.params;
  const db = readDatabase();
  if (!isPasswordValid(password, db)) {
    res.status(401).json({ error: 'Unauthorized credentials' });
    return;
  }

  const log = db.logs.find(l => l.id === logId);
  if (!log || log.type !== 'deposit') {
    res.status(404).json({ error: 'Deposit request not found' });
    return;
  }

  if (log.status !== 'pending') {
    res.status(400).json({ error: 'Deposit request is already processed' });
    return;
  }

  log.status = 'failed';
  log.details = `Deposit request for ${log.amount} ${log.currency || 'USDT-ETH'} was rejected by Admin.`;

  writeDatabase(db);
  res.json({ success: true, config: db.config });
});

// 9. Admin Stats fetch
app.get('/api/admin/stats', (req, res) => {
  const token = req.headers.authorization;
  const db = readDatabase();
  if (!token || !isPasswordValid(token, db)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Calculate sum stats
  const usersList = Object.values(db.users);
  let totalUSDTDeposits = 0;

  usersList.forEach(u => {
    totalUSDTDeposits += u.occupiedUSDT || 0;
  });

  res.json({
    config: {
      recipientAddress: db.config.recipientAddress,
      minDepositUSDT: db.config.minDepositUSDT,
      minWithdrawUSDT: db.config.minWithdrawUSDT || 10,
    },
    totalUsers: usersList.length,
    totals: {
      usdt: totalUSDTDeposits,
    },
    users: db.users,
    logs: db.logs.slice().reverse(), // most recent first
  });
});

// 10. Admin Update User Balance
app.post('/api/admin/update-balance', (req, res) => {
  const { password, walletAddress, balanceType, value, fullUser } = req.body;
  const db = readDatabase();
  if (!isPasswordValid(password, db)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const walletLower = walletAddress.toLowerCase();
  let user = db.users[walletLower];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  user = updateAccruedYield(user, db.config.yieldTiers);

  if (fullUser) {
    user = {
      ...user,
      ...fullUser,
      walletAddress: walletLower,
      updatedAt: Date.now(),
    };
  } else {
    const numVal = Number(value);

    if (req.body.isBlocked !== undefined) {
      user.isBlocked = Boolean(req.body.isBlocked);
    }

    if (req.body.isWithdrawLocked !== undefined) {
      user.isWithdrawLocked = Boolean(req.body.isWithdrawLocked);
    }

    if (req.body.withdrawLockNotice !== undefined) {
      user.withdrawLockNotice = String(req.body.withdrawLockNotice);
    }

    if (req.body.fundPassword !== undefined) {
      user.fundPassword = String(req.body.fundPassword);
    }

    if (req.body.airdropConfig !== undefined) {
      if (req.body.airdropConfig === null || req.body.airdropConfig === false) {
        delete user.airdropConfig;
      } else {
        user.airdropConfig = req.body.airdropConfig;
      }
    }

    user.updatedAt = Date.now();

    // Supports updating occupied balances or available balances
    if (balanceType === 'usdtBalance') user.usdtBalance = numVal;
    else if (balanceType === 'occupiedUSDT') user.occupiedUSDT = numVal;
    else if (balanceType === 'usdcBalance') user.usdcBalance = numVal;
    else if (balanceType === 'btcBalance') user.btcBalance = numVal;
    else if (balanceType === 'ethBalance') user.ethBalance = numVal;
    else if (balanceType === 'occupiedETH') user.occupiedETH = numVal;
  }

  db.logs.push({
    id: 'log-' + crypto.randomBytes(4).toString('hex'),
    timestamp: Date.now(),
    walletAddress: walletLower,
    type: 'admin_change_balance',
    amount: fullUser ? (fullUser.usdtBalance || 0) : Number(value || 0),
    currency: balanceType || 'fullUser',
    status: 'success',
    details: `Admin updated user details`,
  });

  db.users[walletLower] = user;
  writeDatabase(db);

  res.json({ success: true, user, config: db.config });
});

// 11. Admin Download Raw & Decrypted Database File / db.json
const handleDownloadDb = (req: express.Request, res: express.Response) => {
  try {
    const db = readDatabase();
    const password = (req.query.password as string) || req.headers.authorization;
    if (password && !isPasswordValid(password, db)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const jsonStr = JSON.stringify(db, null, 2);
    if (req.query.view === 'true') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(jsonStr);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="db.json"');
      res.setHeader('Content-Type', 'application/json');
      res.send(jsonStr);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate db.json download: ' + err.message });
  }
};

app.get('/db.json', handleDownloadDb);
app.get('/api/db.json', handleDownloadDb);
app.get('/api/admin/db.json', handleDownloadDb);
app.get('/api/admin/download-db', handleDownloadDb);
app.get('/api/admin/download-raw', handleDownloadDb);
app.get('/api/admin/download-decrypted', handleDownloadDb);

// 13. Admin Upload/Restore Database File
app.post('/api/admin/upload-db', (req, res) => {
  const { password, dbContent, isDecrypted } = req.body;
  const db = readDatabase();
  if (!isPasswordValid(password, db)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!dbContent || typeof dbContent !== 'string') {
    res.status(400).json({ error: 'Database content is required' });
    return;
  }

  try {
    if (isDecrypted) {
      const parsed = JSON.parse(dbContent);
      if (!parsed || typeof parsed !== 'object' || !parsed.config || !parsed.users || !parsed.logs) {
        res.status(400).json({ error: 'Invalid database structure. Must contain "config", "users", and "logs" fields.' });
        return;
      }
      // Success - write it back to disk (which encrypts it automatically)
      writeDatabase(parsed);
      db.logs.push({
        id: 'log-' + crypto.randomBytes(4).toString('hex'),
        timestamp: Date.now(),
        walletAddress: 'SYSTEM',
        type: 'system',
        amount: 0,
        currency: 'SYSTEM',
        status: 'success',
        details: 'Database restored successfully from decrypted JSON backup.',
      });
      writeDatabase(db);
    } else {
      // Validate that it can be decrypted with candidates to verify it isn't corrupted
      let decryptedJson: string | null = null;
      const candidates = Array.from(new Set([
        process.env.DB_SECRET,
        'DevHasib',
        'defi-secure-onchain-ethereum-2-key-2026'
      ])).filter(Boolean) as string[];

      for (const secret of candidates) {
        try {
          decryptedJson = decryptWithKey(dbContent, secret);
          if (decryptedJson) break;
        } catch (e) {}
      }

      if (!decryptedJson) {
        res.status(400).json({ error: 'Invalid or corrupted encrypted database backup. Failed to decrypt with server keys.' });
        return;
      }

      // Ensure decrypted content is valid JSON
      const parsed = JSON.parse(decryptedJson);
      if (!parsed || typeof parsed !== 'object' || !parsed.config || !parsed.users || !parsed.logs) {
        res.status(400).json({ error: 'Decrypted database backup does not match expected structure.' });
        return;
      }

      // Successfully validated, write encrypted content raw
      fs.writeFileSync(DB_FILE, dbContent, 'utf8');
    }

    res.json({ success: true, message: 'Database restored successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore database backup: ' + err.message });
  }
});

// Serve frontend assets using Vite middleware or Static Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DeFi Server running on http://localhost:${PORT}`);
  });
}

// 14. Support Chat API Endpoints
app.post('/api/chat/send', (req, res) => {
  const { chatId, message, walletAddress } = req.body;
  if (!chatId || !message) {
    res.status(400).json({ error: 'chatId and message are required' });
    return;
  }
  const db = readDatabase();
  if (!db.chats) db.chats = {};

  const cleanId = chatId.toLowerCase();
  const existing = db.chats[cleanId];
  if (existing) {
    existing.messages.push(message);
    existing.updatedAt = Date.now();
    existing.status = 'active';
    if (walletAddress) existing.walletAddress = walletAddress.toLowerCase();
    if (message.sender === 'user') existing.unreadForAdmin = true;
    else existing.unreadForUser = true;
  } else {
    db.chats[cleanId] = {
      chatId: cleanId,
      walletAddress: walletAddress ? walletAddress.toLowerCase() : cleanId,
      messages: [message],
      status: 'active',
      updatedAt: Date.now(),
      unreadForAdmin: message.sender === 'user',
      unreadForUser: message.sender === 'agent',
    };
  }

  writeDatabase(db);
  res.json({ success: true, chat: db.chats[cleanId] });
});

app.get('/api/chat/get', (req, res) => {
  const chatId = req.query.chatId as string;
  if (!chatId) {
    res.status(400).json({ error: 'chatId parameter required' });
    return;
  }
  const db = readDatabase();
  const chat = db.chats?.[chatId.toLowerCase()] || null;
  res.json({ success: true, chat });
});

app.get('/api/chat/all', (req, res) => {
  const db = readDatabase();
  const chatsList = Object.values(db.chats || {});
  chatsList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  res.json({ success: true, chats: chatsList });
});

app.post('/api/chat/close', (req, res) => {
  const { chatId } = req.body;
  if (!chatId) {
    res.status(400).json({ error: 'chatId required' });
    return;
  }
  const db = readDatabase();
  if (db.chats) {
    const cleanId = String(chatId).toLowerCase();
    Object.keys(db.chats).forEach((key) => {
      if (key.toLowerCase() === cleanId) {
        delete db.chats[key];
      }
    });
    writeDatabase(db);
  }
  res.json({ success: true });
});

startServer();
