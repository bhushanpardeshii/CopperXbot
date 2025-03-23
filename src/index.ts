import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import { getSession, storeSession, logoutUser } from './db';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

console.log('Starting bot initialization...');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const API_BASE_URL = 'https://income-api.copperx.io/api';
// Store user sessions
const sessions = new Map();

const isAuthenticated = async (ctx: any, next: any) => {
    console.log("🔍 Inside isAuthenticated middleware");
    const userId = ctx.from.id;
    console.log("👤 User ID:", userId);

    const userData = await getSession(userId);
    console.log("📦 Retrieved user data:", userData);

    if (!userData) {
        console.log("❌ No user data found");
        return ctx.reply('❌ You are not logged in. Use /login to authenticate.');
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
    ctx.reply('Welcome to Copperx Bot! Use /login to authenticate.');
});

bot.command('login', (ctx) => {
    console.log("🔑 Login command received");
    ctx.reply('Please enter your email address:');
    sessions.set(ctx.from.id, { step: 'awaiting_email' });
});

bot.command('logout', async (ctx) => {
    console.log("👋 Logout command received");
    await logoutUser(ctx.from.id);
    ctx.reply('✅ You have been logged out successfully.');
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

        const wallets = response.data;
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
        console.log('🔑 Token from state:', token);

        const response = await axios.get(`${API_BASE_URL}/wallets`, {
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

        const { data, count, hasMore } = response.data;
        if (!data.length) {
            return ctx.reply('💸 No transfers found.');
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

        const { data, count, hasMore } = response.data;
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
            ...keyboard
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
                purposeCode: 'self',  // Set to "self"
                currency: 'USDC'      // Set to "USDC"
            },
            token: ctx.state.token
        });
        ctx.reply('Please enter the recipient\'s wallet address:');
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
                purposeCode: 'self',  // Set to "self"
                currency: 'USDC'      // Set to "USDC"
            },
            token: ctx.state.token
        });
        ctx.reply('Please enter the recipient\'s wallet address:');
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
        ctx.reply('Please enter the recipient\'s wallet address:');
    } catch (error: any) {
        console.error('Error:', error);
        ctx.reply('❌ Failed to start batch transfer. Please try again.');
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
            const response = await axios.post(`${API_BASE_URL}/auth/email-otp/request`, { email });
            sessions.set(ctx.from.id, { step: 'awaiting_otp', email, sid: response.data.sid });
            ctx.reply('OTP sent to your email. Please enter the OTP:');
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
            ctx.reply('✅ Login successful! You are now authenticated.');
            sessions.delete(ctx.from.id);
        } catch (error) {
            console.error("❌ Authentication error:", error);
            ctx.reply('Invalid OTP. Please try again.');
        }
    } else if (userSession.step === 'send_wallet_address') {
        userSession.sendData.walletAddress = ctx.message.text;
        userSession.step = 'send_amount';
        ctx.reply('Please enter the amount to send (minimum 1 USDC):');
    } else if (userSession.step === 'send_amount') {
        const amount = parseFloat(ctx.message.text);

        // Check if amount is at least 1 USDC
        if (amount < 1) {
            ctx.reply('❌ Minimum transfer amount is 1 USDC. Please enter a larger amount:');
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
        ctx.reply('Please enter the amount to withdraw (minimum 1 USDC):');
    } else if (userSession.step === 'withdraw_amount') {
        const amount = parseFloat(ctx.message.text);

        // Check if amount is at least 1 USDC
        if (amount < 1) {
            ctx.reply('❌ Minimum withdrawal amount is 1 USDC. Please enter a larger amount:');
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
        ctx.reply('Please enter the recipient\'s email address:');
    } else if (userSession.step === 'batch_email') {
        userSession.currentRequest.request.email = ctx.message.text;
        userSession.step = 'batch_payee_id';
        ctx.reply('Please enter the payee ID:');
    } else if (userSession.step === 'batch_payee_id') {
        userSession.currentRequest.request.payeeId = ctx.message.text;
        userSession.step = 'batch_amount';
        ctx.reply('Please enter the amount to send (minimum 1 USDC):');
    } else if (userSession.step === 'batch_amount') {
        const amount = parseFloat(ctx.message.text);

        // Check if amount is at least 1 USDC
        if (amount < 1) {
            ctx.reply('❌ Minimum transfer amount is 1 USDC. Please enter a larger amount:');
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

        const transfer = response.data;
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

        const batchResponse = response.data;
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

console.log("🚀 Launching bot...");
bot.launch();
console.log("✅ Bot launched successfully");

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
