/**
 * Profile Page - Enhanced with Security Mode Toggle, PIN Setup, Noise Cancellation, and Voice Tolerance
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Mail, Phone, CreditCard, Shield, Mic, Lock } from 'lucide-react';
import SecurityModeToggle from '@/components/SecurityModeToggle';
import NoiseCancellationPanel from '@/components/NoiseCancellationPanel';
import PinInput from '@/components/PinInput';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useNoiseFilter } from '@/hooks/useNoiseFilter';

interface ProfileData {
  full_name: string;
  email: string;
  mobile_number: string;
  voice_enrolled: boolean;
  auth_mode: string;
  transaction_pin: string | null;
  voice_tolerance: number;
}

interface WalletData {
  bank_account_no: string;
  ifsc_code: string;
  balance: number;
}

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [voiceTolerance, setVoiceTolerance] = useState(85);
  const { sensitivity, setSensitivity, isFilterActive, setIsFilterActive } = useNoiseFilter();

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, mobile_number, voice_enrolled, auth_mode, transaction_pin, voice_tolerance')
        .eq('user_id', user?.id)
        .single();

      const { data: walletData } = await supabase
        .from('wallets')
        .select('bank_account_no, ifsc_code, balance')
        .eq('user_id', user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setVoiceTolerance(Math.round((profileData.voice_tolerance || 0.85) * 100));
      }
      setWallet(walletData);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const handleAuthModeChange = async (mode: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ auth_mode: mode })
      .eq('user_id', user?.id);

    if (!error) {
      setProfile((prev) => prev ? { ...prev, auth_mode: mode } : null);
      toast({ title: 'Security Mode Updated', description: `Switched to ${mode === 'voice_pin' ? 'Voice + PIN' : mode === 'voice' ? 'Voice Only' : 'PIN Only'}` });
    }
  };

  const handlePinSet = async (pin: string) => {
    try {
      const { data, error } = await supabase.rpc('set_transaction_pin', { p_pin: pin });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast({ title: 'Error', description: result.error || 'Failed to set PIN', variant: 'destructive' });
        return;
      }
      setProfile((prev) => prev ? { ...prev, transaction_pin: 'set' } : null);
      setShowPinSetup(false);
      toast({ title: 'PIN Set Successfully', description: 'Your transaction PIN has been saved securely.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to set PIN. Please try again.', variant: 'destructive' });
    }
  };

  const handleToleranceChange = async (value: number) => {
    setVoiceTolerance(value);
    await supabase
      .from('profiles')
      .update({ voice_tolerance: value / 100 })
      .eq('user_id', user?.id);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">My Profile</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium text-foreground">{profile?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Mobile Number</p>
                <p className="font-medium text-foreground">{profile?.mobile_number || 'Not set'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Wallet Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Account Number</p>
                <p className="font-medium text-foreground font-mono">••••{wallet?.bank_account_no?.slice(-4)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">IFSC Code</p>
                <p className="font-medium text-foreground font-mono">••••{wallet?.ifsc_code?.slice(-4)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold text-primary">₹{wallet?.balance?.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Mode Toggle */}
        <SecurityModeToggle
          currentMode={(profile?.auth_mode || 'pin') as 'voice' | 'pin' | 'voice_pin'}
          onChange={handleAuthModeChange}
          voiceEnrolled={profile?.voice_enrolled || false}
        />

        {/* Transaction PIN Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="w-5 h-5 text-primary" /> Transaction PIN
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showPinSetup ? (
              <div className="space-y-4">
                <PinInput onSubmit={handlePinSet} title="Set New Transaction PIN" />
                <Button variant="outline" className="w-full" onClick={() => setShowPinSetup(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {profile?.transaction_pin ? 'PIN is set ✓' : 'No PIN set'}
                </p>
                <Button size="sm" variant="outline" onClick={() => setShowPinSetup(true)}>
                  {profile?.transaction_pin ? 'Change PIN' : 'Set PIN'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="w-5 h-5 text-primary" /> Voice Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Mic className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Voice Enrollment</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.voice_enrolled ? 'Enrolled ✓' : 'Not enrolled'}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate('/voice-setup')}>
                {profile?.voice_enrolled ? 'Re-enroll' : 'Setup'}
              </Button>
            </div>

            {/* Dynamic Voice Tolerance Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Voice Match Tolerance</Label>
                <span className="text-xs text-muted-foreground">{voiceTolerance}%</span>
              </div>
              <Slider
                value={[voiceTolerance]}
                onValueChange={([val]) => handleToleranceChange(val)}
                min={50}
                max={100}
                step={5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Lenient (sick/cold)</span>
                <span>Strict</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lower tolerance helps when your voice changes due to cold/fever
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Noise Cancellation */}
        <NoiseCancellationPanel
          sensitivity={sensitivity}
          onSensitivityChange={setSensitivity}
          isFilterActive={isFilterActive}
          onFilterToggle={setIsFilterActive}
        />

        {/* Security Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5 text-primary" /> Security Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• All transactions are encrypted and logged</p>
            <p>• Voice data is stored securely with similarity matching</p>
            <p>• Fraud detection monitors for anomalous activity</p>
            <p>• JWT-based session authentication via Lovable Cloud</p>
            <p>• HTTPS/TLS encryption for all communications</p>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={handleSignOut}>
          Sign Out
        </Button>
      </main>
    </div>
  );
};

export default Profile;
