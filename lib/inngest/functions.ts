import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendPriceAlertEmail, sendWelcomeEmail} from "@/lib/nodemailer";
import { getActiveAlertsForCheck, isAlertTriggered, markAlertTriggered } from "@/lib/alerts";
import { fetchQuotes } from "@/lib/market";
import {getAllUsersForNewsEmail, getWatchlistSymbolsByEmail} from "@/lib/users";
import { getNews } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile)

        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-3.5-flash-lite' }),
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt }
                        ]
                    }]
            }
        })

        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const introText = (part && 'text' in part ? part.text : null) ||`Thanks for joining ${APP_NAME}. You now have the tools to track markets and make smarter moves.`

            const { data: { email, name } } = event;

            return await sendWelcomeEmail({ email, name, intro: introText });
        })

        return {
            success: true,
            message: 'Welcome email sent successfully'
        }
    }
)

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [ { event: 'app/send.daily.news' }, { cron: '0 12 * * *' } ],
    async ({ step }) => {
        // Step #1: Get all users for news delivery
        const users = await step.run('get-all-users', getAllUsersForNewsEmail)

        if(!users || users.length === 0) return { success: false, message: 'No users found for news email' };

        // Step #2: For each user, get watchlist symbols -> fetch news (fallback to general)
        const results = await step.run('fetch-user-news', async () => {
            const perUser: Array<{ user: UserForNewsEmail; articles: MarketNewsArticle[] }> = [];
            for (const user of users as UserForNewsEmail[]) {
                try {
                    const symbols = await getWatchlistSymbolsByEmail(user.email);
                    let articles = await getNews(symbols);
                    // Enforce max 6 articles per user
                    articles = (articles || []).slice(0, 6);
                    // If still empty, fallback to general
                    if (!articles || articles.length === 0) {
                        articles = await getNews();
                        articles = (articles || []).slice(0, 6);
                    }
                    perUser.push({ user, articles });
                } catch (e) {
                    console.error('daily-news: error preparing user news', user.email, e);
                    perUser.push({ user, articles: [] });
                }
            }
            return perUser;
        });

        // Step #3: (placeholder) Summarize news via AI
        const userNewsSummaries: { user: UserForNewsEmail; newsContent: string | null }[] = [];

        for (const { user, articles } of results) {
                try {
                    const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));

                    const response = await step.ai.infer(`summarize-news-${user.email}`, {
                        model: step.ai.models.gemini({ model: 'gemini-3.5-flash-lite' }),
                        body: {
                            contents: [{ role: 'user', parts: [{ text:prompt }]}]
                        }
                    });

                    const part = response.candidates?.[0]?.content?.parts?.[0];
                    const newsContent = (part && 'text' in part ? part.text : null) || 'No market news.'

                    userNewsSummaries.push({ user, newsContent });
                } catch (e) {
                    console.error('Failed to summarize news for : ', user.email);
                    userNewsSummaries.push({ user, newsContent: null });
                }
            }

        // Step #4: (placeholder) Send the emails
        await step.run('send-news-emails', async () => {
                await Promise.all(
                    userNewsSummaries.map(async ({ user, newsContent}) => {
                        if(!newsContent) return false;

                        return await sendNewsSummaryEmail({ email: user.email, date: getFormattedTodayDate(), newsContent })
                    })
                )
            })

        return { success: true, message: 'Daily news summary emails sent successfully' }
    }
)

export const checkPriceAlerts = inngest.createFunction(
    { id: 'check-price-alerts' },
    [ { event: 'app/check.alerts' }, { cron: '*/5 * * * *' } ],
    async ({ step }) => {
        // Step #1: Load every active alert
        const alerts = await step.run('get-active-alerts', getActiveAlertsForCheck);
        if (alerts.length === 0) return { success: true, message: 'No active alerts' };

        // Step #2: Fetch the latest price for each symbol once
        const prices = await step.run('fetch-prices', async () => {
            const quotes = await fetchQuotes(alerts.map((a) => a.symbol));
            return Object.fromEntries(Object.entries(quotes).map(([s, q]) => [s, q?.price ?? null]));
        });

        // Step #3: Find alerts whose condition is met
        const triggered = alerts
            .map((alert) => ({ alert, price: prices[alert.symbol] }))
            .filter((t): t is { alert: typeof t.alert; price: number } => typeof t.price === 'number' && isAlertTriggered(t.alert, t.price));

        // Step #4: Mark each alert triggered, then email the user
        for (const { alert, price } of triggered) {
            await step.run(`notify-${alert.id}`, async () => {
                const claimed = await markAlertTriggered(alert.id, price);
                if (!claimed) return { skipped: true };

                await sendPriceAlertEmail({
                    email: alert.userEmail,
                    symbol: alert.symbol,
                    company: alert.company,
                    alertName: alert.alertName,
                    alertType: alert.alertType,
                    currentPrice: price,
                    targetPrice: alert.threshold,
                });
                return { sent: true };
            });
        }

        return { success: true, checked: alerts.length, triggered: triggered.length };
    }
)
