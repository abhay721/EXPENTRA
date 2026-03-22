import admin from "firebase-admin";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initializeFirebase = async () => {
    try {
        const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
        const serviceAccount = JSON.parse(
            await readFile(serviceAccountPath, "utf8")
        );

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    } catch (error) {
        console.error("Firebase Admin initialization error:", error.message);
    }
};

await initializeFirebase();

export default admin;