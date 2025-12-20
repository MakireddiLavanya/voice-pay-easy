import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Search, Check, Loader2, Mic } from 'lucide-react';

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

const Transfer = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [amount, setAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<Profile | null>(null);
  const [recipients, setRecipients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [step, setStep] = useState<'recipient' | 'amount' | 'confirm'>('recipient');
  const [balance, setBalance] = useState(0);

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
    fetchBalance();
  }, [user]);

  const fetchBalance = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setBalance(data.balance);
    }
  };

  const searchRecipients = async (query: string) => {
    if (query.length < 2) {
      setRecipients([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .neq('user_id', user?.id)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setRecipients(data || []);
    } catch (error) {
      console.error('Error searching recipients:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedRecipient || !amount || !user) return;

    const transferAmount = parseFloat(amount);
    
    if (transferAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    if (transferAmount > balance) {
      toast({
        title: 'Insufficient Balance',
        description: 'You do not have enough funds',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Create transaction
      const { error: txError } = await supabase.from('transactions').insert({
        sender_id: user.id,
        receiver_id: selectedRecipient.user_id,
        amount: transferAmount,
        description: `Transfer to ${selectedRecipient.full_name}`,
        status: 'completed',
      });

      if (txError) throw txError;

      // Update sender wallet
      const { error: senderError } = await supabase
        .from('wallets')
        .update({ balance: balance - transferAmount })
        .eq('user_id', user.id);

      if (senderError) throw senderError;

      // Update receiver wallet
      const { data: receiverWallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', selectedRecipient.user_id)
        .single();

      if (receiverWallet) {
        await supabase
          .from('wallets')
          .update({ balance: receiverWallet.balance + transferAmount })
          .eq('user_id', selectedRecipient.user_id);
      }

      toast({
        title: 'Transfer Successful!',
        description: `₹${transferAmount.toLocaleString('en-IN')} sent to ${selectedRecipient.full_name}`,
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Transfer error:', error);
      toast({
        title: 'Transfer Failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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
          {['recipient', 'amount', 'confirm'].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : i < ['recipient', 'amount', 'confirm'].indexOf(step)
                    ? 'bg-success text-success-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < ['recipient', 'amount', 'confirm'].indexOf(step) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    i < ['recipient', 'amount', 'confirm'].indexOf(step)
                      ? 'bg-success'
                      : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {step === 'recipient' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Select Recipient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchRecipients(e.target.value);
                  }}
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
                    onClick={() => {
                      setSelectedRecipient(recipient);
                      setStep('amount');
                    }}
                    className={`w-full p-4 rounded-xl text-left transition-all hover:bg-secondary ${
                      selectedRecipient?.user_id === recipient.user_id
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-card border border-border'
                    }`}
                  >
                    <p className="font-medium text-foreground">
                      {recipient.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {recipient.email}
                    </p>
                  </button>
                ))}
              </div>

              {searchQuery.length >= 2 && recipients.length === 0 && !searching && (
                <p className="text-center text-muted-foreground py-4">
                  No users found
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'amount' && selectedRecipient && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Enter Amount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">Sending to</p>
                <p className="text-lg font-semibold text-foreground">
                  {selectedRecipient.full_name}
                </p>
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
                  <Button
                    key={val}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setAmount(val.toString())}
                  >
                    ₹{val}
                  </Button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('recipient')}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setStep('confirm')}
                  disabled={!amount || parseFloat(amount) <= 0}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'confirm' && selectedRecipient && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Confirm Transfer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-foreground mb-2">
                  ₹{parseFloat(amount).toLocaleString('en-IN')}
                </p>
                <p className="text-muted-foreground">
                  to {selectedRecipient.full_name}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="text-foreground font-medium">
                    {selectedRecipient.full_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-foreground">{selectedRecipient.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-foreground font-medium">
                    ₹{parseFloat(amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('amount')}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleTransfer}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Confirm & Send
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Transfer;
