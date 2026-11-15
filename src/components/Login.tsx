import React, { useState, useEffect, useRef } from 'react';
import { Music, Sparkles } from 'lucide-react';
import { api } from '../utils/apiClient';

const GOOGLE_CLIENT_ID = '14287582180-0eanrl7vhg7h6obhogemb18jkqjmtc24.apps.googleusercontent.com';

interface LoginProps {
  onLoginSuccess?: (session: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [writerName, setWriterName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGuest, setShowGuest] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleCredentialResponse = async (response: any) => {
      if (!response?.credential) return;
      setLoading(true);
      try {
        const sess = await api.auth.signInWithGoogleCredential(response.credential);
        if (onLoginSuccess) {
          onLoginSuccess(sess);
        }
        if (window.location.pathname !== '/' || !onLoginSuccess) {
          window.location.href = '/';
        }
      } catch (err: any) {
        console.error('Google login failed:', err);
        alert('Google Sign-In failed: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    const initializeGoogle = () => {
      const google = (window as any).google;
      if (google?.accounts?.id && googleBtnContainerRef.current) {
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          googleBtnContainerRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'signin_with',
            shape: 'pill',
            logo_alignment: 'left',
            width: 280,
          });
        } catch (e) {
          console.error('Error rendering Google button:', e);
        }
      }
    };

    // If script is already loaded
    if ((window as any).google?.accounts?.id) {
      initializeGoogle();
    } else {
      // Poll briefly for Google script load
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(interval);
          initializeGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const handleGuestLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const name = writerName.trim() || 'Writer';
      const sess = await api.auth.signInWithGuest(name, name);
      if (onLoginSuccess) {
        onLoginSuccess(sess);
      }
      if (window.location.pathname !== '/' || !onLoginSuccess) {
        window.location.href = '/';
      }
    } catch (err: any) {
      console.error('Guest login error:', err);
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
        <p className="text-xs text-ink-muted leading-relaxed mb-8 max-w-[240px]">
          Collaborative lyric notepad. Sign in with Google to access your songs from any device.
        </p>

        {/* Google Sign-In Container */}
        <div className="w-full flex flex-col items-center justify-center min-h-[44px]">
          {loading ? (
            <div className="text-xs text-terracotta font-medium animate-pulse py-2">
              Signing in to studio...
            </div>
          ) : (
            <div ref={googleBtnContainerRef} className="flex justify-center w-full" />
          )}
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3 my-6">
          <div className="flex-1 h-[1px] bg-paper-darker" />
          <span className="text-[10px] text-ink-muted uppercase tracking-wider">or</span>
          <div className="flex-1 h-[1px] bg-paper-darker" />
        </div>

        {/* Guest access option */}
        {!showGuest ? (
          <button
            onClick={() => setShowGuest(true)}
            className="text-xs text-ink-muted hover:text-terracotta transition underline underline-offset-4 cursor-pointer"
          >
            Continue as Guest (Local Only)
          </button>
        ) : (
          <form onSubmit={handleGuestLogin} className="w-full flex flex-col gap-2 mt-1">
            <input
              type="text"
              placeholder="Pen Name (e.g. Max)"
              value={writerName}
              onChange={(e) => setWriterName(e.target.value)}
              className="w-full bg-white border border-paper-darker text-ink text-xs rounded-xl px-4 py-2.5 placeholder:text-ink-muted/50 focus:outline-none focus:border-terracotta/50 transition"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-paper-dark border border-paper-darker hover:border-terracotta/30 text-ink font-semibold py-2.5 px-4 rounded-xl text-xs transition duration-200 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-terracotta" />
              <span>Enter as Guest</span>
            </button>
          </form>
        )}

        <p className="text-[10px] text-ink-muted mt-8">
          Cloudflare Workers &bull; D1 Database &bull; R2 Storage
        </p>
      </div>
    </div>
  );
};
