/**
 * Dashboard Page - Enhanced with Fraud Alert Banner and Security Status
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import VoiceButton from '@/components/VoiceButton';
import TransactionList from '@/components/TransactionList';
import FraudAlertBanner from '@/components/FraudAlertBanner';
import {
  Wallet, History, Send, LogOut, User, CreditCard, Mic, Shield,
} from 'lucide-react';

interface WalletData {
  id: string;
  balance: number;
  bank_account_no: string;
  ifsc_code: string;
}

interface ProfileData {
  full_name: string;
  email: string;
  voice_enrolled: boolean;
  auth_mode: string;
}

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (walletError) throw walletError;
      setWallet(walletData);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email, voice_enrolled, auth_mode')
        .eq('user_id', user?.id)
        .single();
      if (profileError) throw profileError;
      setProfile(profileData);
    } catch {
      toast({ title: 'Error', description: 'Failed to load wallet data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleVoiceCommand = (command: { recipient: string; amount: number }) => {
    navigate('/transfer', { state: command });
  };

  // Auth mode display label
  const authModeLabel = profile?.auth_mode === 'voice_pin' ? 'Voice + PIN' 
    : profile?.auth_mode === 'voice' ? 'Voice Only' : 'PIN Only';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Voice Wallet</h1>
              <p className="text-xs text-muted-foreground">
                Hello, {profile?.full_name?.split(' ')[0] || 'User'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Fraud Alert Banner */}
        <FraudAlertBanner />

        {/* Balance Card */}
        <Card className="balance-card overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-2">
              <CreditCard className="w-4 h-4" />
              <span className="text-sm">Total Balance</span>
            </div>
            <p className="text-4xl font-bold text-primary-foreground mb-4">
              ₹{wallet?.balance?.toLocaleString('en-IN') || '0'}
            </p>
            <div className="flex items-center justify-between text-sm text-primary-foreground/70">
              <div className="flex items-center gap-4">
                <span>A/C: ••••{wallet?.bank_account_no?.slice(-4) || 'N/A'}</span>
                <span>•</span>
                <span>IFSC: {wallet?.ifsc_code || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Status Bar */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Security Mode</p>
              <p className="text-sm font-medium text-foreground">{authModeLabel}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/profile')}>
              Change
            </Button>
          </CardContent>
        </Card>

        {/* Voice Enrollment Status */}
        {!profile?.voice_enrolled && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                <Mic className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Voice Not Enrolled</p>
                <p className="text-xs text-muted-foreground">Set up voice authentication for secure transfers</p>
              </div>
              <Button size="sm" onClick={() => navigate('/voice-setup')}>Setup</Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="h-20 flex-col gap-2 bg-card hover:bg-secondary" onClick={() => navigate('/transfer')}>
            <Send className="w-5 h-5 text-primary" />
            <span className="text-xs">Send</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2 bg-card hover:bg-secondary" onClick={() => navigate('/history')}>
            <History className="w-5 h-5 text-primary" />
            <span className="text-xs">History</span>
          </Button>
          <Button variant="outline" className="h-20 flex-col gap-2 bg-card hover:bg-secondary" onClick={() => navigate('/profile')}>
            <User className="w-5 h-5 text-primary" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>View All</Button>
          </div>
          <TransactionList limit={5} />
        </div>
      </main>

      {/* Voice Button */}
      <VoiceButton onCommand={handleVoiceCommand} />
    </div>
  );
};

export default Dashboard;
