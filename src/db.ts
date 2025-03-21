import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
    console.error("❌ Redis error:", err);
});

redisClient.connect();
async function logoutUser(userId: number) {
    await redisClient.del(`user:${userId}`);
}
async function getSession(userId: number): Promise<string | null> {
    return await redisClient.get(`user:${userId}`);
}
async function storeSession(userId: number, token: string) {
    await redisClient.set(`user:${userId}`, token);
}

export { logoutUser, getSession, storeSession };
