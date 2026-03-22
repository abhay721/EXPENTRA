import admin from "../config/firebaseAdmin.js";
import User from "../models/userModel.js";
import Group from "../models/groupModel.js";

/**
 * Get all FCM tokens for specific user IDs
 */
export const getTokensFromUsers = async (userIds) => {
    try {
        console.log("[Debug] Fetching tokens for users:", userIds);
        const users = await User.find({ _id: { $in: userIds } });
        const tokens = [];
        users.forEach(u => {
            if (u.fcmTokens && u.fcmTokens.length > 0) {
                tokens.push(...u.fcmTokens);
            }
        });
        console.log("[Debug] User Tokens Found:", tokens.length);
        return tokens;
    } catch (err) {
        console.error("getTokensFromUsers Error:", err);
        return [];
    }
};

/**
 * Send push notification (Refined for Debugging)
 */
export const sendPushNotification = async (tokens, payload) => {
    try {
        if (!tokens || tokens.length === 0) {
            console.log("[Debug] Skip Sending: NO valid tokens in array");
            return;
        }

        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
            tokens: tokens,
        };

        console.log("--- Sending notification to:", tokens);
        console.log("[Debug] FCM Payload:", JSON.stringify(message, null, 2));

        // Using sendEachForMulticast as sendMulticast is deprecated in v10+
        const response = await admin.messaging().sendEachForMulticast(message);
        
        console.log("--- FCM Response Received ---");
        console.log("FCM Response Status:", JSON.stringify(response, null, 2));
        console.log("Success Count:", response.successCount);
        console.log("Failure Count:", response.failureCount);

        // Cleanup invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    console.log(`[Debug] Token failure at index ${idx}:`, error.code);
                    if (
                        error.code === "messaging/registration-token-not-registered" ||
                        error.code === "messaging/invalid-registration-token"
                    ) {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });

            if (failedTokens.length > 0) {
                console.log("[Debug] Cleaning DB: Removing invalid tokens:", failedTokens.length);
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
        if (!group) {
            console.log("[Debug] notifyGroupMembers: Group not found", groupId);
            return;
        }

        console.log('[Debug] senderId:', senderId?.toString());
        const targetUserIds = [];
        group.members.forEach((m, idx) => {
            const memberUserId = m.user ? m.user.toString() : null;
            console.log(`[Member ${idx}] user field:`, memberUserId, "| Result:", memberUserId !== senderId.toString());
            
            if (memberUserId && memberUserId !== senderId.toString()) {
                targetUserIds.push(m.user);
            } else if (!m.user) {
                console.log(`[Member ${idx}] Skipped because 'user' field is empty (likely not a registered user)`);
            }
        });

        console.log('[Debug] Filtered Recipients:', targetUserIds.length);
        const tokens = await getTokensFromUsers(targetUserIds);
        await sendPushNotification(tokens, payload);
    } catch (err) {
        console.error("notifyGroupMembers Exception:", err);
    }
};
