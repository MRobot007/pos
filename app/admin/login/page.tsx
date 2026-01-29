'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { animate } from 'animejs'
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { API_URL } from '@/lib/api-config'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const apiUrl = API_URL

    useEffect(() => {
        // Initial entry animations
        if (document.querySelectorAll('.animate-in').length > 0) {
            animate('.animate-in', {
                opacity: [0, 1],
                translateY: [30, 0],
                delay: (el: any, i: number) => i * 150,
                ease: 'outExpo',
                duration: 1000
            })
        }

        if (document.querySelectorAll('.floating-logo').length > 0) {
            animate('.floating-logo', {
                translateY: [-10, 10],
                alternate: true,
                loop: true,
                ease: 'inOutQuad',
                duration: 3000
            })
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        if (!apiUrl) throw new Error('API URL not defined')

        try {
            const response = await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
                cache: 'no-store'
            })

            const isJson = response.headers.get('content-type')?.includes('application/json')
            const data = isJson ? await response.json() : null

            if (!response.ok) {
                setError(data?.error || `Server error: ${response.status}`)
                setLoading(false)
                return
            }

            localStorage.setItem('token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))

            // Exit animation
            animate('.login-card', {
                scale: [1, 0.95],
                opacity: [1, 0],
                ease: 'inExpo',
                duration: 500,
                onComplete: () => {
                    const role = data.user.role?.toUpperCase()
                    if (role === 'OWNER' || role === 'MANAGER') {
                        router.push('/admin')
                    } else {
                        router.push('/')
                    }
                }
            })
        } catch (err) {
            setError('Network error. Please try again.')
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-white relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-50 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 opacity-50" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-100 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 opacity-50" />

            <div className="login-card glass-card w-full max-w-lg rounded-[40px] p-12 relative overflow-hidden border-purple-50 shadow-2xl shadow-purple-900/10">
                <div className="relative z-10">
                    <div className="animate-in mb-10 flex flex-col items-center">
                        <div className="h-24 px-8 py-4 bg-primary rounded-[2.5rem] border border-white/10 shadow-2xl relative group hover:scale-105 transition-all duration-500 flex items-center justify-center shadow-primary/30">
                            <Image
                                src="/logo.avif"
                                alt="Spirited Wines Logo"
                                width={180}
                                height={60}
                                className="h-full w-auto object-contain filter drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                                priority
                            />
                        </div>
                        <h1 className="text-4xl font-black font-outfit text-primary tracking-[0.1em] uppercase mt-6">Spirited Wines</h1>
                        <p className="text-purple-800 mt-2 font-black uppercase text-[10px] tracking-[0.3em] opacity-80">Next Gen POS Administration</p>
                    </div>

                    {error && (
                        <div className="animate-in bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                            <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="animate-in space-y-2">
                            <label className="text-sm font-bold text-primary/70 ml-1 uppercase tracking-widest text-[10px]">ID / Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input-field w-full pl-12 font-semibold"
                                    placeholder="owner@spiritedwines.com"
                                />
                            </div>
                        </div>

                        <div className="animate-in space-y-2">
                            <label className="text-sm font-bold text-primary/70 ml-1 uppercase tracking-widest text-[10px]">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field w-full pl-12 font-semibold"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="animate-in premium-button w-full h-14 flex items-center justify-center gap-2 text-white group shadow-xl shadow-primary/20"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span className="font-black uppercase tracking-widest text-sm">Enter Dashboard</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="animate-in mt-12 pt-8 border-t border-purple-50 flex flex-col items-center">
                        <p className="text-[10px] text-purple-600 uppercase tracking-[0.3em] font-black mb-6">Quick Access Credentials</p>
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div
                                onClick={() => { setEmail('owner@spiritedwines.com'); setPassword('admin123'); }}
                                className="bg-purple-50/50 border border-purple-100 p-4 rounded-3xl text-center hover:bg-purple-100 transition-colors cursor-pointer group"
                            >
                                <p className="text-[10px] text-primary font-black uppercase mb-1">Owner</p>
                                <p className="text-[9px] text-purple-700 group-hover:text-primary transition-colors font-bold break-all">owner@spiritedwines.com</p>
                                <p className="text-xs text-purple-600 group-hover:text-primary transition-colors font-bold">admin123</p>
                            </div>
                            <div
                                onClick={() => { setEmail('manager@spiritedwines.com'); setPassword('admin123'); }}
                                className="bg-purple-50/50 border border-purple-100 p-4 rounded-3xl text-center hover:bg-purple-100 transition-colors cursor-pointer group"
                            >
                                <p className="text-[10px] text-accent font-black uppercase mb-1">Manager</p>
                                <p className="text-[9px] text-purple-700 group-hover:text-primary transition-colors font-bold break-all">manager@spiritedwines.com</p>
                                <p className="text-xs text-purple-600 group-hover:text-primary transition-colors font-bold">admin123</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
