import React, { useState } from 'react';
import { Activity, Lock, AlertCircle } from 'lucide-react';

const LoginPage = ({ onLogin, users }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const validUser = users.find(u => u.username === username && u.pass === password);
        if (validUser) {
            onLogin(validUser);
        } else {
            setError('Invalid username or password');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="glass-card w-full max-w-md p-8 rounded-2xl shadow-2xl border border-white/50">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                        <Activity className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
                    <p className="text-slate-500 mt-2">Sign in to manage your campaigns</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full glass-input px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            placeholder="Enter your username"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full glass-input px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-sm font-medium animate-pulse">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <Lock className="w-4 h-4" />
                        Sign In
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-slate-400">
                    Protected by Secure Auth System
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
