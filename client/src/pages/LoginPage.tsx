import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { OtpForm } from '../components/auth/OtpForm';
import { DeviceRegistration } from '../components/auth/DeviceRegistration';
import { useAuthStore } from '../stores/authStore';

type Step = 'login' | 'otp' | 'device';

export function LoginPage() {
  const [step, setStep] = useState<Step>('login');
  const [userId, setUserId] = useState('');
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-text-primary">Simple UI</h1>
          <p className="text-text-secondary text-sm mt-1">Your personal AI chat interface</p>
        </div>

        {step === 'login' && (
          <LoginForm
            onOtpRequired={(id) => { setUserId(id); setStep('otp'); }}
            onDevicePending={() => setStep('device')}
          />
        )}
        {step === 'otp' && (
          <OtpForm userId={userId} onDevicePending={() => setStep('device')} />
        )}
        {step === 'device' && <DeviceRegistration />}
      </div>
    </div>
  );
}
