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
exports.logoutUser = logoutUser;
exports.getSession = getSession;
exports.storeSession = storeSession;
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || "redis://localhost:6379",
});
redisClient.on("error", (err) => {
    console.error("❌ Redis error:", err);
});
redisClient.connect();
function logoutUser(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield redisClient.del(`user:${userId}`);
    });
}
function getSession(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield redisClient.get(`user:${userId}`);
    });
}
function storeSession(userId, token) {
    return __awaiter(this, void 0, void 0, function* () {
        yield redisClient.set(`user:${userId}`, token);
    });
}
