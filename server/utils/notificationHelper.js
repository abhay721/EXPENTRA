import { firebaseApp, admin } from "../config/firebaseAdmin.js";
import User from "../models/userModel.js";
import Group from "../models/groupModel.js";

/**
 * Get all FCM tokens for specific user IDs
 */
export const getTokensFromUsers = async (userIds) => {
    try {
        const users = await User.find({ _id: { $in: userIds } });
        const tokens = [];
        users.forEach(u => {
            if (u.fcmTokens && u.fcmTokens.length > 0) {
                tokens.push(...u.fcmTokens);
            }
        });
        return tokens;
    } catch (err) {
        console.error("getTokensFromUsers Error:", err);
        return [];
    }
};

/**
 * Send push notification
 */
export const sendPushNotification = async (tokens, payload) => {
    try {
        if (!tokens || tokens.length === 0) return;

        if (!firebaseApp) {
            console.error("❌ Cannot send notification: Firebase App not initialized. Check your credentials.");
            return;
        }

        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    clickAction: payload.data?.url || "/",
                }
            },
            webpush: {
                headers: {
                    Urgency: "high",
                },
                notification: {
                    icon: "/pwa-192x192.png",
                    badge: "/pwa-192x192.png",
                },
                fcm_options: {
                    link: payload.data?.url || "/",
                },
            },
            tokens: tokens,
        };

        console.log("--- Sending notification to:", tokens.length, "tokens");
        const response = await firebaseApp.messaging().sendEachForMulticast(message);

        console.log("--- FCM Result: Success:", response.successCount, "| Failure:", response.failureCount);

        // Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if (
                        error.code === "messaging/registration-token-not-registered" ||
                        error.code === "messaging/invalid-registration-token"
                    ) {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });

            if (failedTokens.length > 0) {
                await User.updateMany(
                    { fcmTokens: { $in: failedTokens } },
                    { $pull: { fcmTokens: { $in: failedTokens } } }
                );
            }
        }
    } catch (error) {
        console.error("CRITICAL FCM Error:", error);
    }
};

/**
 * Broadcast to group
 */
export const notifyGroupMembers = async (groupId, senderId, payload) => {
    try {
        const group = await Group.findById(groupId);
        if (!group) return;

        const targetUserIds = group.members
            .filter(m => m.user && m.user.toString() !== senderId.toString())
            .map(m => m.user);

        const tokens = await getTokensFromUsers(targetUserIds);
        await sendPushNotification(tokens, payload);
    } catch (err) {
        console.error("notifyGroupMembers Exception:", err);
    }
};
