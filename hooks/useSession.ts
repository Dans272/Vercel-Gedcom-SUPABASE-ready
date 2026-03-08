import { useEffect, useState, useRef, useCallback } from 'react';
import { AppView, User } from '../types';
import { supabase } from '../src/lib/supabaseClient';
import { hasLegacyData, migrateLegacyData } from '../src/lib/migrateLegacy';

export const useSession = () => {
  const [view, setView] = useState<AppView>(AppView.SPLASH);
  const [user, setUser] = useState<User | null>(null);
  const [migrating, setMigrating] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    // Immediately check for existing session (handles page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !initialized.current) {
        const sb = session.user;
        setUser({
          id: sb.id,
          email: sb.email ?? '',
          name: (sb.user_metadata?.name as string) ?? sb.email?.split('@')[0] ?? 'User',
          createdAt: sb.created_at ?? new Date().toISOString(),
        });
        setView(AppView.HOME);
        initialized.current = true;
      }
    }).catch((err) => { console.error('[session] getSession error:', err); });

    // Listen for future auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const sb = session.user;
          const appUser: User = {
            id: sb.id,
            email: sb.email ?? '',
            name: (sb.user_metadata?.name as string) ?? sb.email?.split('@')[0] ?? 'User',
            createdAt: sb.created_at ?? new Date().toISOString(),
          };
          setUser(appUser);

          // One-time legacy migration (idempotent)
          if (hasLegacyData()) {
            setMigrating(true);
            try {
              await migrateLegacyData(sb.id, sb.email);
            } catch (err) {
              console.error('[session] Legacy migration error:', err);
            } finally {
              setMigrating(false);
            }
          }

          if (!initialized.current) {
            setView(AppView.HOME);
            initialized.current = true;
          }
        } else {
          setUser(null);
          if (!initialized.current) {
            // show splash briefly, then login
            setTimeout(() => {
              if (!initialized.current) {
                setView(AppView.LOGIN);
                initialized.current = true;
              }
            }, 2500);
          } else {
            setView(AppView.LOGIN);
          }
        }
      }
    );

    return () => { subscription.unsubscribe(); };
  }, []);

  const login = useCallback((u: User) => {
    // called by Auth component after successful signIn/signUp
    setUser(u);
    setView(AppView.HOME);
  }, []);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch (err) { console.error('[session] signOut error:', err); }
    setUser(null);
    setView(AppView.LOGIN);
  }, []);

  return { view, setView, user, setUser, login, logout, migrating };
};
