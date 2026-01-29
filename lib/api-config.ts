export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost/POS-System-Spirited-Wines--main/api';

if (!process.env.NEXT_PUBLIC_API_URL) {
    console.warn('NEXT_PUBLIC_API_URL is not defined in environment variables. Falling back to default: ' + API_URL);
}
