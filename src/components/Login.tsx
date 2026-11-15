import React, { useState } from 'react';
import { Music, Sparkles } from 'lucide-react';
import { api } from '../utils/apiClient';

export const Login: React.FC = () => {
  const [writerName, setWriterName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const name = writerName.trim() || 'Writer';
      await api.auth.signInWithGuest(name, name);
    } catch (err: any) {
      console.error('Login error:', err);
      alert('Sign-in failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-paper paper-lines flex items-center justify-center select-none overflow-hidden relative">
      <div className="bg-paper-dark border border-paper-darker rounded-2xl p-8 max-w-sm w-full mx-4 card-warm-md flex flex-col items-center text-center relative z-10 transition-all duration-300">
        
        {/* Lyrical Logo Icon */}
        <div className="w-12 h-12 rounded-xl bg-terracotta/10 border border-terracotta/20 flex items-center justify-center mb-6">
          <Music className="w-6 h-6 text-terracotta" />
        </div>

        {/* Header Titles */}
        <h1 className="font-serif font-bold text-2xl text-ink mb-2">Lyrical</h1>
        <p className="text-xs text-ink-muted leading-relaxed mb-6 max-w-[240px]">
          Collaborative lyric notepad designed around Scandinavian pop math & emotional design.
        </p>

        {/* Writer Name Input & One-click Start */}
        <form onSubmit={handleGuestLogin} className="w-full flex flex-col gap-3">
          <input
            type="text"
            placeholder="Your Pen Name (e.g. Max, Adele)"
            value={writerName}
            onChange={(e) => setWriterName(e.target.value)}
            className="w-full bg-white border border-paper-darker text-ink text-xs rounded-xl px-4 py-3 placeholder:text-ink-muted/50 focus:outline-none focus:border-terracotta/50 transition"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta/90 text-white font-semibold py-3 px-4 rounded-xl text-xs transition duration-200 shadow-paper-sm active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Entering Studio...' : 'Start Writing (Instant Access)'}</span>
          </button>
        </form>

        <p className="text-[10px] text-ink-muted mt-6">
          Powered 100% by Cloudflare Workers, D1 & R2
        </p>
      </div>
    </div>
  );
};
