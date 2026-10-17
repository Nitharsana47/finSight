import nodemailer from 'nodemailer';
import { APP_NAME } from "@/lib/brand";
import {
    WELCOME_EMAIL_TEMPLATE,
    NEWS_SUMMARY_EMAIL_TEMPLATE,
    STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
    STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    }
})

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);

    const mailOptions = {
        from: `"${APP_NAME}" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: `Welcome to ${APP_NAME} - your stock market toolkit is ready!`,
        text: `Thanks for joining ${APP_NAME}`,
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
): Promise<void> => {
    const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', date)
        .replace('{{newsContent}}', newsContent);

    const mailOptions = {
        from: `"${APP_NAME} News" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: `📈 Market News Summary Today - ${date}`,
        text: `Today's market news summary from ${APP_NAME}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendPriceAlertEmail = async (
    { email, symbol, company, alertName, alertType, currentPrice, targetPrice }: {
        email: string; symbol: string; company: string; alertName: string;
        alertType: 'upper' | 'lower'; currentPrice: number; targetPrice: number;
    }
): Promise<void> => {
    const formatUsd = (n: number) => `$${n.toFixed(2)}`;
    const template = alertType === 'upper' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;

    const htmlTemplate = template
        .split('{{symbol}}').join(symbol)
        .split('{{company}}').join(company)
        .split('{{currentPrice}}').join(formatUsd(currentPrice))
        .split('{{targetPrice}}').join(formatUsd(targetPrice))
        .split('{{timestamp}}').join(new Date().toUTCString());

    const direction = alertType === 'upper' ? 'rose above' : 'fell below';

    await transporter.sendMail({
        from: `"${APP_NAME} Alerts" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: `🔔 ${symbol} ${direction} ${formatUsd(targetPrice)} - ${alertName}`,
        text: `${alertName}: ${symbol} (${company}) ${direction} your target of ${formatUsd(targetPrice)}. Current price: ${formatUsd(currentPrice)}.`,
        html: htmlTemplate,
    });
};
