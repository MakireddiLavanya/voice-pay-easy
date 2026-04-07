/**
 * OTP Verification Component
 * Generates OTP server-side, sends to user's email, verifies input.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Loader2, ShieldCheck } from 'lucide-react';

interface OtpVerificationProps {
  userEmail: string;
  onVerified: () => void;
  onCancel: () => void;
}

const OtpVerification = ({ userEmail, onVerified, onCancel }: OtpVerificationProps) => {
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [generatedOtp, setGeneratedOtp] = useState('');

  useEffect(() => {
    sendOtp();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOtp = async () => {
    setSending(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('generate_otp', { p_purpose: 'transaction' });
      if (rpcError) throw rpcError;
      const result = data as { success: boolean; code?: string; error?: string };
      if (!result.success) throw new Error(result.error);
      // In production, send via email. For demo, we show in toast/store locally.
      setGeneratedOtp(result.code || '');
      setSent(true);
      setCountdown(60);
    } catch {
      setError('Failed to generate OTP. Try again.');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError('Enter a valid 6-digit OTP');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('verify_otp', { p_code: otp, p_purpose: 'transaction' });
      if (rpcError) throw rpcError;
      const result = data as { success: boolean; error?: string };
      if (result.success) {
        onVerified();
      } else {
        setError(result.error || 'Invalid OTP');
      }
    } catch {
      setError('Verification failed. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const maskedEmail = userEmail.replace(/(.{2}).+(@.+)/, '$1***$2');

  return (
    <Card className="animate-fade-in">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-lg">Email OTP Verification</CardTitle>
        <CardDescription>
          {sent ? `OTP sent to ${maskedEmail}` : 'Sending OTP to your email...'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Demo: Show OTP for testing */}
        {generatedOtp && (
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Demo OTP (would be sent via email)</p>
            <p className="text-2xl font-bold text-accent tracking-widest">{generatedOtp}</p>
          </div>
        )}

        {sending && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {sent && (
          <>
            <div className="space-y-2">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em] h-14 font-mono"
              />
            </div>

            <Button
              className="w-full h-12"
              onClick={handleVerify}
              disabled={verifying || otp.length !== 6}
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Verify OTP
            </Button>

            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={sendOtp}
              disabled={countdown > 0 || sending}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            </Button>
          </>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        <Button variant="outline" className="w-full" onClick={onCancel}>
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
};

export default OtpVerification;
