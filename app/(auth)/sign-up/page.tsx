'use client';

import {useState} from "react";
import {useForm} from "react-hook-form";
import {Button} from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import {CountrySelectField} from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import {signUpWithEmail} from "@/lib/actions/auth.actions";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {ArrowLeft, ArrowRight, Loader2} from "lucide-react";
import {cn} from "@/lib/utils";

const GOALS = [
    { value: 'Growth', label: 'Growth', text: 'Grow my money over time' },
    { value: 'Income', label: 'Income', text: 'Steady dividends and income' },
    { value: 'Balanced', label: 'Balanced', text: 'A mix of growth and safety' },
    { value: 'Conservative', label: 'Conservative', text: 'Protect what I already have' },
];

const RISKS = [
    { value: 'Low', label: 'Low', text: 'Small ups and downs' },
    { value: 'Medium', label: 'Medium', text: 'Some swings are fine' },
    { value: 'High', label: 'High', text: 'Big swings for bigger gains' },
];

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer Goods'];

type Option = { value: string; label: string; text: string };

// Clickable option cards: the selected one gets a gold border and tint
const OptionCards = ({ options, value, onChange, cols }: { options: Option[]; value: string; onChange: (v: string) => void; cols: string }) => (
    <div className={cn('grid gap-2', cols)} role="radiogroup">
        {options.map((o) => (
            <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={value === o.value}
                onClick={() => onChange(o.value)}
                className={cn(
                    'rounded-xl border p-4 text-left transition-colors cursor-pointer',
                    value === o.value ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-600 bg-gray-900/40 hover:border-gray-500'
                )}
            >
                <p className={cn('text-base font-semibold', value === o.value ? 'text-yellow-500' : 'text-gray-100')}>{o.label}</p>
                <p className="mt-0.5 text-sm text-gray-500">{o.text}</p>
            </button>
        ))}
    </div>
);

const SignUp = () => {
    const router = useRouter()
    const [step, setStep] = useState<1 | 2>(1);
    const {
        register,
        handleSubmit,
        control,
        trigger,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormData>({
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            country: 'US',
            investmentGoals: 'Growth',
            riskTolerance: 'Medium',
            preferredIndustry: 'Technology'
        },
        mode: 'onBlur'
    }, );

    const goal = watch('investmentGoals');
    const risk = watch('riskTolerance');
    const industry = watch('preferredIndustry');
    const firstName = watch('fullName').trim().split(' ')[0];

    const next = async () => {
        if (await trigger(['fullName', 'email', 'password'])) setStep(2);
    };

    const onSubmit = async (data: SignUpFormData) => {
        try {
            const result = await signUpWithEmail(data);
            if (result.success) router.push('/');
            else toast.error('Sign up failed', { description: 'This email may already be registered. Try signing in instead.' });
        } catch (e) {
            console.error(e);
            toast.error('Sign up failed', {
                description: e instanceof Error ? e.message : 'Failed to create an account.'
            })
        }
    }

    return (
        <>
            {/* Step indicator */}
            <div className="mb-6">
                <div className="flex gap-1.5" aria-hidden="true">
                    {[1, 2].map((s) => (
                        <div key={s} className={cn('h-1 flex-1 rounded-full transition-colors', s <= step ? 'bg-yellow-500' : 'bg-gray-600')} />
                    ))}
                </div>
                <p className="mt-2 text-sm font-medium text-gray-500">Step {step} of 2 · {step === 1 ? 'Your account' : 'Your investing style'}</p>
            </div>

            <h1 className="form-title mb-2!">{step === 1 ? 'Create your account' : `Nice to meet you${firstName ? `, ${firstName}` : ''}`}</h1>
            <p className="mb-8 text-center text-base text-gray-500">
                {step === 1 ? 'Track stocks, set price alerts and see your portfolio risk.' : 'This tailors your stock summaries and portfolio review.'}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className={step === 1 ? 'space-y-5' : 'hidden'}>
                    <InputField
                        name="fullName"
                        label="Full name"
                        placeholder="Your name"
                        register={register}
                        error={errors.fullName}
                        validation={{ required: 'Full name is required', minLength: { value: 2, message: 'Enter at least 2 characters' } }}
                    />

                    <InputField
                        name="email"
                        label="Email"
                        placeholder="you@example.com"
                        register={register}
                        error={errors.email}
                        validation={{ required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' } }}
                    />

                    <InputField
                        name="password"
                        label="Password"
                        placeholder="At least 8 characters"
                        type="password"
                        register={register}
                        error={errors.password}
                        validation={{ required: 'Password is required', minLength: { value: 8, message: 'Use at least 8 characters' } }}
                    />

                    <Button type="button" onClick={next} className="yellow-btn w-full mt-2">
                        Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className={step === 2 ? 'space-y-5' : 'hidden'}>
                    <CountrySelectField
                        name="country"
                        label="Country"
                        control={control}
                        error={errors.country}
                        required
                    />

                    <div>
                        <p className="form-label mb-2">What&apos;s your main goal?</p>
                        <OptionCards options={GOALS} value={goal} onChange={(v) => setValue('investmentGoals', v)} cols="grid-cols-2" />
                    </div>

                    <div>
                        <p className="form-label mb-2">How much risk are you comfortable with?</p>
                        <OptionCards options={RISKS} value={risk} onChange={(v) => setValue('riskTolerance', v)} cols="grid-cols-1 sm:grid-cols-3" />
                    </div>

                    <div>
                        <p className="form-label mb-2">Which industry interests you most?</p>
                        <div className="flex flex-wrap gap-2">
                            {INDUSTRIES.map((ind) => (
                                <button
                                    key={ind}
                                    type="button"
                                    onClick={() => setValue('preferredIndustry', ind)}
                                    aria-pressed={industry === ind}
                                    className={cn(
                                        'rounded-full border px-4 py-2 text-sm sm:text-base transition-colors cursor-pointer',
                                        industry === ind ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500' : 'border-gray-600 text-gray-400 hover:border-gray-500'
                                    )}
                                >
                                    {ind}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-12 border-gray-600 bg-transparent text-gray-400 hover:bg-gray-700 hover:text-gray-100">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="yellow-btn flex-1">
                            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : 'Create account'}
                        </Button>
                    </div>
                </div>

                <FooterLink text="Already have an account?" linkText="Sign in" href="/sign-in" />
            </form>
        </>
    )
}
export default SignUp;
