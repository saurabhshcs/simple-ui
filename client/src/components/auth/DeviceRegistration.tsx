export function DeviceRegistration() {
  return (
    <div className="w-full max-w-sm mx-auto text-center">
      <div className="text-5xl mb-6">🔐</div>
      <h1 className="text-2xl font-semibold text-text-primary mb-2">New device detected</h1>
      <p className="text-text-secondary text-sm leading-relaxed mb-8">
        We've sent a device registration email to your inbox.<br />
        Click the link in that email to register this device,<br />
        then sign in again.
      </p>
      <a href="/login" className="text-accent hover:underline text-sm">
        Back to sign in
      </a>
    </div>
  );
}
