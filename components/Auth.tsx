import React, { useState } from 'react';
import { Anchor, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../src/lib/supabaseClient';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAction = async (isRegister: boolean) => {
    if (!email || !password) { setError('Required fields missing.'); return; }
    setIsAuthLoading(true);
    setError('');

    try {
      if (isRegister) {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: email.split('@')[0] } },
        });
        if (err) { setError(err.message); setIsAuthLoading(false); return; }
        if (data.user) {
          onLogin({
            id: data.user.id,
            email: data.user.email ?? email,
            name: email.split('@')[0],
            createdAt: data.user.created_at ?? new Date().toISOString(),
          });
        } else {
          setError('Check your email to confirm your account.');
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) { setError(err.message); setIsAuthLoading(false); return; }
        if (data.user) {
          onLogin({
            id: data.user.id,
            email: data.user.email ?? email,
            name: (data.user.user_metadata?.name as string) ?? email.split('@')[0],
            createdAt: data.user.created_at ?? new Date().toISOString(),
          });
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f2eb] p-8 overflow-y-auto">
      <header className="mt-16 mb-12 text-center space-y-4">
        <div className="w-16 h-16 bg-stone-900 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl"><Anchor size={32} /></div>
        <h2 className="text-4xl font-serif">Eternal</h2>
        <p className="text-stone-400 text-xs italic">Family Archive Platform</p>
      </header>

      {error && <div className="mb-4 p-4 bg-red-50 text-red-700 text-[10px] font-bold uppercase text-center rounded-xl border border-red-100">{error}</div>}

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-white border rounded-2xl py-4 px-6 font-serif outline-none shadow-sm text-stone-900 placeholder-stone-400" />
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-white border rounded-2xl py-4 px-6 font-serif outline-none shadow-sm text-stone-900 placeholder-stone-400" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300">{showPassword ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        </div>
        <div className="flex gap-2 pt-4">
          <button onClick={() => handleAction(false)} className="flex-1 bg-stone-900 text-white py-5 rounded-2xl font-bold uppercase text-[11px] shadow-lg flex items-center justify-center space-x-2">
            {isAuthLoading ? <RefreshCw className="animate-spin" size={16} /> : <span>Sign In</span>}
          </button>
          <button onClick={() => handleAction(true)} className="flex-1 bg-amber-600 text-white py-5 rounded-2xl font-bold uppercase text-[11px] shadow-lg">Register</button>
        </div>
      </form>
    </div>
  );
};

export default Auth;
