import Link from "next/link";
import {auth} from "@/lib/better-auth/auth";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import Logo from "@/components/Logo";
import {APP_TAGLINE} from "@/lib/brand";

// Single centered card for sign-in and sign-up
const Layout = async ({ children }: { children : React.ReactNode }) => {
    const session = await auth.api.getSession({ headers: await headers() })

    if(session?.user) redirect('/')

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:py-16">
            {/* Soft glow behind the card */}
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[720px] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-500/10 blur-3xl" />

            <Link href="/" className="relative mb-10 scale-125">
                <Logo />
            </Link>

            <div className="relative w-full max-w-xl rounded-3xl border border-gray-600/60 bg-gray-800/80 p-6 shadow-2xl backdrop-blur-sm sm:p-10">
                {children}
            </div>

            <p className="relative mt-8 max-w-xl text-center text-base text-gray-500">{APP_TAGLINE}</p>
        </main>
    )
}
export default Layout
