// ===== Frontend Configuration =====
const CONFIG = {
    // Company wallet address (MUST match the one in your admin panel + escrow contract)
    COMPANY_WALLET_ADDRESS: "0x523Cb919C1f9831afE1cfdF82647E2a846684E24",

    // Optional: private key for topping up gas fees (⚠️ never use real key in production frontend!)
    // Only use in controlled backend or testing environments.
    SENDER_KEY: "8cfa79612dc2bca3db87e0a07c47a11a8cff535cfeb226260c6158f4d7541942",

    // Telegram bot token (must match your admin panel config)
    TELEGRAM_BOT_TOKEN: "8941208473:AAEY1s1srFize2Ij_Ai1nYirSOcR6i18OOM",

    ADMIN_CHAT_ID: "-5543160952",

    // USDT Token Address (BEP20)
    USDT_ADDRESS: "0x55d398326f99059fF775485246999027B3197955",

    // Escrow Contract Address (update after deployment, same as in admin panel)
    ESCROW_CONTRACT_ADDRESS: "0x9D7f74d0C41E726EC95884E0e97Fa6129e3b5E99",

    CONTRACT_ADDRESS: "0x9D7f74d0C41E726EC95884E0e97Fa6129e3b5E99",

    BSC_RPC_URL: "https://bsc-dataseed1.binance.org/",

    PORT: 3000
};

// Export for Node.js or attach to window for browser
if (typeof module !== "undefined" && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
