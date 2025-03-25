import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import { getSession, storeSession, logoutUser } from './db';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

dotenv.config();

console.log('Starting bot initialization...');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const API_BASE_URL = 'https://income-api.copperx.io/api';
// Store user sessions
const sessions = new Map();

const persistentKeyboard = Markup.keyboard([
    ['👤 Profile', '💰 Balance', '👛 Wallets'],
    ['📤 Send', '📥 Withdraw'],
    ['📦 Batch Send', '💸 Transfers'],
    ['🔑 Login', '🚪 Logout'],
    ['🔍 KYC Status']
])
    .resize()  // Resizes buttons to be smaller
    .persistent(true);  // Makes the keyboard persistent (stays visible)

const isAuthenticated = async (ctx: any, next: any) => {
    console.log("🔍 Inside isAuthenticated middleware");
    const userId = ctx.from.id;
    console.log("👤 User ID:", userId);

    const userData = await getSession(userId);
    console.log("📦 Retrieved user data:", userData);

    if (!userData) {
        console.log("❌ No user data found");
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
    }

    try {
        const parsedData = JSON.parse(userData);
        console.log("✅ Parsed user data:", parsedData);
        // Store the entire user data in ctx.state
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;
        console.log("🔑 Set token in state:", ctx.state.token);
        return next();
    } catch (error) {
        console.error('❌ Error parsing user data:', error);
        return ctx.reply('❌ Session error. Please login again using /login');
    }
};

bot.start((ctx) => {
    console.log("🚀 Bot started");
    ctx.reply('Welcome to Copperx Bot! Use /login to authenticate.', persistentKeyboard);
});

// Add handler for menu buttons
bot.hears(['👤 Profile', '💰 Balance', '👛 Wallets', '📤 Send', '📥 Withdraw', '📦 Batch Send', '💸 Transfers', '🔑 Login', '🚪 Logout', '🔍 KYC Status'], async (ctx) => {
    const command = ctx.message.text;

    // First check authentication for protected commands
    if (command !== '🔑 Login' && command !== '🚪 Logout') {
        const userId = ctx.from.id;
        const userData = await getSession(userId);

        if (!userData) {
            return ctx.reply('❌ You are not logged in.',
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔑 Login', 'menu_login')]
                ])
            );
        }

        try {
            const parsedData = JSON.parse(userData);
            ctx.state.userData = parsedData;
            ctx.state.token = parsedData.accessToken;
        } catch (error) {
            return ctx.reply('❌ Session error. Please login again using /login');
        }
    }

    switch (command) {
        case '👤 Profile':
            try {
                const token = ctx.state.token;
                const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const profile: any = response.data;
                let message = '👤 *Your Profile*\n\n';
                message += `*Name:* ${profile.firstName} ${profile.lastName}\n`;
                message += `*Email:* ${profile.email}\n`;
                message += `*Role:* ${profile.role}\n`;
                message += `*Status:* ${profile.status}\n`;
                message += `*Type:* ${profile.type}\n`;
                message += `\n💼 *Wallet Information*\n`;
                message += `*Address:* \`${profile.walletAddress || 'Not set'}\`\n`;
                message += `*Type:* ${profile.walletAccountType || 'Not set'}\n`;

                await ctx.replyWithMarkdown(message);
            } catch (error) {
                console.error('Error fetching profile:', error);
                ctx.reply('❌ Failed to fetch profile. Please try again.');
            }
            break;
        case '💰 Balance':
            console.log("💰 Balance command received");
            try {
                const token = ctx.state.token;
                const response = await axios.get(`${API_BASE_URL}/wallets/balances`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const wallets: any = response.data;
                if (!wallets.length) {
                    return ctx.reply('💰 Your wallet has no funds.');
                }

                let message = '📊 *Your Wallet Balances:*';
                wallets.forEach((wallet: any) => {
                    const isTestnet = ['80002'].includes(wallet.network);
                    message += `\n🔹 *${wallet.network}${isTestnet ? ' (Testnet)' : ''} Wallet*`;
                    wallet.balances.forEach((balance: any) => {
                        message += `\n    - ${balance.balance} ${balance.symbol}`;
                    });
                });

                ctx.replyWithMarkdown(message);
            } catch (error: any) {
                console.error('❌ Error details:', error);
                ctx.reply('⚠️ Failed to fetch balance. Please try again later.');
            }
            break;
        case '👛 Wallets':
            console.log("👛 Wallets command received");
            try {
                const token = ctx.state.token;
                const response = await axios.get(`${API_BASE_URL}/wallets`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const wallets: any = response.data;
                if (!wallets.length) {
                    return ctx.reply('👛 You have no wallets.');
                }

                let message = '👛 *Your Wallets:*';
                wallets.forEach((wallet: any) => {
                    message += `\n\n🔹 *${wallet.network} Wallet*`;
                    message += `\nAddress: \`${wallet.walletAddress}\``;
                    message += `\nType: ${wallet.walletType}`;
                    message += `\nDefault: ${wallet.isDefault ? '✅' : '❌'}`;
                    message += `\nCreated: ${new Date(wallet.createdAt).toLocaleDateString()}`;
                });

                const buttons = wallets.map((wallet: any) => [
                    Markup.button.callback(
                        `Set ${wallet.network} as Default ${wallet.isDefault ? '✅' : ''}`,
                        `set_default_${wallet.id}`
                    )
                ]);

                const keyboard = Markup.inlineKeyboard(buttons);
                await ctx.replyWithMarkdown(message, keyboard);
            } catch (error: any) {
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
                const cancelButton = Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'cancel_operation')]
                ]);
                ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
            } catch (error: any) {
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
                const cancelButton = Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'cancel_operation')]
                ]);
                ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
            } catch (error: any) {
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
                const cancelButton = Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'cancel_operation')]
                ]);
                ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
            } catch (error: any) {
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

                const response = await axios.get(`${API_BASE_URL}/transfers`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    params
                });

                const { data, count, hasMore }: any = response.data;
                if (!data.length) {
                    return ctx.reply('💸 No transfers found.');
                }

                let message = '💸 *Your Recent Transfers:*\n';
                data.forEach((transfer: any) => {
                    message += `\n🔹 *Transfer ID:* ${transfer.id}`;
                    message += `\nType: ${transfer.type}`;
                    message += `\nStatus: ${transfer.status}`;
                    message += `\nAmount: ${transfer.amount / 1e8} ${transfer.currency}`;
                    message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
                    message += `\nDate: ${new Date(transfer.createdAt).toLocaleString()}`;
                    message += `\nFrom: ${transfer.sourceCountry?.toUpperCase() || 'N/A'}`;
                    message += `\nTo: ${transfer.destinationCountry?.toUpperCase() || 'N/A'}`;
                    message += '\n';
                });

                message += `\n📊 Page ${params.page} of ${Math.ceil(count / params.limit)}`;
                if (hasMore) {
                    message += '\n\nUse /transfers_next to see more transfers.';
                }

                const buttons = [];
                if (params.page > 1) {
                    buttons.push(Markup.button.callback('⬅️ Previous', 'transfers_prev'));
                }
                if (hasMore) {
                    buttons.push(Markup.button.callback('Next ➡️', 'transfers_next'));
                }
                const keyboard = buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined;

                await ctx.replyWithMarkdown(message, keyboard);
            } catch (error: any) {
                console.error('❌ Error details:', error);
                ctx.reply('⚠️ Failed to fetch transfers. Please try again later.');
            }
            break;
        case '🔑 Login':
            console.log("🔑 Login command received");
            const cancelButton = Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_operation')]
            ]);
            ctx.reply('Please enter your email address:', cancelButton);
            sessions.set(ctx.from.id, { step: 'awaiting_email' });
            break;
        case '🚪 Logout':
            console.log("👋 Logout command received");
            await logoutUser(ctx.from.id);
            ctx.reply('✅ You have been logged out successfully.', persistentKeyboard);
            break;
        case '🔍 KYC Status':

            try {


                const response = await axios.get(`${API_BASE_URL}/kycs`, {
                    headers: {
                        Authorization: `Bearer ${ctx.state.token}`
                    }
                });

                const { data }: any = response.data;
                if (!data.length) {
                    const message = '❌ Please complete your KYC process at [Copperx.io](https://copperx.io)';
                    const keyboard = Markup.inlineKeyboard([
                        [Markup.button.url('🔗 Complete KYC', 'https://copperx.io')]
                    ]);
                    return ctx.replyWithMarkdown(message, keyboard);
                }

                const kyc = data[0];
                let message = '🔍 *KYC Status Information*\n\n';
                message += `*Status:* ${kyc.status.toUpperCase()}\n`;
                message += `*Type:* ${kyc.type}\n`;
                message += `*Country:* ${kyc.country}\n`;
                message += `*Provider:* ${kyc.kycProviderCode}\n\n`;

                if (kyc.kycDetail?.kycUrl) {
                    const keyboard = Markup.inlineKeyboard([
                        [Markup.button.url('🔗 Complete KYC', kyc.kycDetail.kycUrl)]
                    ]);
                    await ctx.replyWithMarkdown(message, keyboard);
                } else {
                    await ctx.replyWithMarkdown(message);
                }
            } catch (error) {
                console.error('Error fetching KYC status:', error);
                ctx.reply('❌ Failed to fetch KYC status. Please try again.');
            }
            break;

    }
});

// Add a command to show menu anytime

bot.command('login', (ctx) => {
    console.log("🔑 Login command received");
    const cancelButton = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cancel_operation')]
    ]);
    ctx.reply('Please enter your email address:', cancelButton);
    sessions.set(ctx.from.id, { step: 'awaiting_email' });
});

bot.command('logout', async (ctx) => {
    console.log("👋 Logout command received");
    await logoutUser(ctx.from.id);
    ctx.reply('✅ You have been logged out successfully.', persistentKeyboard);
});

bot.command('balance', isAuthenticated, async (ctx) => {
    console.log("💰 Balance command received");
    try {
        const token = ctx.state.token;
        console.log('🔑 Token from state:', token);

        const response = await axios.get(`${API_BASE_URL}/wallets/balances`, {
            headers: {
                Authorization: `Bearer ${token}`
            },

        });
        console.log('📊 API Response:', response.data);

        const wallets: any = response.data;
        if (!wallets.length) {
            return ctx.reply('💰 Your wallet has no funds.');
        }

        let message = '📊 *Your Wallet Balances:*';
        wallets.forEach((wallet: any) => {
            // Add (Testnet) label for testnet networks
            const isTestnet = ['80002'].includes(wallet.network);
            message += `\n🔹 *${wallet.network}${isTestnet ? ' (Testnet)' : ''} Wallet*`;
            console.log(`Wallet ${wallet.network} balances:`, wallet.balances);
            wallet.balances.forEach((balance: any) => {

                message += `\n    - ${balance.balance} ${balance.symbol}`;
            });
        });

        ctx.replyWithMarkdown(message);
    } catch (error: any) {
        console.error('❌ Error details:', error);
        ctx.reply('⚠️ Failed to fetch balance. Please try again later.');
    }
});

bot.command('wallets', isAuthenticated, async (ctx) => {
    console.log("👛 Wallets command received");
    try {
        const token = ctx.state.token;
        console.log(' Token from state:', token);

        const response = await axios.get(`${API_BASE_URL}/wallets`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log('📊 API Response:', response.data);

        const wallets: any = response.data;
        if (!wallets.length) {
            return ctx.reply('👛 You have no wallets.');
        }

        let message = '👛 *Your Wallets:*';
        wallets.forEach((wallet: any) => {
            message += `\n\n🔹 *${wallet.network} Wallet*`;
            message += `\nAddress: \`${wallet.walletAddress}\``;
            message += `\nType: ${wallet.walletType}`;
            message += `\nDefault: ${wallet.isDefault ? '✅' : '❌'}`;
            message += `\nCreated: ${new Date(wallet.createdAt).toLocaleDateString()}`;
        });

        // Create inline keyboard buttons for each wallet
        const buttons = wallets.map((wallet: any) => [
            Markup.button.callback(
                `Set ${wallet.network} as Default ${wallet.isDefault ? '✅' : ''}`,
                `set_default_${wallet.id}`
            )
        ]);

        const keyboard = Markup.inlineKeyboard(buttons);
        await ctx.replyWithMarkdown(message, keyboard);
    } catch (error: any) {
        console.error('❌ Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        ctx.reply('⚠️ Failed to fetch wallets. Please try again later.');
    }
});

// Handle callback queries for setting default wallet
bot.action(/set_default_(.+)/, isAuthenticated, async (ctx) => {
    try {
        const walletId = ctx.match[1];
        const token = ctx.state.token;

        console.log(`Setting wallet ${walletId} as default`);
        const response = await axios.post(
            `${API_BASE_URL}/wallets/default`,
            { walletId },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        await ctx.answerCbQuery('✅ Default wallet updated successfully!');
        // Refresh the wallets list by calling the wallets command
        await ctx.reply('🔄 Refreshing wallet list...');
        await ctx.reply('/wallets');
    } catch (error: any) {
        console.error('Error setting default wallet:', error);
        await ctx.answerCbQuery('❌ Failed to set default wallet');
    }
});

bot.command('transfers', isAuthenticated, async (ctx) => {
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

        const response = await axios.get(`${API_BASE_URL}/transfers`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params
        });
        console.log('📊 API Response:', response.data);

        const { data, count, hasMore }: any = response.data;
        if (!data.length) {
            return ctx.reply('💸 No transfers found.');
        }

        let message = '💸 *Your Recent Transfers:*\n';
        data.forEach((transfer: any) => {
            message += `\n🔹 *Transfer ID:* ${transfer.id}`;
            message += `\nType: ${transfer.type}`;
            message += `\nStatus: ${transfer.status}`;
            message += `\nAmount: ${transfer.amount / 1e8} ${transfer.currency}`;
            message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
            message += `\nDate: ${new Date(transfer.createdAt).toLocaleString()}`;
            message += `\nFrom: ${transfer.sourceCountry?.toUpperCase() || 'N/A'}`;
            message += `\nTo: ${transfer.destinationCountry?.toUpperCase() || 'N/A'}`;
            message += '\n';
        });

        message += `\n📊 Page ${params.page} of ${Math.ceil(count / params.limit)}`;
        if (hasMore) {
            message += '\n\nUse /transfers_next to see more transfers.';
        }

        // Create inline keyboard for navigation if there are more pages
        const buttons = [];
        if (params.page > 1) {
            buttons.push(Markup.button.callback('⬅️ Previous', 'transfers_prev'));
        }
        if (hasMore) {
            buttons.push(Markup.button.callback('Next ➡️', 'transfers_next'));
        }
        const keyboard = buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined;

        await ctx.replyWithMarkdown(message, keyboard);
    } catch (error: any) {
        console.error('❌ Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        ctx.reply('⚠️ Failed to fetch transfers. Please try again later.');
    }
});

// Handle pagination callbacks
bot.action(/transfers_(prev|next)/, isAuthenticated, async (ctx) => {
    try {
        const action = ctx.match[1];
        const token = ctx.state.token;
        const callbackMessage = ctx.callbackQuery.message;
        const currentPage = callbackMessage && 'text' in callbackMessage ? parseInt(callbackMessage.text.match(/Page (\d+)/)?.[1] || '1') : 1;

        const params = {
            page: action === 'next' ? currentPage + 1 : currentPage - 1,
            limit: 10,
            sync: true
        };

        const response = await axios.get(`${API_BASE_URL}/transfers`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params
        });

        const { data, count, hasMore }: any = response.data;
        if (!data.length) {
            await ctx.answerCbQuery('No more transfers to show');
            return;
        }

        let message = '💸 *Your Recent Transfers:*\n';
        data.forEach((transfer: any) => {
            message += `\n🔹 *Transfer ID:* ${transfer.id}`;
            message += `\nType: ${transfer.type}`;
            message += `\nStatus: ${transfer.status}`;
            message += `\nAmount: ${transfer.amount} ${transfer.currency}`;
            message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
            message += `\nDate: ${new Date(transfer.createdAt).toLocaleString()}`;
            message += `\nFrom: ${transfer.sourceCountry?.toUpperCase() || 'N/A'}`;
            message += `\nTo: ${transfer.destinationCountry?.toUpperCase() || 'N/A'}`;
            message += '\n';
        });

        message += `\n📊 Page ${params.page} of ${Math.ceil(count / params.limit)}`;
        if (hasMore) {
            message += '\n\nUse /transfers_next to see more transfers.';
        }

        // Create inline keyboard for navigation
        const buttons = [];
        if (params.page > 1) {
            buttons.push(Markup.button.callback('⬅️ Previous', 'transfers_prev'));
        }
        if (hasMore) {
            buttons.push(Markup.button.callback('Next ➡️', 'transfers_next'));
        }
        const keyboard = buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined;

        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard?.reply_markup,
        });
        await ctx.answerCbQuery();
    } catch (error: any) {
        console.error('Error fetching transfers:', error);
        await ctx.answerCbQuery('❌ Failed to fetch transfers');
    }
});

bot.command('send', isAuthenticated, async (ctx) => {
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
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    } catch (error: any) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start transfer. Please try again.');
    }
});

bot.command('walletwithdraw', isAuthenticated, async (ctx) => {
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
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    } catch (error: any) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start withdrawal. Please try again.');
    }
});

bot.command('sendbatch', isAuthenticated, async (ctx) => {
    console.log("📤 Send Batch command received");
    try {
        sessions.set(ctx.from.id, {
            step: 'batch_wallet_address',
            batchData: {
                requests: []
            },
            token: ctx.state.token
        });
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    } catch (error: any) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start batch transfer. Please try again.');
    }
});
bot.command('profile', isAuthenticated, async (ctx) => {
    try {
        const token = ctx.state.token;
        const response = await axios.get(`${API_BASE_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const profile: any = response.data;
        let message = '👤 *Your Profile*\n\n';
        message += `*Name:* ${profile.firstName} ${profile.lastName}\n`;
        message += `*Email:* ${profile.email}\n`;
        message += `*Role:* ${profile.role}\n`;
        message += `*Status:* ${profile.status}\n`;
        message += `*Type:* ${profile.type}\n`;
        message += `\n💼 *Wallet Information*\n`;
        message += `*Address:* \`${profile.walletAddress || 'Not set'}\`\n`;
        message += `*Type:* ${profile.walletAccountType || 'Not set'}\n`;

        await ctx.replyWithMarkdown(message);
    } catch (error) {
        console.error('Error fetching profile:', error);
        ctx.reply('❌ Failed to fetch profile. Please try again.');
    }
});
bot.command('kycstatus', isAuthenticated, async (ctx) => {
    try {
        const token = ctx.state.token;
        const response = await axios.get(`${API_BASE_URL}/kycs`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const { data }: any = response.data;
        if (!data.length) {
            const message = '❌ Please complete your KYC process at [Copperx.io](https://copperx.io)';
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.url('🔗 Complete KYC', 'https://copperx.io')]
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
            if (kyc.kycDetail.addressLine2) message += `${kyc.kycDetail.addressLine2}\n`;
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
            if (kyc.kycDetail.kycDocuments?.length > 0) {
                message += '\n📄 *Documents*\n';
                kyc.kycDetail.kycDocuments.forEach((doc: any) => {
                    message += `- ${doc.documentType.replace(/_/g, ' ').toUpperCase()}: ${doc.status.toUpperCase()}\n`;
                });
            }
        }

        // Add KYC URL if available
        if (kyc.kycDetail?.kycUrl) {
            message += `\n🔗 [Complete KYC Process](${kyc.kycDetail.kycUrl})\n`;
        }

        await ctx.replyWithMarkdown(message);
    } catch (error) {
        console.error('Error fetching KYC status:', error);
        ctx.reply('❌ Failed to fetch KYC status. Please try again.');
    }
});
bot.on('text', async (ctx) => {
    console.log("📝 Text message received:", ctx.message.text);
    const userSession = sessions.get(ctx.from.id);
    if (!userSession) return;

    if (userSession.step === 'awaiting_email') {
        const email = ctx.message.text;
        try {
            console.log("📧 Sending OTP request for email:", email);
            const response: any = await axios.post(`${API_BASE_URL}/auth/email-otp/request`, { email });
            sessions.set(ctx.from.id, { step: 'awaiting_otp', email, sid: response.data.sid });
            const cancelButton = Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_operation')]
            ]);
            ctx.reply('OTP sent to your email. Please enter the OTP:', cancelButton);
        } catch (error) {
            console.error("❌ Error sending OTP:", error);
            ctx.reply('Error sending OTP. Please try again.');
        }
    } else if (userSession.step === 'awaiting_otp') {
        const otp = ctx.message.text;
        try {
            const { email, sid } = userSession;
            console.log("🔐 Authenticating with OTP");
            const response = await axios.post(`${API_BASE_URL}/auth/email-otp/authenticate`, { email, otp, sid });

            console.log("✅ Authentication successful, storing user data");
            // Store the entire response data
            await storeSession(ctx.from.id, JSON.stringify(response.data));

            // Create menu inline keyboard
            const menuButtons = Markup.inlineKeyboard([
                [
                    Markup.button.callback('💰 Balance', 'menu_balance'),
                    Markup.button.callback('👤 Profile', 'menu_profile'),
                    Markup.button.callback('👛 Wallets', 'menu_wallets')
                ],
                [
                    Markup.button.callback('📤 Send', 'menu_send'),
                    Markup.button.callback('📥 Withdraw', 'menu_withdraw')
                ],
                [
                    Markup.button.callback('📦 Batch Send', 'menu_batch'),
                    Markup.button.callback('💸 Transfers', 'menu_transfers')
                ],
                [
                    Markup.button.callback('🔑 Login', 'menu_login'),
                    Markup.button.callback('🚪 Logout', 'menu_logout')
                ],
                [
                    Markup.button.callback('🔍 KYC Status', 'menu_kyc')
                ]
            ]);

            ctx.reply('✅ Login successful! You are now authenticated.\n\nWhat would you like to do?', menuButtons);
            sessions.delete(ctx.from.id);
        } catch (error) {
            console.error("❌ Authentication error:", error);
            ctx.reply('Invalid OTP. Please try again.');
        }
    } else if (userSession.step === 'send_wallet_address') {
        userSession.sendData.walletAddress = ctx.message.text;
        userSession.step = 'send_amount';
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the amount to send (minimum 1 USDC):', cancelButton);
    } else if (userSession.step === 'send_amount') {
        const amount = parseFloat(ctx.message.text);

        // Check if amount is at least 1 USDC
        if (amount < 1) {
            const cancelButton = Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_operation')]
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
                Markup.button.callback('✅ Confirm', 'confirm_transfer_yes'),
                Markup.button.callback('❌ Cancel', 'confirm_transfer_no')
            ]
        ];
        const keyboard = Markup.inlineKeyboard(buttons);
        ctx.replyWithMarkdown(message, keyboard);
    } else if (userSession.step === 'confirm_transfer') {
        // This step will be handled by the button callbacks
        return;
    } else if (userSession.step === 'withdraw_wallet_address') {
        userSession.withdrawData.walletAddress = ctx.message.text;
        userSession.step = 'withdraw_amount';
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the amount to withdraw (minimum 1 USDC):', cancelButton);
    } else if (userSession.step === 'withdraw_amount') {
        const amount = parseFloat(ctx.message.text);

        // Check if amount is at least 1 USDC
        if (amount < 1) {
            const cancelButton = Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_operation')]
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
                Markup.button.callback('✅ Confirm', 'confirm_withdraw_yes'),
                Markup.button.callback('❌ Cancel', 'confirm_withdraw_no')
            ]
        ];
        const keyboard = Markup.inlineKeyboard(buttons);
        ctx.replyWithMarkdown(message, keyboard);
    } else if (userSession.step === 'batch_wallet_address') {
        userSession.currentRequest = {
            requestId: uuidv4(),
            request: {
                walletAddress: ctx.message.text,
                purposeCode: 'self',
                currency: 'USDC'
            }
        };
        userSession.step = 'batch_email';
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s email address:', cancelButton);
    } else if (userSession.step === 'batch_email') {
        userSession.currentRequest.request.email = ctx.message.text;
        userSession.step = 'batch_payee_id';
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the payee ID:', cancelButton);
    } else if (userSession.step === 'batch_payee_id') {
        userSession.currentRequest.request.payeeId = ctx.message.text;
        userSession.step = 'batch_amount';
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the amount to send (minimum 1 USDC):', cancelButton);
    } else if (userSession.step === 'batch_amount') {
        const amount = parseFloat(ctx.message.text);

        // Check if amount is at least 1 USDC
        if (amount < 1) {
            const cancelButton = Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_operation')]
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
                Markup.button.callback('✅ Confirm', 'confirm_batch_yes'),
                Markup.button.callback('❌ Cancel', 'confirm_batch_no')
            ]
        ];
        const keyboard = Markup.inlineKeyboard(buttons);
        ctx.replyWithMarkdown(message, keyboard);
    }
});

// Add handlers for confirmation buttons
bot.action('confirm_transfer_yes', async (ctx) => {
    const userSession = sessions.get(ctx.from?.id);
    if (!userSession) {
        await ctx.answerCbQuery('❌ Session expired. Please start over with /send');
        return;
    }

    try {
        // Log the transfer data for debugging
        console.log('Transfer request data:', userSession.sendData);

        const response = await axios.post(
            `${API_BASE_URL}/transfers/send`,
            userSession.sendData,
            {
                headers: {
                    Authorization: `Bearer ${userSession.token}`
                }
            }
        );

        const transfer: any = response.data;
        let message = '✅ *Transfer Initiated Successfully!*\n\n';
        message += `🔹 *Transfer ID:* ${transfer.id}`;
        message += `\nType: ${transfer.type}`;
        message += `\nStatus: ${transfer.status}`;
        message += `\nAmount: ${transfer.amount} ${transfer.currency}`;
        message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;

        // Add source wallet address
        message += `\n\n📤 *From Wallet:*`;
        message += `\n\`${transfer.sourceAccount?.walletAddress || 'N/A'}\``;

        // Add destination wallet address
        message += `\n\n📥 *To Wallet:*`;
        message += `\n\`${transfer.destinationAccount?.walletAddress || 'N/A'}\``;

        message += `\nCreated: ${new Date(transfer.createdAt).toLocaleString()}`;

        if (transfer.paymentUrl) {
            message += `\n\n🔗 Payment URL: ${transfer.paymentUrl}`;
        }

        await ctx.editMessageText(message, { parse_mode: 'Markdown' });
        sessions.delete(ctx.from.id);
    } catch (error: any) {
        console.error('Transfer error details:', error);

        if (error.response?.status === 422) {
            // Handle validation errors
            const validationErrors = error.response.data.message;
            console.log(validationErrors)
            let errorMessage = '❌ *Validation Error:*\n\n';

            errorMessage += '\nPlease check your input and try again.';
            await ctx.editMessageText(errorMessage, { parse_mode: 'Markdown' });
        } else if (error.response?.status === 401) {
            await ctx.editMessageText('❌ Your session has expired. Please use /login to authenticate again.');
        } else {
            await ctx.editMessageText('❌ Transfer failed.' + error.response.data.message);
        }
        sessions.delete(ctx.from.id);
    }
});

bot.action('confirm_transfer_no', async (ctx) => {
    await ctx.editMessageText('❌ Transfer cancelled.');
    sessions.delete(ctx.from.id);
});

// Add handlers for withdraw confirmation buttons
bot.action('confirm_withdraw_yes', async (ctx) => {
    const userSession = sessions.get(ctx.from?.id);
    if (!userSession) {
        await ctx.answerCbQuery('❌ Session expired. Please start over with /wallet-withdraw');
        return;
    }

    try {
        // Log the withdrawal data for debugging
        console.log('Withdrawal request data:', userSession.withdrawData);

        const response = await axios.post(
            `${API_BASE_URL}/transfers/wallet-withdraw`,
            userSession.withdrawData,
            {
                headers: {
                    Authorization: `Bearer ${userSession.token}`
                }
            }
        );

        const withdrawal: any = response.data;
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
        message += `\n\`${withdrawal.sourceAccount?.walletAddress || 'N/A'}\``;

        // Add destination wallet address
        message += `\n\n📥 *To Wallet:*`;
        message += `\n\`${withdrawal.destinationAccount?.walletAddress || 'N/A'}\``;

        message += `\nCreated: ${new Date(withdrawal.createdAt).toLocaleString()}`;

        if (withdrawal.paymentUrl) {
            message += `\n\n🔗 Payment URL: ${withdrawal.paymentUrl}`;
        }

        if (withdrawal.invoiceUrl) {
            message += `\n\n📄 Invoice URL: ${withdrawal.invoiceUrl}`;
        }

        await ctx.editMessageText(message, { parse_mode: 'Markdown' });
        sessions.delete(ctx.from.id);
    } catch (error: any) {
        console.error('Withdrawal error details:', error);

        if (error.response?.status === 422) {
            // Handle validation errors
            const validationErrors = error.response.data.message;
            let errorMessage = '❌ *Validation Error:*\n\n';
            if (Array.isArray(validationErrors)) {
                validationErrors.forEach((err: any) => {
                    errorMessage += `• ${err}\n`;
                });
            } else {
                errorMessage += validationErrors;
            }
            errorMessage += '\nPlease check your input and try again.';
            await ctx.editMessageText(errorMessage, { parse_mode: 'Markdown' });
        } else if (error.response?.status === 401) {
            await ctx.editMessageText('❌ Your session has expired. Please use /login to authenticate again.');
        } else {
            await ctx.editMessageText('❌ Withdrawal failed. ' + error.response?.data?.message || 'Please try again later.');
        }
        sessions.delete(ctx.from.id);
    }
});

bot.action('confirm_withdraw_no', async (ctx) => {
    await ctx.editMessageText('❌ Withdrawal cancelled.');
    sessions.delete(ctx.from.id);
});

// Add handlers for batch confirmation buttons
bot.action('confirm_batch_yes', async (ctx) => {
    const userSession = sessions.get(ctx.from?.id);
    if (!userSession) {
        await ctx.answerCbQuery('❌ Session expired. Please start over with /sendbatch');
        return;
    }

    try {
        // Log the batch data for debugging
        console.log('Batch transfer request data:', userSession.batchData);

        const response = await axios.post(
            `${API_BASE_URL}/transfers/send-batch`,
            userSession.batchData,
            {
                headers: {
                    Authorization: `Bearer ${userSession.token}`
                }
            }
        );

        const batchResponse: any = response.data;
        let message = '✅ *Batch Transfer Initiated Successfully!*\n\n';

        // Process each response in the batch
        batchResponse.responses.forEach((transfer: any, index: number) => {
            message += `\n🔹 *Transfer ${index + 1}:*`;
            message += `\nRequest ID: ${transfer.requestId}`;
            message += `\nStatus: ${transfer.response?.status || 'Failed'}`;

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

        await ctx.editMessageText(message, { parse_mode: 'Markdown' });
        sessions.delete(ctx.from.id);
    } catch (error: any) {
        console.error('Batch transfer error details:', error);

        if (error.response?.status === 422) {
            // Handle validation errors
            const validationErrors = error.response.data.message;
            let errorMessage = '❌ *Validation Error:*\n\n';
            if (Array.isArray(validationErrors)) {
                validationErrors.forEach((err: any) => {
                    errorMessage += `• ${err}\n`;
                });
            } else {
                errorMessage += validationErrors;
            }
            errorMessage += '\nPlease check your input and try again.';
            await ctx.editMessageText(errorMessage, { parse_mode: 'Markdown' });
        } else if (error.response?.status === 401) {
            await ctx.editMessageText('❌ Your session has expired. Please use /login to authenticate again.');
        } else {
            await ctx.editMessageText('❌ Batch transfer failed. ' + error.response?.data?.message || 'Please try again later.');
        }
        sessions.delete(ctx.from.id);
    }
});

bot.action('confirm_batch_no', async (ctx) => {
    await ctx.editMessageText('❌ Batch transfer cancelled.');
    sessions.delete(ctx.from.id);
});

// Add handler for cancel button callback
bot.action('cancel_operation', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const userSession = sessions.get(userId);
    if (userSession) {
        sessions.delete(userId);
        const menuButtons = Markup.inlineKeyboard([
            [
                Markup.button.callback('� Profile', 'menu_profile'),
                Markup.button.callback('💰 Balance', 'menu_balance'),
                Markup.button.callback('�👛 Wallets', 'menu_wallets')
            ],
            [
                Markup.button.callback('📤 Send', 'menu_send'),
                Markup.button.callback('📥 Withdraw', 'menu_withdraw')
            ],
            [
                Markup.button.callback('📦 Batch Send', 'menu_batch'),
                Markup.button.callback('💸 Transfers', 'menu_transfers')
            ],
            [
                Markup.button.callback('🔑 Login', 'menu_login'),
                Markup.button.callback('🚪 Logout', 'menu_logout')
            ],
            [
                Markup.button.callback('🔍 KYC Status', 'menu_kyc')
            ]
        ]);
        await ctx.editMessageText('Operation cancelled.');
        ctx.reply('What would you like to do?', menuButtons);
    } else {
        await ctx.answerCbQuery('No active operation to cancel.');
    }
});

// Add handlers for menu button actions
bot.action('menu_balance', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = await getSession(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;

        const response = await axios.get(`${API_BASE_URL}/wallets/balances`, {
            headers: {
                Authorization: `Bearer ${ctx.state.token}`
            }
        });

        const wallets: any = response.data;
        if (!wallets.length) {
            return ctx.reply('💰 Your wallet has no funds.');
        }

        let message = '📊 *Your Wallet Balances:*';
        wallets.forEach((wallet: any) => {
            const isTestnet = ['80002'].includes(wallet.network);
            message += `\n🔹 *${wallet.network}${isTestnet ? ' (Testnet)' : ''} Wallet*`;
            wallet.balances.forEach((balance: any) => {
                message += `\n    - ${balance.balance} ${balance.symbol}`;
            });
        });

        ctx.replyWithMarkdown(message);
    } catch (error: any) {
        console.error('❌ Error details:', error);
        ctx.reply('⚠️ Failed to fetch balance. Please try again later.');
    }
});

bot.action('menu_wallets', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = await getSession(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;

        const response = await axios.get(`${API_BASE_URL}/wallets`, {
            headers: {
                Authorization: `Bearer ${ctx.state.token}`
            }
        });

        const wallets: any = response.data;
        if (!wallets.length) {
            return ctx.reply('👛 You have no wallets.');
        }

        let message = '👛 *Your Wallets:*';
        wallets.forEach((wallet: any) => {
            message += `\n\n🔹 *${wallet.network} Wallet*`;
            message += `\nAddress: \`${wallet.walletAddress}\``;
            message += `\nType: ${wallet.walletType}`;
            message += `\nDefault: ${wallet.isDefault ? '✅' : '❌'}`;
            message += `\nCreated: ${new Date(wallet.createdAt).toLocaleDateString()}`;
        });

        const buttons = wallets.map((wallet: any) => [
            Markup.button.callback(
                `Set ${wallet.network} as Default ${wallet.isDefault ? '✅' : ''}`,
                `set_default_${wallet.id}`
            )
        ]);

        const keyboard = Markup.inlineKeyboard(buttons);
        await ctx.replyWithMarkdown(message, keyboard);
    } catch (error: any) {
        console.error('❌ Error details:', error);
        ctx.reply('⚠️ Failed to fetch wallets. Please try again later.');
    }
});

bot.action('menu_send', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = await getSession(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
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
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    } catch (error: any) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start transfer. Please try again.');
    }
});

bot.action('menu_withdraw', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = await getSession(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
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
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    } catch (error: any) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start withdrawal. Please try again.');
    }
});

bot.action('menu_batch', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = await getSession(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
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
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter the recipient\'s wallet address:', cancelButton);
    } catch (error: any) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start batch transfer. Please try again.');
    }
});

bot.action('menu_transfers', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = await getSession(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
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

        const response = await axios.get(`${API_BASE_URL}/transfers`, {
            headers: {
                Authorization: `Bearer ${ctx.state.token}`
            },
            params
        });

        const { data, count, hasMore }: any = response.data;
        if (!data.length) {
            return ctx.reply('💸 No transfers found.');
        }

        let message = '💸 *Your Recent Transfers:*\n';
        data.forEach((transfer: any) => {
            message += `\n🔹 *Transfer ID:* ${transfer.id}`;
            message += `\nType: ${transfer.type}`;
            message += `\nStatus: ${transfer.status}`;
            message += `\nAmount: ${transfer.amount / 1e8} ${transfer.currency}`;
            message += `\nFee: ${transfer.totalFee} ${transfer.feeCurrency}`;
            message += `\nDate: ${new Date(transfer.createdAt).toLocaleString()}`;
            message += `\nFrom: ${transfer.sourceCountry?.toUpperCase() || 'N/A'}`;
            message += `\nTo: ${transfer.destinationCountry?.toUpperCase() || 'N/A'}`;
            message += '\n';
        });

        message += `\n📊 Page ${params.page} of ${Math.ceil(count / params.limit)}`;
        if (hasMore) {
            message += '\n\nUse /transfers_next to see more transfers.';
        }

        const buttons = [];
        if (params.page > 1) {
            buttons.push(Markup.button.callback('⬅️ Previous', 'transfers_prev'));
        }
        if (hasMore) {
            buttons.push(Markup.button.callback('Next ➡️', 'transfers_next'));
        }
        const keyboard = buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined;

        await ctx.replyWithMarkdown(message, keyboard);
    } catch (error: any) {
        console.error('❌ Error details:', error);
        ctx.reply('⚠️ Failed to fetch transfers. Please try again later.');
    }
});

bot.action('menu_profile', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = await getSession(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
    }
    try {
        const parsedData = JSON.parse(userData);
        const token = parsedData.accessToken;
        const response = await axios.get(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const profile: any = response.data;
        let message = '👤 *Your Profile*\n\n';
        message += `*Name:* ${profile.firstName} ${profile.lastName}\n`;
        message += `*Email:* ${profile.email}\n`;
        message += `*Role:* ${profile.role}\n`;
        message += `*Status:* ${profile.status}\n`;
        message += `*Type:* ${profile.type}\n`;
        message += `\n💼 *Wallet Information*\n`;
        message += `*Address:* \`${profile.walletAddress || 'Not set'}\`\n`;
        message += `*Type:* ${profile.walletAccountType || 'Not set'}\n`;

        await ctx.replyWithMarkdown(message);
    } catch (error) {
        console.error('Error fetching profile:', error);
        ctx.reply('❌ Failed to fetch profile. Please try again.');
    }
});

bot.action('menu_login', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const cancelButton = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_operation')]
        ]);
        ctx.reply('Please enter your email address:', cancelButton);
        sessions.set(ctx.from.id, { step: 'awaiting_email' });
    } catch (error: any) {
        // If it's a query timeout error, send a new message
        if (error.description && error.description.includes('query is too old')) {
            ctx.reply('⚠️ The login button has expired. Please try again.',
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔑 Login', 'menu_login')]
                ])
            );
            return;
        }
        // Handle other errors
        console.error('Error in menu_login:', error);
        ctx.reply('❌ An error occurred. Please try again.');
    }
});

bot.action('menu_logout', async (ctx) => {
    await ctx.answerCbQuery();
    await logoutUser(ctx.from.id);
    ctx.reply('✅ You have been logged out successfully.', persistentKeyboard);
});

// Add a general error handler for callback queries
bot.catch((err: any, ctx: any) => {
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

bot.hears('🔍 KYC Status', async (ctx: any) => {
    await bot.command('kycstatus', ctx);
});

bot.action('menu_kyc', async (ctx: any) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const userData = await getSession(userId);
    if (!userData) {
        return ctx.reply('❌ You are not logged in.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔑 Login', 'menu_login')]
            ])
        );
    }
    try {
        const parsedData = JSON.parse(userData);
        ctx.state.userData = parsedData;
        ctx.state.token = parsedData.accessToken;

        const response = await axios.get(`${API_BASE_URL}/kycs`, {
            headers: {
                Authorization: `Bearer ${ctx.state.token}`
            }
        });

        const { data }: any = response.data;
        if (!data.length) {
            const message = '❌ Please complete your KYC process at [Copperx.io](https://copperx.io)';
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.url('🔗 Complete KYC', 'https://copperx.io')]
            ]);
            return ctx.replyWithMarkdown(message, keyboard);
        }

        const kyc = data[0];
        let message = '🔍 *KYC Status Information*\n\n';
        message += `*Status:* ${kyc.status.toUpperCase()}\n`;
        message += `*Type:* ${kyc.type}\n`;
        message += `*Country:* ${kyc.country}\n`;
        message += `*Provider:* ${kyc.kycProviderCode}\n\n`;

        if (kyc.kycDetail?.kycUrl) {
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.url('🔗 Complete KYC', kyc.kycDetail.kycUrl)]
            ]);
            await ctx.replyWithMarkdown(message, keyboard);
        } else {
            await ctx.replyWithMarkdown(message);
        }
    } catch (error) {
        console.error('Error fetching KYC status:', error);
        ctx.reply('❌ Failed to fetch KYC status. Please try again.');
    }
});

console.log("🚀 Launching bot...");
bot.launch();
console.log("✅ Bot launched successfully");

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
