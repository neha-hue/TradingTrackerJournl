import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface AuthPageProps {
  /** Message from a failed automatic sign-in attempt, if there was one. */
  authError?: string | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ authError }) => {
  const { showToast, signIn, signUp } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        showToast('Account created!', 'success');
      } else {
        await signIn(email, password);
        showToast('Signed in successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <div className="logo-text font-bold">
            TradeVault <span>Pro</span>
          </div>
        </div>

        <h3 className="mb-2 text-center text-lg">
          {isSignUp ? 'Create your Account' : 'Sign in to your Journal'}
        </h3>

        <p className="text-[12px] text-center text-secondary mb-4">
          You stay signed in on this device - you will not be asked again.
        </p>

        {authError && (
          <p className="text-[12px] text-center text-danger mb-3">{authError}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full justify-center p-[10px] mt-2"
            disabled={loading}
          >
            {loading ? (
              <span><i className="fa-solid fa-spinner fa-spin"></i> Processing...</span>
            ) : (
              <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
            )}
          </button>
        </form>

        <div className="h-px bg-border my-3.5"></div>

        <p className="text-[13px] text-center text-secondary">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-accent cursor-pointer font-semibold"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </span>
        </p>
      </div>
    </div>
  );
};
export default AuthPage;
