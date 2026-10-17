import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';

export async function getSessionUser(): Promise<User | null> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) return null;
        return { id: session.user.id, name: session.user.name, email: session.user.email };
    } catch {
        return null;
    }
}

export async function requireUser(): Promise<User> {
    const user = await getSessionUser();
    if (!user) throw new Error('You must be signed in');
    return user;
}

// Profile answers from the sign-up form, stored on the Better Auth user document.
export async function getUserProfile(email: string): Promise<UserProfile> {
    const fallback: UserProfile = { country: '', investmentGoals: 'Balanced', riskTolerance: 'Medium', preferredIndustry: 'Technology' };
    try {
        const mongoose = await connectToDatabase();
        const doc = await mongoose.connection.db?.collection('user').findOne(
            { email },
            { projection: { country: 1, investmentGoals: 1, riskTolerance: 1, preferredIndustry: 1 } }
        );
        if (!doc) return fallback;
        return {
            country: doc.country || fallback.country,
            investmentGoals: doc.investmentGoals || fallback.investmentGoals,
            riskTolerance: doc.riskTolerance || fallback.riskTolerance,
            preferredIndustry: doc.preferredIndustry || fallback.preferredIndustry,
        };
    } catch {
        return fallback;
    }
}
