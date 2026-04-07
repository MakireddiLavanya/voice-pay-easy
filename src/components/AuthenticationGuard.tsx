/**
 * Authentication Guard Component - Enhanced
 * Multi-auth: Voice, PIN, OTP, Face, or combinations.
 * Includes account lock check, failed attempt tracking, and OTP for high-value.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Mic, Lock, ShieldCheck, ShieldAlert, Camera, Mail } from 'lucide-react';
import PinInput from '@/components/PinInput';
import VoiceCodeVerify from '@/components/VoiceCodeVerify';
import OtpVerification from '@/components/OtpVerification';
import FaceAuth from '@/components/FaceAuth';
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
  /** If amount > 5000, require OTP as extra step */
  transactionAmount?: number;
  userEmail?: string;
  faceEnrolled?: boolean;
  faceReference?: string | null;
}

type AuthStep = 'lock_check' | 'voice' | 'pin' | 'fallback_pin' | 'otp' | 'face' | 'choose_2fa';

const AuthenticationGuard = ({
  authMode,
  hasPinSet,
  storedPassphrase,
  voiceTolerance,
  onAuthenticated,
  onCancel,
  onLogAttempt,
  onVoiceMismatch,
  transactionAmount = 0,
  userEmail = '',
  faceEnrolled = false,
  faceReference = null,
}: AuthenticationGuardProps) => {
  const [step, setStep] = useState<AuthStep>('lock_check');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<string | null>(null);

  const needsOtp = transactionAmount > 5000;

  // Check account lock on mount
  useEffect(() => {
    checkLock();
  }, []);

  const checkLock = async () => {
    try {
      const { data } = await supabase.rpc('check_account_locked');
      const result = data as { locked: boolean; until?: string; failed_attempts?: number };
      if (result.locked) {
        setIsLocked(true);
        setLockUntil(result.until || null);
      } else {
        setIsLocked(false);
        // Determine initial step
        if (authMode === 'pin') setStep('pin');
        else setStep('voice');
      }
    } catch {
      if (authMode === 'pin') setStep('pin');
      else setStep('voice');
    }
  };

  const handleFailure = async () => {
    try {
      const { data } = await supabase.rpc('increment_failed_attempts');
      const result = data as { locked: boolean; attempts: number };
      if (result.locked) {
        setIsLocked(true);
        setLockUntil(new Date(Date.now() + 30 * 60 * 1000).toISOString());
      }
    } catch {
      // Silent
    }
  };

  const handleSuccess = async () => {
    try {
      await supabase.rpc('reset_failed_attempts');
    } catch {
      // Silent
    }
  };

  const handlePinSubmit = async (enteredPin: string) => {
    setVerifyingPin(true);
    setPinError('');
    try {
      const { data, error } = await supabase.rpc('verify_transaction_pin', { p_pin: enteredPin });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (result.success) {
        onLogAttempt('pin', true);
        await handleSuccess();
        // Check if OTP needed for high-value
        if (needsOtp) {
          setStep('otp');
        } else {
          onAuthenticated();
        }
      } else {
        setPinError(result.error || 'Incorrect PIN. Try again.');
        onLogAttempt('pin', false, 'Incorrect PIN');
        await handleFailure();
      }
    } catch {
      setPinError('Verification failed. Try again.');
      onLogAttempt('pin', false, 'Server error');
      await handleFailure();
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleVoiceVerified = async () => {
    onLogAttempt('voice', true);
    await handleSuccess();
    if (authMode === 'voice_pin') {
      setStep('pin');
    } else if (needsOtp) {
      setStep('otp');
    } else {
      onAuthenticated();
    }
  };

  const handleVoiceFailed = async () => {
    onLogAttempt('voice', false, 'Voice mismatch - max attempts exceeded');
    onVoiceMismatch();
    await handleFailure();
    setStep('fallback_pin');
  };

  const handleOtpVerified = async () => {
    onLogAttempt('otp', true);
    onAuthenticated();
  };

  const handleFaceVerified = async () => {
    onLogAttempt('face', true);
    await handleSuccess();
    if (needsOtp) {
      setStep('otp');
    } else {
      onAuthenticated();
    }
  };

  const handleFaceFailed = async () => {
    onLogAttempt('face', false, 'Face verification failed');
    await handleFailure();
    setStep('fallback_pin');
  };

  // Locked state
  if (isLocked) {
    return (
      <Card className="animate-fade-in border-destructive/30">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <CardTitle className="text-destructive">Account Locked</CardTitle>
          <CardDescription>
            Too many failed authentication attempts. Your account is temporarily locked for 30 minutes.
          </CardDescription>
          {lockUntil && (
            <p className="text-xs text-muted-foreground mt-2">
              Locked until: {new Date(lockUntil).toLocaleTimeString('en-IN')}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={onCancel}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Lock check loading
  if (step === 'lock_check') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Voice step
  if (step === 'voice' && (authMode === 'voice' || authMode === 'voice_pin')) {
    if (!storedPassphrase) {
      return (
        <Card className="animate-fade-in">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mb-2">
              <Mic className="w-7 h-7 text-warning" />
            </div>
            <CardTitle>Voice Not Enrolled</CardTitle>
            <CardDescription>Please set up voice authentication first, or use another method.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => setStep('pin')}>
              <Lock className="w-4 h-4 mr-2" /> Use PIN Instead
            </Button>
            {faceEnrolled && (
              <Button variant="outline" className="w-full" onClick={() => setStep('face')}>
                <Camera className="w-4 h-4 mr-2" /> Use Face Instead
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={onCancel}>Cancel</Button>
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

  // Face step
  if (step === 'face') {
    return (
      <FaceAuth
        mode="verify"
        referenceImage={faceReference}
        onSuccess={handleFaceVerified}
        onCancel={onCancel}
        onFailed={handleFaceFailed}
      />
    );
  }

  // OTP step
  if (step === 'otp') {
    return (
      <OtpVerification
        userEmail={userEmail}
        onVerified={handleOtpVerified}
        onCancel={onCancel}
      />
    );
  }

  // PIN step
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
            <CardDescription className="text-accent">
              ✓ Voice verified. Now enter your PIN.
            </CardDescription>
          )}
          {needsOtp && (
            <p className="text-xs text-muted-foreground mt-1">
              High-value transaction — OTP will be required after PIN
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPinSet ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No PIN set. Please set a transaction PIN in your profile settings.
              </p>
              <Button variant="outline" className="w-full" onClick={onCancel}>Cancel</Button>
            </div>
          ) : (
            <>
              <PinInput onSubmit={handlePinSubmit} error={pinError} loading={verifyingPin} />
              {/* Alternative auth methods */}
              <div className="flex gap-2">
                {faceEnrolled && step !== 'fallback_pin' && (
                  <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => setStep('face')}>
                    <Camera className="w-3 h-3 mr-1" /> Use Face
                  </Button>
                )}
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={onCancel}>Cancel</Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default AuthenticationGuard;
