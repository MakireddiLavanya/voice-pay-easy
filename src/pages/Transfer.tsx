/**
 * Transfer Page - Enhanced with Multi-Auth, Smart Confirmation, and Fraud Detection
 * 
 * Flow:
 * 1. Select recipient
 * 2. Enter amount
 * 3. Fraud check (anomaly detection)
 * 4. Authentication (Voice / PIN / Voice+PIN based on user setting)
 * 5. Smart voice confirmation (TTS reads back, user says "Yes Confirm")
 * 6. Process transfer
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Search, Check, Loader2, AlertTriangle } from 'lucide-react';
import AuthenticationGuard from '@/components/AuthenticationGuard';
import VoiceConfirmation from '@/components/VoiceConfirmation';
import VoiceCodeVerify from '@/components/VoiceCodeVerify';
import { useFraudDetection } from '@/hooks/useFraudDetection';

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

interface UserProfile {
  auth_mode: string;
  transaction_pin: string | null;
  voice_passphrase: string | null;
  voice_enrolled: boolean | null;
  voice_tolerance: number;
}

type TransferStep = 'recipient' | 'amount' | 'fraud_check' | 'authenticate' | 'voice_confirm' | 'voice_code_fallback' | 'confirm' | 'processing';

const Transfer = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { checkTransaction, logVoiceMismatch, logAuthAttempt } = useFraudDetection();

  const [amount, setAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<Profile | null>(null);
  const [recipients, setRecipients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [step, setStep] = useState<TransferStep>('recipient');
  const [balance, setBalance] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [fraudAlerts, setFraudAlerts] = useState<string[]>([]);

  // Handle voice command state
  useEffect(() => {
    const state = location.state as { recipient?: string; amount?: number } | null;
    if (state?.recipient) {
      setSearchQuery(state.recipient);
      searchRecipients(state.recipient);
    }
    if (state?.amount) {
      setAmount(state.amount.toString());
    }
  }, [location.state]);

  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchUserProfile();
    }
  }, [user]);

  const fetchBalance = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    if (data) setBalance(data.balance);
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('auth_mode, transaction_pin, voice_passphrase, voice_enrolled, voice_tolerance')
      .eq('user_id', user.id)
      .single();
    if (data) setUserProfile(data);
  };

  const searchRecipients = async (query: string) => {
    if (query.length < 2) { setRecipients([]); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles_public' as any)
        .select('user_id, full_name, email')
        .neq('user_id', user?.id)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      if (error) throw error;
      setRecipients((data as unknown as Profile[]) || []);
    } catch {
      // Silent - empty results shown
    } finally {
      setSearching(false);
    }
  };

  // Step: After entering amount, run fraud check
  const handleProceedToAuth = async () => {
    if (!selectedRecipient || !user) return;
    const transferAmount = parseFloat(amount);

    if (transferAmount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    if (transferAmount > balance) {
      toast({ title: 'Insufficient Balance', description: 'You do not have enough funds', variant: 'destructive' });
      return;
    }

    // Fraud detection check
    setStep('fraud_check');
    const result = await checkTransaction(transferAmount, selectedRecipient.user_id);
    
    if (result.isSuspicious) {
      setFraudAlerts(result.alerts);
      // Still allow but warn - user can proceed or cancel
    }

    // Move to authentication
    setStep('authenticate');
  };

  // After authentication passes, go to voice confirmation
  const handleAuthenticated = () => {
    setStep('voice_confirm');
  };

  // Voice confirmation succeeded
  const handleVoiceConfirmed = () => {
    executeTransfer();
  };

  // Voice confirmation failed, try voice code
  const handleFallbackToVoiceCode = () => {
    setStep('voice_code_fallback');
  };

  // Voice code verified
  const handleVoiceCodeVerified = () => {
    logAuthAttempt('voice_code', true);
    executeTransfer();
  };

  // Voice code failed
  const handleVoiceCodeFailed = () => {
    logAuthAttempt('voice_code', false, 'Max attempts exceeded');
    logVoiceMismatch();
    toast({
      title: 'Authentication Failed',
      description: 'Maximum voice verification attempts exceeded. Transfer cancelled.',
      variant: 'destructive',
    });
    setStep('recipient');
  };

  const executeTransfer = async () => {
    if (!selectedRecipient || !amount || !user) return;
    const transferAmount = parseFloat(amount);

    setStep('processing');
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('transfer_funds', {
        p_sender_id: user.id,
        p_receiver_id: selectedRecipient.user_id,
        p_amount: transferAmount,
        p_description: `Transfer to ${selectedRecipient.full_name}`,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        toast({ title: 'Transfer Failed', description: result.error || 'Something went wrong.', variant: 'destructive' });
        setStep('amount');
        return;
      }

      toast({
        title: '✅ Transfer Successful!',
        description: `₹${transferAmount.toLocaleString('en-IN')} sent to ${selectedRecipient.full_name}`,
      });
      navigate('/dashboard');
    } catch {
      toast({ title: 'Transfer Failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      setStep('amount');
    } finally {
      setLoading(false);
    }
  };

  // Progress step mapping for visual indicator
  const progressSteps = ['recipient', 'amount', 'authenticate', 'confirm'];
  const currentProgressIndex = step === 'recipient' ? 0 
    : step === 'amount' ? 1 
    : (step === 'authenticate' || step === 'fraud_check') ? 2 
    : 3;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Send Money</h1>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center gap-2">
          {progressSteps.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i === currentProgressIndex
                  ? 'bg-primary text-primary-foreground'
                  : i < currentProgressIndex
                  ? 'bg-success text-success-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i < currentProgressIndex ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < 3 && (
                <div className={`flex-1 h-1 mx-2 rounded ${i < currentProgressIndex ? 'bg-success' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Fraud alert banner */}
        {fraudAlerts.length > 0 && step !== 'recipient' && (
          <Card className="mb-4 border-warning/50 bg-warning/5">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Security Warnings</p>
                {fraudAlerts.map((alert, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {alert}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Recipient */}
        {step === 'recipient' && (
          <Card className="animate-fade-in">
            <CardHeader><CardTitle>Select Recipient</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); searchRecipients(e.target.value); }}
                  className="pl-10"
                />
              </div>
              {searching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              )}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recipients.map((recipient) => (
                  <button
                    key={recipient.user_id}
                    onClick={() => { setSelectedRecipient(recipient); setStep('amount'); }}
                    className={`w-full p-4 rounded-xl text-left transition-all hover:bg-secondary ${
                      selectedRecipient?.user_id === recipient.user_id
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-card border border-border'
                    }`}
                  >
                    <p className="font-medium text-foreground">{recipient.full_name}</p>
                    <p className="text-sm text-muted-foreground">{recipient.email}</p>
                  </button>
                ))}
              </div>
              {searchQuery.length >= 2 && recipients.length === 0 && !searching && (
                <p className="text-center text-muted-foreground py-4">No users found</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Amount */}
        {step === 'amount' && selectedRecipient && (
          <Card className="animate-fade-in">
            <CardHeader><CardTitle>Enter Amount</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">Sending to</p>
                <p className="text-lg font-semibold text-foreground">{selectedRecipient.full_name}</p>
              </div>
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-3xl text-center h-16 font-bold"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Available: ₹{balance.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex gap-2">
                {[100, 500, 1000, 2000].map((val) => (
                  <Button key={val} variant="outline" size="sm" className="flex-1" onClick={() => setAmount(val.toString())}>
                    ₹{val}
                  </Button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('recipient')}>Back</Button>
                <Button className="flex-1" onClick={handleProceedToAuth} disabled={!amount || parseFloat(amount) <= 0}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Fraud Check (brief loading) */}
        {step === 'fraud_check' && (
          <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Running security checks...</p>
          </div>
        )}

        {/* Step 4: Authentication Guard */}
        {step === 'authenticate' && userProfile && (
          <div className="animate-fade-in">
            <AuthenticationGuard
              authMode={userProfile.auth_mode as 'voice' | 'pin' | 'voice_pin'}
              storedPin={userProfile.transaction_pin}
              storedPassphrase={userProfile.voice_passphrase}
              voiceTolerance={userProfile.voice_tolerance}
              onAuthenticated={handleAuthenticated}
              onCancel={() => setStep('amount')}
              onLogAttempt={logAuthAttempt}
              onVoiceMismatch={logVoiceMismatch}
            />
          </div>
        )}

        {/* Step 5: Smart Voice Confirmation (TTS + "Yes Confirm") */}
        {step === 'voice_confirm' && selectedRecipient && (
          <div className="animate-fade-in">
            <VoiceConfirmation
              recipientName={selectedRecipient.full_name}
              amount={parseFloat(amount)}
              onConfirmed={handleVoiceConfirmed}
              onCancel={() => setStep('amount')}
              onFallbackToVoiceCode={handleFallbackToVoiceCode}
            />
          </div>
        )}

        {/* Step 5b: Voice Code Fallback */}
        {step === 'voice_code_fallback' && userProfile?.voice_passphrase && (
          <div className="animate-fade-in">
            <VoiceCodeVerify
              storedPassphrase={userProfile.voice_passphrase}
              voiceTolerance={userProfile.voice_tolerance}
              onVerified={handleVoiceCodeVerified}
              onCancel={() => setStep('amount')}
              onFailed={handleVoiceCodeFailed}
            />
          </div>
        )}

        {/* Step 6: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-foreground font-medium">Processing Transfer...</p>
            <p className="text-sm text-muted-foreground">Please wait</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Transfer;
