/**
 * Transfer Page - Enhanced with Mobile Number Search & Redesigned UI
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Search, Check, Loader2, AlertTriangle, User, Phone, Mail, Wallet } from 'lucide-react';
import AuthenticationGuard from '@/components/AuthenticationGuard';
import VoiceConfirmation from '@/components/VoiceConfirmation';
import VoiceCodeVerify from '@/components/VoiceCodeVerify';
import { useFraudDetection } from '@/hooks/useFraudDetection';

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  mobile_number?: string;
}

interface UserProfile {
  auth_mode: string;
  transaction_pin: string | null;
  voice_passphrase: string | null;
  voice_enrolled: boolean | null;
  voice_tolerance: number;
}

type TransferStep = 'recipient' | 'amount' | 'fraud_check' | 'authenticate' | 'voice_confirm' | 'voice_code_fallback' | 'confirm' | 'processing';

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

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

  // Handle voice command: auto-select contact and skip to auth
  useEffect(() => {
    const state = location.state as { recipient?: string; amount?: number } | null;
    if (state?.recipient) {
      setSearchQuery(state.recipient);
      if (state?.amount) setAmount(state.amount.toString());
      // Auto-search and select the best match
      autoSelectRecipient(state.recipient, state.amount);
    }
  }, [location.state]);

  const autoSelectRecipient = async (name: string, amount?: number) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles_public' as any)
        .select('user_id, full_name, email, mobile_number')
        .neq('user_id', user.id)
        .ilike('full_name', `%${name}%`)
        .limit(1);
      if (error) throw error;
      const matches = (data as unknown as Profile[]) || [];
      if (matches.length > 0) {
        setSelectedRecipient(matches[0]);
        if (amount && amount > 0) {
          // Voice command had both recipient + amount → skip to auth
          setStep('amount');
          // Small delay to let state settle, then auto-proceed
          setTimeout(() => {
            setStep('fraud_check');
            handleVoiceAutoAuth(matches[0], amount);
          }, 800);
        } else {
          setStep('amount');
        }
      } else {
        // No match found, stay on search
        searchRecipients(name);
      }
    } catch {
      searchRecipients(name);
    }
  };

  const handleVoiceAutoAuth = async (recipient: Profile, amt: number) => {
    if (!user) return;
    if (amt > balance && balance > 0) {
      toast({ title: 'Insufficient Balance', description: 'You do not have enough funds', variant: 'destructive' });
      setStep('amount');
      return;
    }
    const result = await checkTransaction(amt, recipient.user_id);
    if (result.isSuspicious) setFraudAlerts(result.alerts);
    setStep('authenticate');
  };

  useEffect(() => {
    if (user) { fetchBalance(); fetchUserProfile(); }
  }, [user]);

  const fetchBalance = async () => {
    if (!user) return;
    const { data } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
    if (data) setBalance(data.balance);
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('auth_mode, transaction_pin, voice_passphrase, voice_enrolled, voice_tolerance').eq('user_id', user.id).single();
    if (data) setUserProfile(data);
  };

  const searchRecipients = async (query: string) => {
    if (query.length < 2) { setRecipients([]); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles_public' as any)
        .select('user_id, full_name, email, mobile_number')
        .neq('user_id', user?.id)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,mobile_number.ilike.%${query}%`)
        .limit(10);
      if (error) throw error;
      setRecipients((data as unknown as Profile[]) || []);
    } catch {
      // Silent
    } finally {
      setSearching(false);
    }
  };

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
    setStep('fraud_check');
    const result = await checkTransaction(transferAmount, selectedRecipient.user_id);
    if (result.isSuspicious) setFraudAlerts(result.alerts);
    setStep('authenticate');
  };

  const handleAuthenticated = () => executeTransfer();
  const handleFallbackToVoiceCode = () => setStep('voice_code_fallback');
  const handleVoiceCodeVerified = () => { logAuthAttempt('voice_code', true); executeTransfer(); };
  const handleVoiceCodeFailed = () => {
    logAuthAttempt('voice_code', false, 'Max attempts exceeded');
    logVoiceMismatch();
    toast({ title: 'Authentication Failed', description: 'Maximum voice verification attempts exceeded. Transfer cancelled.', variant: 'destructive' });
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
      toast({ title: '✅ Transfer Successful!', description: `₹${transferAmount.toLocaleString('en-IN')} sent to ${selectedRecipient.full_name}` });
      navigate('/dashboard');
    } catch {
      toast({ title: 'Transfer Failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      setStep('amount');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Recipient', 'Amount', 'Verify', 'Done'];
  const currentIdx = step === 'recipient' ? 0 : step === 'amount' ? 1 : (step === 'authenticate' || step === 'fraud_check') ? 2 : 3;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Send Money</h1>
            <p className="text-xs text-muted-foreground">Fast & secure transfers</p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-2">
        <div className="flex items-center gap-1">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  i === currentIdx ? 'bg-primary text-primary-foreground shadow-md scale-110'
                    : i < currentIdx ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {i < currentIdx ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium ${i <= currentIdx ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              </div>
              {i < 3 && (
                <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${i < currentIdx ? 'bg-accent' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-3 space-y-4">
        {/* Fraud alert */}
        {fraudAlerts.length > 0 && step !== 'recipient' && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Security Alert</p>
              {fraudAlerts.map((alert, i) => (
                <p key={i} className="text-xs text-muted-foreground mt-0.5">• {alert}</p>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Recipient */}
        {step === 'recipient' && (
          <div className="space-y-4 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Name, email, or mobile number"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); searchRecipients(e.target.value); }}
                className="pl-10 h-12 rounded-xl bg-card border-border text-base"
              />
            </div>

            {searching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}

            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {recipients.map((r) => (
                <button
                  key={r.user_id}
                  onClick={() => { setSelectedRecipient(r); setStep('amount'); }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{r.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.mobile_number && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />{r.mobile_number}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <Mail className="w-3 h-3" />{r.email}
                      </span>
                    </div>
                  </div>
                  <Send className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>

            {searchQuery.length >= 2 && recipients.length === 0 && !searching && (
              <div className="text-center py-8">
                <User className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No users found for "{searchQuery}"</p>
              </div>
            )}

            {searchQuery.length < 2 && (
              <div className="text-center py-10">
                <Phone className="w-12 h-12 text-primary/20 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Search by name, email, or mobile</p>
                <p className="text-xs text-muted-foreground mt-1">Enter at least 2 characters to search</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Amount */}
        {step === 'amount' && selectedRecipient && (
          <div className="space-y-5 animate-fade-in">
            {/* Recipient card */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center">
                <User className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">{selectedRecipient.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedRecipient.mobile_number || selectedRecipient.email}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setStep('recipient')}>
                Change
              </Button>
            </div>

            {/* Balance */}
            <div className="flex items-center gap-2 px-1">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Balance:</span>
              <span className="text-sm font-bold text-foreground">₹{balance.toLocaleString('en-IN')}</span>
            </div>

            {/* Amount input */}
            <Card className="border-0 shadow-none bg-transparent">
              <CardContent className="p-0 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Enter Amount</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-10 text-3xl text-center h-16 font-bold rounded-xl bg-card border-border"
                    />
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="flex gap-2 flex-wrap">
                  {QUICK_AMOUNTS.map((val) => (
                    <Button
                      key={val}
                      variant={amount === val.toString() ? 'default' : 'outline'}
                      size="sm"
                      className="rounded-full px-4 text-xs"
                      onClick={() => setAmount(val.toString())}
                    >
                      ₹{val.toLocaleString('en-IN')}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setStep('recipient')}>
                    Back
                  </Button>
                  <Button className="flex-1 h-12 rounded-xl font-semibold" onClick={handleProceedToAuth} disabled={!amount || parseFloat(amount) <= 0}>
                    <Send className="w-4 h-4 mr-2" />
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Fraud check */}
        {step === 'fraud_check' && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Running security checks...</p>
          </div>
        )}

        {/* Authentication */}
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

        {/* Voice confirm step removed - transactions proceed directly after auth */}

        {/* Voice code fallback */}
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

        {/* Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <p className="text-foreground font-semibold">Processing Transfer...</p>
            <p className="text-xs text-muted-foreground mt-1">Please wait while we complete your transaction</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Transfer;
