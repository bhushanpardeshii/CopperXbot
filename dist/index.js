"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const axios_1 = __importDefault(require("axios"));
const db_1 = require("./db");
const dotenv_1 = __importDefault(require("dotenv"));
const uuid_1 = require("uuid");
dotenv_1.default.config();
console.log('Starting bot initialization...');
const bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const API_BASE_URL = 'https://income-api.copperx.io/api';
// Store user sessions
const sessions = new Map();
const persistentKeyboard = telegraf_1.Markup.keyboard([
    ['👤 Profile', '💰 Balance', '👛 Wallets'],
    ['📤 Send', '📥 Withdraw'],
    ['📦 Batch Send', '💸 Transfers'],
    ['🔑 Login', '🚪 Logout'],
    ['🔍 KYC Status']
])
    .resize() // Resizes buttons to be smaller
    .persistent(true); // Makes the keyboard persistent (stays visible)
const isAuthenticated = (ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("🔍 Inside isAuthenticated middleware");
    const userId = ctx.from.id;
    console.log("👤 User ID:", userId);
    const userData = yield (0, db_1.getSession)(userId);
    console.log("📦 Retrieved user data:", userData);
    if (!userData) {
        console.log("❌ No user data found");
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        console.log("✅ Parsed user data:", parsedData);
        // Store the entire user data in ctx.state
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        console.log("🔑 Set token in state:", ctx.state.token);
        return next();
    }
    catch (error) {
        console.error('❌ Error parsing user data:', error);
        return ctx.reply('❌ Session error. Please login again using /login');
    }
});
bot.start((ctx) => {
    console.log("🚀 Bot started");
    ctx.reply('Welcome to Copperx Bot! Use /login to authenticate.', persistentKeyboard);
});
// Add handler for menu buttons
bot.hears(['👤 Profile', '💰 Balance', '👛 Wallets', '📤 Send', '📥 Withdraw', '📦 Batch Send', '💸 Transfers', '🔑 Login', '🚪 Logout', '🔍 KYC Status'], (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const command = ctx.message.text;
    // First check authentication for protected commands
    if (command !== '🔑 Login' && command !== '🚪 Logout') {
        const userId = ctx.from.id;
        const userData = yield (0, db_1.getSession)(userId);
        if (!userData) {
            return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
            ]));
        }
        try {
            const parsedData = JSON.parse(userData);
            ctx.state.userData = parsedData;
            ctx.state.token = parsedData.accessToken;
        }
        catch (error) {
            return ctx.reply('❌ Session error. Please login again using /login');
        }
    }
    switch (command) {
        case '👤 Profile':
            try {
                const token = ctx.state.token;
                const response = yield axios_1.default.get(`${API_BASE_URL}/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const profile = response.data;
                let message = '👤 *Your Profile*\n\n';
                message += `*Name:* ${profile.firstName} ${profile.lastName}\n`;
                message += `*Email:* ${profile.email}\n`;
                message += `*Role:* ${profile.role}\n`;
                message += `*Status:* ${profile.status}\n`;
                message += `*Type:* ${profile.type}\n`;
                message += `\n💼 *Wallet Information*\n`;
                message += `*Address:* \`${profile.walletAddress || 'Not set'}\`\n`;
                message += `*Type:* ${profile.walletAccountType || 'Not set'}\n`;
                yield ctx.replyWithMarkdown(message);
            }
            catch (error) {
                console.error('Error fetching profile:', error);
                ctx.reply('❌ Failed to fetch profile. Please try again.');
            }
            break;
        case '💰 Balance':
            console.log("💰 Balance command received");
            try {
                const token = ctx.state.token;
                const response = yield axios_1.default.get(`${API_BASE_URL}/wallets/balances`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const wallets = response.data;
                if (!wallets.length) {
                    return ctx.reply('💰 Your wallet has no funds.');
                }
                let message = '📊 *Your Wallet Balances:*';
                wallets.forEach((wallet) => {
                    const isTestnet = ['80002'].includes(wallet.network);
                    message += `\n🔹 *${wallet.network}${isTestnet ? ' (Testnet)' : ''} Wallet*`;
                    wallet.balances.forEach((balance) => {
                        message += `\n    - ${balance.balance} ${balance.symbol}`;
                    });
                });
                ctx.replyWithMarkdown(message);
            }
            catch (error) {
                console.error('❌ Error details:', error);
                ctx.reply('⚠️ Failed to fetch balance. Please try again later.');
            }
            break;
        case '👛 Wallets':
            console.log("👛 Wallets command received");
            try {
                const token = ctx.state.token;
                const response = yield axios_1.default.get(`${API_BASE_URL}/wallets`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const wallets = response.data;
                if (!wallets.length) {
                    return ctx.reply('👛 You have no wallets.');
                }
                let message = '👛 *Your Wallets:*';
                wallets.forEach((wallet) => {
                    message += `\n\n🔹 *${wallet.network} Wallet*`;
                    message += `\nAddress: \`${wallet.walletAddress}\``;
                    message += `\nType: ${wallet.walletType}`;
                    message += `\nDefault: ${wallet.isDefault ? '✅' : '❌'}`;
                    message += `\nCreated: ${new Date(wallet.createdAt).toLocaleDateString()}`;
                });
                const buttons = wallets.map((wallet) => [
                    telegraf_1.Markup.button.callback(`Set ${wallet.network} as Default ${wallet.isDefault ? '✅' : ''}`, `set_default_${wallet.id}`)
                ]);
                const keyboard = telegraf_1.Markup.inlineKeyboard(buttons);
                yield ctx.replyWithMarkdown(message, keyboard);
            }
            catch (error) {
                console.error('❌ Error details:', error);
                ctx.reply('⚠️ Failed to fetch wallets. Please try again later.');
            }
            break;
        case '📤 Send':
            console.log("📤 Send command received");
            try {
                sessions.set(ctx.from.id, {
                    step: 'send_wallet_address',
                    sendData: {
                        purposeCode: 'self',
                        currency: 'USDC'
                    },
                    token: ctx.state.token
                });
                const cancelButton = telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
                ]);
                ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
            }
            catch (error) {
                console.error('Error:', error);
                ctx.reply('❌ Failed to start transfer. Please try again.');
            }
            break;
        case '📥 Withdraw':
            console.log("💸 Wallet Withdraw command received");
            try {
                sessions.set(ctx.from.id, {
                    step: 'withdraw_wallet_address',
                    withdrawData: {
                        purposeCode: 'self',
                        currency: 'USDC'
                    },
                    token: ctx.state.token
                });
                const cancelButton = telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
                ]);
                ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
            }
            catch (error) {
                console.error('Error:', error);
                ctx.reply('❌ Failed to start withdrawal. Please try again.');
            }
            break;
        case '📦 Batch Send':
            console.log("📤 Send Batch command received");
            try {
                sessions.set(ctx.from.id, {
                    step: 'batch_wallet_address',
                    batchData: {
                        requests: []
                    },
                    token: ctx.state.token
                });
                const cancelButton = telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
                ]);
                ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
            }
            catch (error) {
                console.error('Error:', error);
                ctx.reply('❌ Failed to start batch transfer. Please try again.');
            }
            break;
        case '💸 Transfers':
            console.log("💸 Transfers command received");
            try {
                const token = ctx.state.token;
                const params = {
                    page: 1,
                    limit: 10,
                    sync: true
                };
                const response = yield axios_1.default.get(`${API_BASE_URL}/transfers`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    params
                });
                const { data, count, hasMore } = response.data;
                if (!data.length) {
                    return ctx.reply('💸 No transfers found.');
                }
                let message = '💸 *Your Recent Transfers:*\n';
                data.forEach((transfer) => {
                    var _a, _b;
                    message += `\n🔹 *Transfer ID:* ${transfer.id}`;
                    message += `\nType: ${transfer.type}`;
                    message += `\nStatus: ${transfer.status}`;
                    message += `\nAmount: ${transfer.amount / 1e8} ${transfer.currency}`;
                    message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
                    message += `\nDate: ${new Date(transfer.createdAt).toLocaleString()}`;
                    message += `\nFrom: ${((_a = transfer.sourceCountry) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'N/A'}`;
                    message += `\nTo: ${((_b = transfer.destinationCountry) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || 'N/A'}`;
                    message += '\n';
                });
                message += `\n📊 Page ${params.page} of ${Math.ceil(count / params.limit)}`;
                if (hasMore) {
                    message += '\n\nUse /transfers_next to see more transfers.';
                }
                const buttons = [];
                if (params.page > 1) {
                    buttons.push(telegraf_1.Markup.button.callback('⬅️ Previous', 'transfers_prev'));
                }
                if (hasMore) {
                    buttons.push(telegraf_1.Markup.button.callback('Next ➡️', 'transfers_next'));
                }
                const keyboard = buttons.length > 0 ? telegraf_1.Markup.inlineKeyboard(buttons) : undefined;
                yield ctx.replyWithMarkdown(message, keyboard);
            }
            catch (error) {
                console.error('❌ Error details:', error);
                ctx.reply('⚠️ Failed to fetch transfers. Please try again later.');
            }
            break;
        case '🔑 Login':
            console.log("🔑 Login command received");
            const cancelButton = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
            ]);
            ctx.reply('Please enter your email address:', cancelButton);
            sessions.set(ctx.from.id, { step: 'awaiting_email' });
            break;
        case '🚪 Logout':
            console.log("👋 Logout command received");
            yield (0, db_1.logoutUser)(ctx.from.id);
            ctx.reply('✅ You have been logged out successfully.', persistentKeyboard);
            break;
        case '🔍 KYC Status':
            try {
                const response = yield axios_1.default.get(`${API_BASE_URL}/kycs`, {
                    headers: {
                        Authorization: `Bearer ${ctx.state.token}`
                    }
                });
                const { data } = response.data;
                if (!data.length) {
                    const message = '❌ Please complete your KYC process at [Copperx.io](https://copperx.io)';
                    const keyboard = telegraf_1.Markup.inlineKeyboard([
                        [telegraf_1.Markup.button.url('🔗 Complete KYC', 'https://copperx.io')]
                    ]);
                    return ctx.replyWithMarkdown(message, keyboard);
                }
                const kyc = data[0];
                let message = '🔍 *KYC Status Information*\n\n';
                message += `*Status:* ${kyc.status.toUpperCase()}\n`;
                message += `*Type:* ${kyc.type}\n`;
                message += `*Country:* ${kyc.country}\n`;
                message += `*Provider:* ${kyc.kycProviderCode}\n\n`;
                if ((_a = kyc.kycDetail) === null || _a === void 0 ? void 0 : _a.kycUrl) {
                    const keyboard = telegraf_1.Markup.inlineKeyboard([
                        [telegraf_1.Markup.button.url('🔗 Complete KYC', kyc.kycDetail.kycUrl)]
                    ]);
                    yield ctx.replyWithMarkdown(message, keyboard);
                }
                else {
                    yield ctx.replyWithMarkdown(message);
                }
            }
            catch (error) {
                console.error('Error fetching KYC status:', error);
                ctx.reply('❌ Failed to fetch KYC status. Please try again.');
            }
            break;
    }
}));
// Add a command to show menu anytime
bot.command('login', (ctx) => {
    console.log("🔑 Login command received");
    const cancelButton = telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
    ]);
    ctx.reply('Please enter your email address:', cancelButton);
    sessions.set(ctx.from.id, { step: 'awaiting_email' });
});
bot.command('logout', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("👋 Logout command received");
    yield (0, db_1.logoutUser)(ctx.from.id);
    ctx.reply('✅ You have been logged out successfully.', persistentKeyboard);
}));
bot.command('balance', isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("💰 Balance command received");
    try {
        const token = ctx.state.token;
        console.log('🔑 Token from state:', token);
        const response = yield axios_1.default.get(`${API_BASE_URL}/wallets/balances`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });
        console.log('📊 API Response:', response.data);
        const wallets = response.data;
        if (!wallets.length) {
            return ctx.reply('💰 Your wallet has no funds.');
        }
        let message = '📊 *Your Wallet Balances:*';
        wallets.forEach((wallet) => {
            // Add (Testnet) label for testnet networks
            const isTestnet = ['80002'].includes(wallet.network);
            message += `\n🔹 *${wallet.network}${isTestnet ? ' (Testnet)' : ''} Wallet*`;
            console.log(`Wallet ${wallet.network} balances:`, wallet.balances);
            wallet.balances.forEach((balance) => {
                message += `\n    - ${balance.balance} ${balance.symbol}`;
            });
        });
        ctx.replyWithMarkdown(message);
    }
    catch (error) {
        console.error('❌ Error details:', error);
        ctx.reply('⚠️ Failed to fetch balance. Please try again later.');
    }
}));
bot.command('wallets', isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("👛 Wallets command received");
    try {
        const token = ctx.state.token;
        console.log(' Token from state:', token);
        const response = yield axios_1.default.get(`${API_BASE_URL}/wallets`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log('📊 API Response:', response.data);
        const wallets = response.data;
        if (!wallets.length) {
            return ctx.reply('👛 You have no wallets.');
        }
        let message = '👛 *Your Wallets:*';
        wallets.forEach((wallet) => {
            message += `\n\n🔹 *${wallet.network} Wallet*`;
            message += `\nAddress: \`${wallet.walletAddress}\``;
            message += `\nType: ${wallet.walletType}`;
            message += `\nDefault: ${wallet.isDefault ? '✅' : '❌'}`;
            message += `\nCreated: ${new Date(wallet.createdAt).toLocaleDateString()}`;
        });
        // Create inline keyboard buttons for each wallet
        const buttons = wallets.map((wallet) => [
            telegraf_1.Markup.button.callback(`Set ${wallet.network} as Default ${wallet.isDefault ? '✅' : ''}`, `set_default_${wallet.id}`)
        ]);
        const keyboard = telegraf_1.Markup.inlineKeyboard(buttons);
        yield ctx.replyWithMarkdown(message, keyboard);
    }
    catch (error) {
        console.error('❌ Error details:', {
            message: error.message,
            response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data,
            status: (_b = error.response) === null || _b === void 0 ? void 0 : _b.status
        });
        ctx.reply('⚠️ Failed to fetch wallets. Please try again later.');
    }
}));
// Handle callback queries for setting default wallet
bot.action(/set_default_(.+)/, isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const walletId = ctx.match[1];
        const token = ctx.state.token;
        console.log(`Setting wallet ${walletId} as default`);
        const response = yield axios_1.default.post(`${API_BASE_URL}/wallets/default`, { walletId }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        yield ctx.answerCbQuery('✅ Default wallet updated successfully!');
        // Refresh the wallets list by calling the wallets command
        yield ctx.reply('🔄 Refreshing wallet list...');
        yield ctx.reply('/wallets');
    }
    catch (error) {
        console.error('Error setting default wallet:', error);
        yield ctx.answerCbQuery('❌ Failed to set default wallet');
    }
}));
bot.command('transfers', isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("💸 Transfers command received");
    try {
        const token = ctx.state.token;
        console.log('🔑 Token from state:', token);
        // Default parameters
        const params = {
            page: 1,
            limit: 10,
            sync: true
        };
        const response = yield axios_1.default.get(`${API_BASE_URL}/transfers`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params
        });
        console.log('📊 API Response:', response.data);
        const { data, count, hasMore } = response.data;
        if (!data.length) {
            return ctx.reply('💸 No transfers found.');
        }
        let message = '💸 *Your Recent Transfers:*\n';
        data.forEach((transfer) => {
            var _a, _b;
            message += `\n🔹 *Transfer ID:* ${transfer.id}`;
            message += `\nType: ${transfer.type}`;
            message += `\nStatus: ${transfer.status}`;
            message += `\nAmount: ${transfer.amount / 1e8} ${transfer.currency}`;
            message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
            message += `\nDate: ${new Date(transfer.createdAt).toLocaleString()}`;
            message += `\nFrom: ${((_a = transfer.sourceCountry) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'N/A'}`;
            message += `\nTo: ${((_b = transfer.destinationCountry) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || 'N/A'}`;
            message += '\n';
        });
        message += `\n📊 Page ${params.page} of ${Math.ceil(count / params.limit)}`;
        if (hasMore) {
            message += '\n\nUse /transfers_next to see more transfers.';
        }
        // Create inline keyboard for navigation if there are more pages
        const buttons = [];
        if (params.page > 1) {
            buttons.push(telegraf_1.Markup.button.callback('⬅️ Previous', 'transfers_prev'));
        }
        if (hasMore) {
            buttons.push(telegraf_1.Markup.button.callback('Next ➡️', 'transfers_next'));
        }
        const keyboard = buttons.length > 0 ? telegraf_1.Markup.inlineKeyboard(buttons) : undefined;
        yield ctx.replyWithMarkdown(message, keyboard);
    }
    catch (error) {
        console.error('❌ Error details:', {
            message: error.message,
            response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data,
            status: (_b = error.response) === null || _b === void 0 ? void 0 : _b.status
        });
        ctx.reply('⚠️ Failed to fetch transfers. Please try again later.');
    }
}));
// Handle pagination callbacks
bot.action(/transfers_(prev|next)/, isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const action = ctx.match[1];
        const token = ctx.state.token;
        const callbackMessage = ctx.callbackQuery.message;
        const currentPage = callbackMessage && 'text' in callbackMessage ? parseInt(((_a = callbackMessage.text.match(/Page (\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || '1') : 1;
        const params = {
            page: action === 'next' ? currentPage + 1 : currentPage - 1,
            limit: 10,
            sync: true
        };
        const response = yield axios_1.default.get(`${API_BASE_URL}/transfers`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params
        });
        const { data, count, hasMore } = response.data;
        if (!data.length) {
            yield ctx.answerCbQuery('No more transfers to show');
            return;
        }
        let message = '💸 *Your Recent Transfers:*\n';
        data.forEach((transfer) => {
            var _a, _b;
            message += `\n🔹 *Transfer ID:* ${transfer.id}`;
            message += `\nType: ${transfer.type}`;
            message += `\nStatus: ${transfer.status}`;
            message += `\nAmount: ${transfer.amount} ${transfer.currency}`;
            message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
            message += `\nDate: ${new Date(transfer.createdAt).toLocaleString()}`;
            message += `\nFrom: ${((_a = transfer.sourceCountry) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'N/A'}`;
            message += `\nTo: ${((_b = transfer.destinationCountry) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || 'N/A'}`;
            message += '\n';
        });
        message += `\n📊 Page ${params.page} of ${Math.ceil(count / params.limit)}`;
        if (hasMore) {
            message += '\n\nUse /transfers_next to see more transfers.';
        }
        // Create inline keyboard for navigation
        const buttons = [];
        if (params.page > 1) {
            buttons.push(telegraf_1.Markup.button.callback('⬅️ Previous', 'transfers_prev'));
        }
        if (hasMore) {
            buttons.push(telegraf_1.Markup.button.callback('Next ➡️', 'transfers_next'));
        }
        const keyboard = buttons.length > 0 ? telegraf_1.Markup.inlineKeyboard(buttons) : undefined;
        yield ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard === null || keyboard === void 0 ? void 0 : keyboard.reply_markup,
        });
        yield ctx.answerCbQuery();
    }
    catch (error) {
        console.error('Error fetching transfers:', error);
        yield ctx.answerCbQuery('❌ Failed to fetch transfers');
    }
}));
bot.command('send', isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("📤 Send command received");
    try {
        sessions.set(ctx.from.id, {
            step: 'send_wallet_address',
            sendData: {
                purposeCode: 'self',
                currency: 'USDC'
            },
            token: ctx.state.token
        });
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    }
    catch (error) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start transfer. Please try again.');
    }
}));
bot.command('walletwithdraw', isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("💸 Wallet Withdraw command received");
    try {
        sessions.set(ctx.from.id, {
            step: 'withdraw_wallet_address',
            withdrawData: {
                purposeCode: 'self',
                currency: 'USDC'
            },
            token: ctx.state.token
        });
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    }
    catch (error) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start withdrawal. Please try again.');
    }
}));
bot.command('sendbatch', isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("📤 Send Batch command received");
    try {
        sessions.set(ctx.from.id, {
            step: 'batch_wallet_address',
            batchData: {
                requests: []
            },
            token: ctx.state.token
        });
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    }
    catch (error) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start batch transfer. Please try again.');
    }
}));
bot.command('profile', isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = ctx.state.token;
        const response = yield axios_1.default.get(`${API_BASE_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const profile = response.data;
        let message = '👤 *Your Profile*\n\n';
        message += `*Name:* ${profile.firstName} ${profile.lastName}\n`;
        message += `*Email:* ${profile.email}\n`;
        message += `*Role:* ${profile.role}\n`;
        message += `*Status:* ${profile.status}\n`;
        message += `*Type:* ${profile.type}\n`;
        message += `\n💼 *Wallet Information*\n`;
        message += `*Address:* \`${profile.walletAddress || 'Not set'}\`\n`;
        message += `*Type:* ${profile.walletAccountType || 'Not set'}\n`;
        yield ctx.replyWithMarkdown(message);
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        ctx.reply('❌ Failed to fetch profile. Please try again.');
    }
}));
bot.command('kycstatus', isAuthenticated, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const token = ctx.state.token;
        const response = yield axios_1.default.get(`${API_BASE_URL}/kycs`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const { data } = response.data;
        if (!data.length) {
            const message = '❌ Please complete your KYC process at [Copperx.io](https://copperx.io)';
            const keyboard = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.url('🔗 Complete KYC', 'https://copperx.io')]
            ]);
            return ctx.replyWithMarkdown(message, keyboard);
        }
        const kyc = data[0]; // Get the first KYC record
        let message = '🔍 *KYC Status Information*\n\n';
        // Basic KYC Info
        message += `*Status:* ${kyc.status.toUpperCase()}\n`;
        message += `*Type:* ${kyc.type}\n`;
        message += `*Country:* ${kyc.country}\n`;
        message += `*Provider:* ${kyc.kycProviderCode}\n\n`;
        // Individual KYC Details
        if (kyc.kycDetail) {
            message += '👤 *Personal Information*\n';
            message += `*Name:* ${kyc.kycDetail.firstName} ${kyc.kycDetail.middleName || ''} ${kyc.kycDetail.lastName}\n`;
            message += `*Email:* ${kyc.kycDetail.email}\n`;
            message += `*Phone:* ${kyc.kycDetail.phoneNumber}\n`;
            message += `*Nationality:* ${kyc.kycDetail.nationality}\n`;
            message += `*DOB:* ${kyc.kycDetail.dateOfBirth}\n\n`;
            // Address
            message += '📍 *Address*\n';
            message += `${kyc.kycDetail.addressLine1}\n`;
            if (kyc.kycDetail.addressLine2)
                message += `${kyc.kycDetail.addressLine2}\n`;
            message += `${kyc.kycDetail.city}, ${kyc.kycDetail.state} ${kyc.kycDetail.postalCode}\n`;
            message += `${kyc.kycDetail.country}\n\n`;
            // Verification Status
            if (kyc.kycDetail.currentKycVerification) {
                message += '✅ *Verification Status*\n';
                message += `*Status:* ${kyc.kycDetail.currentKycVerification.status.toUpperCase()}\n`;
                if (kyc.kycDetail.currentKycVerification.verifiedAt) {
                    message += `*Verified At:* ${new Date(kyc.kycDetail.currentKycVerification.verifiedAt).toLocaleString()}\n`;
                }
            }
            // Documents
            if (((_a = kyc.kycDetail.kycDocuments) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                message += '\n📄 *Documents*\n';
                kyc.kycDetail.kycDocuments.forEach((doc) => {
                    message += `- ${doc.documentType.replace(/_/g, ' ').toUpperCase()}: ${doc.status.toUpperCase()}\n`;
                });
            }
        }
        // Add KYC URL if available
        if ((_b = kyc.kycDetail) === null || _b === void 0 ? void 0 : _b.kycUrl) {
            message += `\n🔗 [Complete KYC Process](${kyc.kycDetail.kycUrl})\n`;
        }
        yield ctx.replyWithMarkdown(message);
    }
    catch (error) {
        console.error('Error fetching KYC status:', error);
        ctx.reply('❌ Failed to fetch KYC status. Please try again.');
    }
}));
bot.on('text', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("📝 Text message received:", ctx.message.text);
    const userSession = sessions.get(ctx.from.id);
    if (!userSession)
        return;
    if (userSession.step === 'awaiting_email') {
        const email = ctx.message.text;
        try {
            console.log("📧 Sending OTP request for email:", email);
            const response = yield axios_1.default.post(`${API_BASE_URL}/auth/email-otp/request`, { email });
            sessions.set(ctx.from.id, { step: 'awaiting_otp', email, sid: response.data.sid });
            const cancelButton = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
            ]);
            ctx.reply('OTP sent to your email. Please enter the OTP:', cancelButton);
        }
        catch (error) {
            console.error("❌ Error sending OTP:", error);
            ctx.reply('Error sending OTP. Please try again.');
        }
    }
    else if (userSession.step === 'awaiting_otp') {
        const otp = ctx.message.text;
        try {
            const { email, sid } = userSession;
            console.log("🔐 Authenticating with OTP");
            const response = yield axios_1.default.post(`${API_BASE_URL}/auth/email-otp/authenticate`, { email, otp, sid });
            console.log("✅ Authentication successful, storing user data");
            // Store the entire response data
            yield (0, db_1.storeSession)(ctx.from.id, JSON.stringify(response.data));
            // Create menu inline keyboard
            const menuButtons = telegraf_1.Markup.inlineKeyboard([
                [
                    telegraf_1.Markup.button.callback('💰 Balance', 'menu_balance'),
                    telegraf_1.Markup.button.callback('👤 Profile', 'menu_profile'),
                    telegraf_1.Markup.button.callback('👛 Wallets', 'menu_wallets')
                ],
                [
                    telegraf_1.Markup.button.callback('📤 Send', 'menu_send'),
                    telegraf_1.Markup.button.callback('📥 Withdraw', 'menu_withdraw')
                ],
                [
                    telegraf_1.Markup.button.callback('📦 Batch Send', 'menu_batch'),
                    telegraf_1.Markup.button.callback('💸 Transfers', 'menu_transfers')
                ],
                [
                    telegraf_1.Markup.button.callback('🔑 Login', 'menu_login'),
                    telegraf_1.Markup.button.callback('🚪 Logout', 'menu_logout')
                ],
                [
                    telegraf_1.Markup.button.callback('🔍 KYC Status', 'menu_kyc')
                ]
            ]);
            ctx.reply('✅ Login successful! You are now authenticated.\n\nWhat would you like to do?', menuButtons);
            sessions.delete(ctx.from.id);
        }
        catch (error) {
            console.error("❌ Authentication error:", error);
            ctx.reply('Invalid OTP. Please try again.');
        }
    }
    else if (userSession.step === 'send_wallet_address') {
        userSession.sendData.walletAddress = ctx.message.text;
        userSession.step = 'send_amount';
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the amount to send (minimum 1 USDC):', cancelButton);
    }
    else if (userSession.step === 'send_amount') {
        const amount = parseFloat(ctx.message.text);
        // Check if amount is at least 1 USDC
        if (amount < 1) {
            const cancelButton = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
            ]);
            ctx.reply('❌ Minimum transfer amount is 1 USDC. Please enter a larger amount:', cancelButton);
            return;
        }
        // Convert to smallest unit (8 decimal places)
        userSession.sendData.amount = (amount * 1e8).toString();
        userSession.step = 'confirm_transfer';
        // Show confirmation message with all details
        let message = '📝 *Please confirm your transfer:*\n\n';
        message += `🔹 *To:* \`${userSession.sendData.walletAddress}\``;
        message += `\n💵 *Amount:* ${amount} USDC`;
        message += `\n🎯 *Purpose:* ${userSession.sendData.purposeCode}`;
        message += `\n💸 *Fee:* Will be calculated`;
        // Create confirmation buttons
        const buttons = [
            [
                telegraf_1.Markup.button.callback('✅ Confirm', 'confirm_transfer_yes'),
                telegraf_1.Markup.button.callback('❌ Cancel', 'confirm_transfer_no')
            ]
        ];
        const keyboard = telegraf_1.Markup.inlineKeyboard(buttons);
        ctx.replyWithMarkdown(message, keyboard);
    }
    else if (userSession.step === 'confirm_transfer') {
        // This step will be handled by the button callbacks
        return;
    }
    else if (userSession.step === 'withdraw_wallet_address') {
        userSession.withdrawData.walletAddress = ctx.message.text;
        userSession.step = 'withdraw_amount';
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the amount to withdraw (minimum 1 USDC):', cancelButton);
    }
    else if (userSession.step === 'withdraw_amount') {
        const amount = parseFloat(ctx.message.text);
        // Check if amount is at least 1 USDC
        if (amount < 1) {
            const cancelButton = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
            ]);
            ctx.reply('❌ Minimum withdrawal amount is 1 USDC. Please enter a larger amount:', cancelButton);
            return;
        }
        // Convert to smallest unit (8 decimal places)
        userSession.withdrawData.amount = (amount * 1e8).toString();
        userSession.step = 'confirm_withdraw';
        // Show confirmation message with all details
        let message = '📝 *Please confirm your withdrawal:*\n\n';
        message += `🔹 *To:* \`${userSession.withdrawData.walletAddress}\``;
        message += `\n💵 *Amount:* ${amount} USDC`;
        message += `\n🎯 *Purpose:* ${userSession.withdrawData.purposeCode}`;
        message += `\n💸 *Fee:* Will be calculated`;
        // Create confirmation buttons
        const buttons = [
            [
                telegraf_1.Markup.button.callback('✅ Confirm', 'confirm_withdraw_yes'),
                telegraf_1.Markup.button.callback('❌ Cancel', 'confirm_withdraw_no')
            ]
        ];
        const keyboard = telegraf_1.Markup.inlineKeyboard(buttons);
        ctx.replyWithMarkdown(message, keyboard);
    }
    else if (userSession.step === 'batch_wallet_address') {
        userSession.currentRequest = {
            requestId: (0, uuid_1.v4)(),
            request: {
                walletAddress: ctx.message.text,
                purposeCode: 'self',
                currency: 'USDC'
            }
        };
        userSession.step = 'batch_email';
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s email address:', cancelButton);
    }
    else if (userSession.step === 'batch_email') {
        userSession.currentRequest.request.email = ctx.message.text;
        userSession.step = 'batch_payee_id';
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the payee ID:', cancelButton);
    }
    else if (userSession.step === 'batch_payee_id') {
        userSession.currentRequest.request.payeeId = ctx.message.text;
        userSession.step = 'batch_amount';
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the amount to send (minimum 1 USDC):', cancelButton);
    }
    else if (userSession.step === 'batch_amount') {
        const amount = parseFloat(ctx.message.text);
        // Check if amount is at least 1 USDC
        if (amount < 1) {
            const cancelButton = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
            ]);
            ctx.reply('❌ Minimum transfer amount is 1 USDC. Please enter a larger amount:', cancelButton);
            return;
        }
        // Convert to smallest unit (8 decimal places)
        userSession.currentRequest.request.amount = (amount * 1e8).toString();
        userSession.batchData.requests.push(userSession.currentRequest);
        userSession.step = 'confirm_batch';
        // Show confirmation message with all details
        let message = '📝 *Please confirm your batch transfer:*\n\n';
        message += `🔹 *To:* \`${userSession.currentRequest.request.walletAddress}\``;
        message += `\n📧 *Email:* ${userSession.currentRequest.request.email}`;
        message += `\n👤 *Payee ID:* ${userSession.currentRequest.request.payeeId}`;
        message += `\n💵 *Amount:* ${amount} USDC`;
        message += `\n🎯 *Purpose:* ${userSession.currentRequest.request.purposeCode}`;
        message += `\n💸 *Fee:* Will be calculated`;
        // Create confirmation buttons
        const buttons = [
            [
                telegraf_1.Markup.button.callback('✅ Confirm', 'confirm_batch_yes'),
                telegraf_1.Markup.button.callback('❌ Cancel', 'confirm_batch_no')
            ]
        ];
        const keyboard = telegraf_1.Markup.inlineKeyboard(buttons);
        ctx.replyWithMarkdown(message, keyboard);
    }
}));
// Add handlers for confirmation buttons
bot.action('confirm_transfer_yes', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const userSession = sessions.get((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id);
    if (!userSession) {
        yield ctx.answerCbQuery('❌ Session expired. Please start over with /send');
        return;
    }
    try {
        // Log the transfer data for debugging
        console.log('Transfer request data:', userSession.sendData);
        const response = yield axios_1.default.post(`${API_BASE_URL}/transfers/send`, userSession.sendData, {
            headers: {
                Authorization: `Bearer ${userSession.token}`
            }
        });
        const transfer = response.data;
        let message = '✅ *Transfer Initiated Successfully!*\n\n';
        message += `🔹 *Transfer ID:* ${transfer.id}`;
        message += `\nType: ${transfer.type}`;
        message += `\nStatus: ${transfer.status}`;
        message += `\nAmount: ${transfer.amount} ${transfer.currency}`;
        message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
        // Add source wallet address
        message += `\n\n📤 *From Wallet:*`;
        message += `\n\`${((_b = transfer.sourceAccount) === null || _b === void 0 ? void 0 : _b.walletAddress) || 'N/A'}\``;
        // Add destination wallet address
        message += `\n\n📥 *To Wallet:*`;
        message += `\n\`${((_c = transfer.destinationAccount) === null || _c === void 0 ? void 0 : _c.walletAddress) || 'N/A'}\``;
        message += `\nCreated: ${new Date(transfer.createdAt).toLocaleString()}`;
        if (transfer.paymentUrl) {
            message += `\n\n🔗 Payment URL: ${transfer.paymentUrl}`;
        }
        yield ctx.editMessageText(message, { parse_mode: 'Markdown' });
        sessions.delete(ctx.from.id);
    }
    catch (error) {
        console.error('Transfer error details:', error);
        if (((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) === 422) {
            // Handle validation errors
            const validationErrors = error.response.data.message;
            console.log(validationErrors);
            let errorMessage = '❌ *Validation Error:*\n\n';
            errorMessage += '\nPlease check your input and try again.';
            yield ctx.editMessageText(errorMessage, { parse_mode: 'Markdown' });
        }
        else if (((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) === 401) {
            yield ctx.editMessageText('❌ Your session has expired. Please use /login to authenticate again.');
        }
        else {
            yield ctx.editMessageText('❌ Transfer failed.' + error.response.data.message);
        }
        sessions.delete(ctx.from.id);
    }
}));
bot.action('confirm_transfer_no', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.editMessageText('❌ Transfer cancelled.');
    sessions.delete(ctx.from.id);
}));
// Add handlers for withdraw confirmation buttons
bot.action('confirm_withdraw_yes', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const userSession = sessions.get((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id);
    if (!userSession) {
        yield ctx.answerCbQuery('❌ Session expired. Please start over with /wallet-withdraw');
        return;
    }
    try {
        // Log the withdrawal data for debugging
        console.log('Withdrawal request data:', userSession.withdrawData);
        const response = yield axios_1.default.post(`${API_BASE_URL}/transfers/wallet-withdraw`, userSession.withdrawData, {
            headers: {
                Authorization: `Bearer ${userSession.token}`
            }
        });
        const withdrawal = response.data;
        let message = '✅ *Withdrawal Initiated Successfully!*\n\n';
        message += `🔹 *Withdrawal ID:* ${withdrawal.id}`;
        message += `\nType: ${withdrawal.type}`;
        message += `\nStatus: ${withdrawal.status}`;
        message += `\nAmount: ${withdrawal.amount} ${withdrawal.currency}`;
        message += `\nFee: ${withdrawal.totalFee} ${withdrawal.feeCurrency}`;
        message += `\nMode: ${withdrawal.mode}`;
        message += `\nPurpose: ${withdrawal.purposeCode}`;
        message += `\nSource of Funds: ${withdrawal.sourceOfFunds}`;
        message += `\nRecipient Relationship: ${withdrawal.recipientRelationship}`;
        // Add source wallet address
        message += `\n\n📤 *From Wallet:*`;
        message += `\n\`${((_b = withdrawal.sourceAccount) === null || _b === void 0 ? void 0 : _b.walletAddress) || 'N/A'}\``;
        // Add destination wallet address
        message += `\n\n📥 *To Wallet:*`;
        message += `\n\`${((_c = withdrawal.destinationAccount) === null || _c === void 0 ? void 0 : _c.walletAddress) || 'N/A'}\``;
        message += `\nCreated: ${new Date(withdrawal.createdAt).toLocaleString()}`;
        if (withdrawal.paymentUrl) {
            message += `\n\n🔗 Payment URL: ${withdrawal.paymentUrl}`;
        }
        if (withdrawal.invoiceUrl) {
            message += `\n\n📄 Invoice URL: ${withdrawal.invoiceUrl}`;
        }
        yield ctx.editMessageText(message, { parse_mode: 'Markdown' });
        sessions.delete(ctx.from.id);
    }
    catch (error) {
        console.error('Withdrawal error details:', error);
        if (((_d = error.response) === null || _d === void 0 ? void 0 : _d.status) === 422) {
            // Handle validation errors
            const validationErrors = error.response.data.message;
            let errorMessage = '❌ *Validation Error:*\n\n';
            if (Array.isArray(validationErrors)) {
                validationErrors.forEach((err) => {
                    errorMessage += `• ${err}\n`;
                });
            }
            else {
                errorMessage += validationErrors;
            }
            errorMessage += '\nPlease check your input and try again.';
            yield ctx.editMessageText(errorMessage, { parse_mode: 'Markdown' });
        }
        else if (((_e = error.response) === null || _e === void 0 ? void 0 : _e.status) === 401) {
            yield ctx.editMessageText('❌ Your session has expired. Please use /login to authenticate again.');
        }
        else {
            yield ctx.editMessageText('❌ Withdrawal failed. ' + ((_g = (_f = error.response) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.message) || 'Please try again later.');
        }
        sessions.delete(ctx.from.id);
    }
}));
bot.action('confirm_withdraw_no', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.editMessageText('❌ Withdrawal cancelled.');
    sessions.delete(ctx.from.id);
}));
// Add handlers for batch confirmation buttons
bot.action('confirm_batch_yes', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const userSession = sessions.get((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id);
    if (!userSession) {
        yield ctx.answerCbQuery('❌ Session expired. Please start over with /sendbatch');
        return;
    }
    try {
        // Log the batch data for debugging
        console.log('Batch transfer request data:', userSession.batchData);
        const response = yield axios_1.default.post(`${API_BASE_URL}/transfers/send-batch`, userSession.batchData, {
            headers: {
                Authorization: `Bearer ${userSession.token}`
            }
        });
        const batchResponse = response.data;
        let message = '✅ *Batch Transfer Initiated Successfully!*\n\n';
        // Process each response in the batch
        batchResponse.responses.forEach((transfer, index) => {
            var _a;
            message += `\n🔹 *Transfer ${index + 1}:*`;
            message += `\nRequest ID: ${transfer.requestId}`;
            message += `\nStatus: ${((_a = transfer.response) === null || _a === void 0 ? void 0 : _a.status) || 'Failed'}`;
            if (transfer.response) {
                message += `\nAmount: ${transfer.response.amount} ${transfer.response.currency}`;
                message += `\nFee: ${transfer.response.totalFee} ${transfer.response.feeCurrency}`;
                message += `\nCreated: ${new Date(transfer.response.createdAt).toLocaleString()}`;
                if (transfer.response.paymentUrl) {
                    message += `\n🔗 Payment URL: ${transfer.response.paymentUrl}`;
                }
            }
            if (transfer.error) {
                message += `\n❌ Error: ${transfer.error.message || 'Unknown error'}`;
            }
            message += '\n';
        });
        yield ctx.editMessageText(message, { parse_mode: 'Markdown' });
        sessions.delete(ctx.from.id);
    }
    catch (error) {
        console.error('Batch transfer error details:', error);
        if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 422) {
            // Handle validation errors
            const validationErrors = error.response.data.message;
            let errorMessage = '❌ *Validation Error:*\n\n';
            if (Array.isArray(validationErrors)) {
                validationErrors.forEach((err) => {
                    errorMessage += `• ${err}\n`;
                });
            }
            else {
                errorMessage += validationErrors;
            }
            errorMessage += '\nPlease check your input and try again.';
            yield ctx.editMessageText(errorMessage, { parse_mode: 'Markdown' });
        }
        else if (((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) === 401) {
            yield ctx.editMessageText('❌ Your session has expired. Please use /login to authenticate again.');
        }
        else {
            yield ctx.editMessageText('❌ Batch transfer failed. ' + ((_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.message) || 'Please try again later.');
        }
        sessions.delete(ctx.from.id);
    }
}));
bot.action('confirm_batch_no', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.editMessageText('❌ Batch transfer cancelled.');
    sessions.delete(ctx.from.id);
}));
// Add handler for cancel button callback
bot.action('cancel_operation', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId)
        return;
    const userSession = sessions.get(userId);
    if (userSession) {
        sessions.delete(userId);
        const menuButtons = telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.callback('� Profile', 'menu_profile'),
                telegraf_1.Markup.button.callback('💰 Balance', 'menu_balance'),
                telegraf_1.Markup.button.callback('�👛 Wallets', 'menu_wallets')
            ],
            [
                telegraf_1.Markup.button.callback('📤 Send', 'menu_send'),
                telegraf_1.Markup.button.callback('📥 Withdraw', 'menu_withdraw')
            ],
            [
                telegraf_1.Markup.button.callback('📦 Batch Send', 'menu_batch'),
                telegraf_1.Markup.button.callback('💸 Transfers', 'menu_transfers')
            ],
            [
                telegraf_1.Markup.button.callback('🔑 Login', 'menu_login'),
                telegraf_1.Markup.button.callback('🚪 Logout', 'menu_logout')
            ],
            [
                telegraf_1.Markup.button.callback('🔍 KYC Status', 'menu_kyc')
            ]
        ]);
        yield ctx.editMessageText('Operation cancelled.');
        ctx.reply('What would you like to do?', menuButtons);
    }
    else {
        yield ctx.answerCbQuery('No active operation to cancel.');
    }
}));
// Add handlers for menu button actions
bot.action('menu_balance', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = yield (0, db_1.getSession)(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        const response = yield axios_1.default.get(`${API_BASE_URL}/wallets/balances`, {
            headers: {
                Authorization: `Bearer ${ctx.state.token}`
            }
        });
        const wallets = response.data;
        if (!wallets.length) {
            return ctx.reply('💰 Your wallet has no funds.');
        }
        let message = '📊 *Your Wallet Balances:*';
        wallets.forEach((wallet) => {
            const isTestnet = ['80002'].includes(wallet.network);
            message += `\n🔹 *${wallet.network}${isTestnet ? ' (Testnet)' : ''} Wallet*`;
            wallet.balances.forEach((balance) => {
                message += `\n    - ${balance.balance} ${balance.symbol}`;
            });
        });
        ctx.replyWithMarkdown(message);
    }
    catch (error) {
        console.error('❌ Error details:', error);
        ctx.reply('⚠️ Failed to fetch balance. Please try again later.');
    }
}));
bot.action('menu_wallets', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = yield (0, db_1.getSession)(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        const response = yield axios_1.default.get(`${API_BASE_URL}/wallets`, {
            headers: {
                Authorization: `Bearer ${ctx.state.token}`
            }
        });
        const wallets = response.data;
        if (!wallets.length) {
            return ctx.reply('👛 You have no wallets.');
        }
        let message = '👛 *Your Wallets:*';
        wallets.forEach((wallet) => {
            message += `\n\n🔹 *${wallet.network} Wallet*`;
            message += `\nAddress: \`${wallet.walletAddress}\``;
            message += `\nType: ${wallet.walletType}`;
            message += `\nDefault: ${wallet.isDefault ? '✅' : '❌'}`;
            message += `\nCreated: ${new Date(wallet.createdAt).toLocaleDateString()}`;
        });
        const buttons = wallets.map((wallet) => [
            telegraf_1.Markup.button.callback(`Set ${wallet.network} as Default ${wallet.isDefault ? '✅' : ''}`, `set_default_${wallet.id}`)
        ]);
        const keyboard = telegraf_1.Markup.inlineKeyboard(buttons);
        yield ctx.replyWithMarkdown(message, keyboard);
    }
    catch (error) {
        console.error('❌ Error details:', error);
        ctx.reply('⚠️ Failed to fetch wallets. Please try again later.');
    }
}));
bot.action('menu_send', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = yield (0, db_1.getSession)(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        sessions.set(ctx.from.id, {
            step: 'send_wallet_address',
            sendData: {
                purposeCode: 'self',
                currency: 'USDC'
            },
            token: ctx.state.token
        });
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    }
    catch (error) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start transfer. Please try again.');
    }
}));
bot.action('menu_withdraw', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = yield (0, db_1.getSession)(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        sessions.set(ctx.from.id, {
            step: 'withdraw_wallet_address',
            withdrawData: {
                purposeCode: 'self',
                currency: 'USDC'
            },
            token: ctx.state.token
        });
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    }
    catch (error) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start withdrawal. Please try again.');
    }
}));
bot.action('menu_batch', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = yield (0, db_1.getSession)(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        sessions.set(ctx.from.id, {
            step: 'batch_wallet_address',
            batchData: {
                requests: []
            },
            token: ctx.state.token
        });
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    }
    catch (error) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start batch transfer. Please try again.');
    }
}));
bot.action('menu_transfers', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = yield (0, db_1.getSession)(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        const params = {
            page: 1,
            limit: 10,
            sync: true
        };
        const response = yield axios_1.default.get(`${API_BASE_URL}/transfers`, {
            headers: {
                Authorization: `Bearer ${ctx.state.token}`
            },
            params
        });
        const { data, count, hasMore } = response.data;
        if (!data.length) {
            return ctx.reply('💸 No transfers found.');
        }
        let message = '💸 *Your Recent Transfers:*\n';
        data.forEach((transfer) => {
            var _a, _b;
            message += `\n🔹 *Transfer ID:* ${transfer.id}`;
            message += `\nType: ${transfer.type}`;
            message += `\nStatus: ${transfer.status}`;
            message += `\nAmount: ${transfer.amount / 1e8} ${transfer.currency}`;
            message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
            message += `\nDate: ${new Date(transfer.createdAt).toLocaleString()}`;
            message += `\nFrom: ${((_a = transfer.sourceCountry) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'N/A'}`;
            message += `\nTo: ${((_b = transfer.destinationCountry) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || 'N/A'}`;
            message += '\n';
        });
        message += `\n📊 Page ${params.page} of ${Math.ceil(count / params.limit)}`;
        if (hasMore) {
            message += '\n\nUse /transfers_next to see more transfers.';
        }
        const buttons = [];
        if (params.page > 1) {
            buttons.push(telegraf_1.Markup.button.callback('⬅️ Previous', 'transfers_prev'));
        }
        if (hasMore) {
            buttons.push(telegraf_1.Markup.button.callback('Next ➡️', 'transfers_next'));
        }
        const keyboard = buttons.length > 0 ? telegraf_1.Markup.inlineKeyboard(buttons) : undefined;
        yield ctx.replyWithMarkdown(message, keyboard);
    }
    catch (error) {
        console.error('❌ Error details:', error);
        ctx.reply('⚠️ Failed to fetch transfers. Please try again later.');
    }
}));
bot.action('menu_profile', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = yield (0, db_1.getSession)(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        const token = parsedData.accessToken;
        const response = yield axios_1.default.get(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const profile = response.data;
        let message = '👤 *Your Profile*\n\n';
        message += `*Name:* ${profile.firstName} ${profile.lastName}\n`;
        message += `*Email:* ${profile.email}\n`;
        message += `*Role:* ${profile.role}\n`;
        message += `*Status:* ${profile.status}\n`;
        message += `*Type:* ${profile.type}\n`;
        message += `\n💼 *Wallet Information*\n`;
        message += `*Address:* \`${profile.walletAddress || 'Not set'}\`\n`;
        message += `*Type:* ${profile.walletAccountType || 'Not set'}\n`;
        yield ctx.replyWithMarkdown(message);
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        ctx.reply('❌ Failed to fetch profile. Please try again.');
    }
}));
bot.action('menu_login', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield ctx.answerCbQuery();
        const cancelButton = telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter your email address:', cancelButton);
        sessions.set(ctx.from.id, { step: 'awaiting_email' });
    }
    catch (error) {
        // If it's a query timeout error, send a new message
        if (error.description && error.description.includes('query is too old')) {
            ctx.reply('⚠️ The login button has expired. Please try again.', telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
            ]));
            return;
        }
        // Handle other errors
        console.error('Error in menu_login:', error);
        ctx.reply('❌ An error occurred. Please try again.');
    }
}));
bot.action('menu_logout', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCbQuery();
    yield (0, db_1.logoutUser)(ctx.from.id);
    ctx.reply('✅ You have been logged out successfully.', persistentKeyboard);
}));
// Add a general error handler for callback queries
bot.catch((err, ctx) => {
    console.error('⚠️ Error handling update:', err);
    // Check if it's a callback query error
    if (err.description && err.description.includes('query is too old')) {
        // For expired callback queries, send a new message
        ctx.reply('⚠️ This button has expired. Please use a more recent message or command.');
        return;
    }
    // For other errors, notify the user
    ctx.reply('❌ An error occurred. Please try again.');
});
bot.hears('🔍 KYC Status', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield bot.command('kycstatus', ctx);
}));
bot.action('menu_kyc', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    yield ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = yield (0, db_1.getSession)(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('🔑 Login', 'menu_login')]
        ]));
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        const response = yield axios_1.default.get(`${API_BASE_URL}/kycs`, {
            headers: {
                Authorization: `Bearer ${ctx.state.token}`
            }
        });
        const { data } = response.data;
        if (!data.length) {
            const message = '❌ Please complete your KYC process at [Copperx.io](https://copperx.io)';
            const keyboard = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.url('🔗 Complete KYC', 'https://copperx.io')]
            ]);
            return ctx.replyWithMarkdown(message, keyboard);
        }
        const kyc = data[0];
        let message = '🔍 *KYC Status Information*\n\n';
        message += `*Status:* ${kyc.status.toUpperCase()}\n`;
        message += `*Type:* ${kyc.type}\n`;
        message += `*Country:* ${kyc.country}\n`;
        message += `*Provider:* ${kyc.kycProviderCode}\n\n`;
        if ((_a = kyc.kycDetail) === null || _a === void 0 ? void 0 : _a.kycUrl) {
            const keyboard = telegraf_1.Markup.inlineKeyboard([
                [telegraf_1.Markup.button.url('🔗 Complete KYC', kyc.kycDetail.kycUrl)]
            ]);
            yield ctx.replyWithMarkdown(message, keyboard);
        }
        else {
            yield ctx.replyWithMarkdown(message);
        }
    }
    catch (error) {
        console.error('Error fetching KYC status:', error);
        ctx.reply('❌ Failed to fetch KYC status. Please try again.');
    }
}));
console.log("🚀 Launching bot...");
bot.launch();
console.log("✅ Bot launched successfully");
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
