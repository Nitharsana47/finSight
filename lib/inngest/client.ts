import { Inngest} from "inngest";
import { APP_ID } from "@/lib/brand";

export const inngest = new Inngest({
    id: APP_ID,
    ai: { gemini: { apiKey: process.env.GEMINI_API_KEY! }}
})
