import { Telegraf } from 'telegraf';
import axios from 'axios';
import { getSession, storeSession, logoutUser } from './db';
import dotenv from 'dotenv';

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
            }
        });
        console.log('📊 API Response:', response.data);

        const wallets = response.data;
        if (!wallets.length) {
            return ctx.reply('💰 Your wallet has no funds.');
        }

        let message = '📊 *Your Wallet Balances:*';
        wallets.forEach((wallet: any) => {
            message += `\n🔹 *${wallet.network} Wallet*`;
            wallet.balances.forEach((balance: any) => {
                message += `\n    - ${balance.balance} ${balance.symbol}`;
            });
        });

        ctx.replyWithMarkdown(message);
    } catch (error: any) {
        console.error('❌ Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        ctx.reply('⚠️ Failed to fetch balance. Please try again later.');
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
            await storeSession(ctx.from.id, JSON.stringify(response.data));
            ctx.reply('✅ Login successful! You are now authenticated.');
            sessions.delete(ctx.from.id);
        } catch (error) {
            console.error("❌ Authentication error:", error);
            ctx.reply('Invalid OTP. Please try again.');
        }
    }
});

console.log("🚀 Launching bot...");
bot.launch();
console.log("✅ Bot launched successfully");

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
