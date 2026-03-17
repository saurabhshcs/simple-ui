import { useState } from 'react';
import { apiClient } from '../../api/client';
import { getDeviceFingerprint, getDeviceName } from '../../utils/deviceFingerprint';

interface Props {
  onOtpRequired: (userId: string) => void;
  onDevicePending: () => void;
}

export function LoginForm({ onOtpRequired, onDevicePending }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await apiClient.post('/auth/register', { email, password });
        setIsRegister(false);
        setError('');
        alert('Account created! Please log in.');
        return;
      }

      const fingerprint = await getDeviceFingerprint();
      const deviceName = getDeviceName();
      const res = await apiClient.post('/auth/login', { email, password, deviceFingerprint: fingerprint, deviceName });

      if (res.data.devicePending) {
        onDevicePending();
      } else if (res.data.otpSent) {
        onOtpRequired(res.data.userId);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold text-text-primary mb-2">
        {isRegister ? 'Create account' : 'Welcome back'}
      </h1>
      <p className="text-text-secondary text-sm mb-8">
        {isRegister ? 'Sign up to start chatting' : 'Sign in to continue'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-bg-input border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 rounded-lg bg-bg-input border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Continue'}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary mt-6">
        {isRegister ? 'Already have an account?' : "Don't have an account?"}
        {' '}
        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
          className="text-accent hover:underline"
        >
          {isRegister ? 'Sign in' : 'Sign up'}
        </button>
      </p>
    </div>
  );
}
