import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { getDeviceFingerprint, getDeviceName } from '../../utils/deviceFingerprint';

interface Props {
  userId: string;
  onDevicePending: () => void;
}

export function OtpForm({ userId, onDevicePending }: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(600);
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const ref4 = useRef<HTMLInputElement>(null);
  const ref5 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1, ref2, ref3, ref4, ref5];
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    refs[0]?.current?.focus();
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDigit = (idx: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    if (char && idx < 5) refs[idx + 1]?.current?.focus();

    if (next.every((d) => d)) {
      submit(next.join(''));
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs[idx - 1]?.current?.focus();
    }
  };

  const submit = async (code: string) => {
    setError('');
    setLoading(true);
    try {
      const fingerprint = await getDeviceFingerprint();
      const deviceName = getDeviceName();
      const res = await apiClient.post('/auth/verify-otp', {
        userId, code, deviceFingerprint: fingerprint, deviceName,
      });
      if (res.data.devicePending) {
        onDevicePending();
      } else {
        setAuth(res.data.user, res.data.token);
      }
    } catch {
      setError('Invalid or expired code. Please try again.');
      setDigits(['', '', '', '', '', '']);
      refs[0]?.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    await apiClient.post('/auth/resend-otp', { userId });
    setSecondsLeft(600);
    setDigits(['', '', '', '', '', '']);
    refs[0]?.current?.focus();
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Check your email</h1>
      <p className="text-text-secondary text-sm mb-8">
        Enter the 6-digit code we sent. Expires in {mm}:{ss}.
      </p>

      <div className="flex justify-center gap-3 mb-4">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-11 h-14 text-center text-xl font-mono rounded-lg bg-bg-input border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {loading && <p className="text-text-secondary text-sm">Verifying…</p>}

      {secondsLeft === 0 && (
        <button onClick={resend} className="text-accent hover:underline text-sm">
          Resend code
        </button>
      )}
    </div>
  );
}
