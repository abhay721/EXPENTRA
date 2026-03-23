import { getToken } from "firebase/messaging";
import { messaging } from "../firebase";

export const getFCMToken = async () => {
    try {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return null;
        }

        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission !== "granted") {
            console.log('Notification permission not granted');
            return null;
        }

        // Specifically for mobile/PWA, ensure service worker is ready
        const registration = await navigator.serviceWorker.ready;

        const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (token) {
            console.log('FCM Token generated successfully');
            return token;
        } else {
            console.log('No registration token available. Request permission to generate one.');
            return null;
        }
    } catch (error) {
        console.error('An error occurred while retrieving token: ', error);
        return null;
    }
};