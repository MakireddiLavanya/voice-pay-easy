/**
 * Authentication Guard Component
 * Multi-auth system supporting: Voice, PIN, or Voice+PIN (High Security).
 * Shows the appropriate auth challenge before allowing a transaction.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Mic, Lock, ShieldCheck } from 'lucide-react';
import PinInput from '@/components/PinInput';
import VoiceCodeVerify from '@/components/VoiceCodeVerify';
import { supabase } from '@/integrations/supabase/client';

type AuthMode = 'voice' | 'pin' | 'voice_pin';

interface AuthenticationGuardProps {
  authMode: AuthMode;
  hasPinSet: boolean;
  storedPassphrase: string | null;
  voiceTolerance: number;
  onAuthenticated: () => void;
  onCancel: () => void;
  onLogAttempt: (method: string, success: boolean, details?: string) => void;
  onVoiceMismatch: () => void;
}

const AuthenticationGuard = ({
  authMode,
  hasPinSet,
  storedPassphrase,
  voiceTolerance,
  onAuthenticated,
  onCancel,
  onLogAttempt,
  onVoiceMismatch,
}: AuthenticationGuardProps) => {
  const [step, setStep] = useState<'voice' | 'pin' | 'fallback_pin'>(() => {
    if (authMode === 'pin') return 'pin';
    return 'voice';
  });
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);

  const handlePinSubmit = async (enteredPin: string) => {
    setVerifyingPin(true);
    setPinError('');
    try {
      const { data, error } = await supabase.rpc('verify_transaction_pin', { p_pin: enteredPin });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (result.success) {
        onLogAttempt('pin', true);
        onAuthenticated();
      } else {
        setPinError(result.error || 'Incorrect PIN. Try again.');
        onLogAttempt('pin', false, 'Incorrect PIN');
      }
    } catch {
      setPinError('Verification failed. Try again.');
      onLogAttempt('pin', false, 'Server error');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleVoiceVerified = () => {
    onLogAttempt('voice', true);
    if (authMode === 'voice_pin') {
      // Voice passed, now need PIN
      setStep('pin');
    } else {
      onAuthenticated();
    }
  };

  const handleVoiceFailed = () => {
    onLogAttempt('voice', false, 'Voice mismatch - max attempts exceeded');
    onVoiceMismatch();
    // Fallback: allow PIN as backup
    setStep('fallback_pin');
  };

  // Auth mode selection screen (when no mode set yet or choosing)
  if (step === 'voice' && (authMode === 'voice' || authMode === 'voice_pin')) {
    if (!storedPassphrase) {
      // Voice not enrolled, fall back to PIN
      return (
        <Card className="animate-fade-in">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mb-2">
              <Mic className="w-7 h-7 text-warning" />
            </div>
            <CardTitle>Voice Not Enrolled</CardTitle>
            <CardDescription>
              Please set up voice authentication first, or use PIN.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => setStep('pin')}>
              <Lock className="w-4 h-4 mr-2" /> Use PIN Instead
            </Button>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <VoiceCodeVerify
        storedPassphrase={storedPassphrase}
        voiceTolerance={voiceTolerance}
        onVerified={handleVoiceVerified}
        onCancel={onCancel}
        onFailed={handleVoiceFailed}
      />
    );
  }

  if (step === 'pin' || step === 'fallback_pin') {
    return (
      <Card className="animate-fade-in">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            {step === 'fallback_pin' ? (
              <ShieldCheck className="w-7 h-7 text-warning" />
            ) : (
              <Lock className="w-7 h-7 text-primary" />
            )}
          </div>
          <CardTitle className="text-lg">
            {step === 'fallback_pin' ? 'Backup PIN Verification' : 
             authMode === 'voice_pin' ? 'Step 2: Enter PIN' : 'Enter Transaction PIN'}
          </CardTitle>
          {step === 'fallback_pin' && (
            <CardDescription className="text-warning">
              Voice verification failed. Enter your PIN as backup.
            </CardDescription>
          )}
          {authMode === 'voice_pin' && step === 'pin' && (
            <CardDescription className="text-success">
              ✓ Voice verified. Now enter your PIN.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPinSet ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No PIN set. Please set a transaction PIN in your profile settings.
              </p>
              <Button variant="outline" className="w-full" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <PinInput onSubmit={handlePinSubmit} error={pinError} disabled={verifyingPin} />
              <Button variant="outline" className="w-full mt-2" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default AuthenticationGuard;
