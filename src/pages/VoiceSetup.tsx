/**
 * Voice Setup Page
 * Users set a custom voice passphrase, record it, and enroll for voice authentication.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mic, Check, RefreshCw, Pencil } from 'lucide-react';
import { Label } from '@/components/ui/label';

const SUGGESTED_PHRASES = [
  'My voice is my password',
  'Open sesame securely',
  'Transfer with my voice',
];

const VoiceSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<'choose' | 'record' | 'confirm' | 'complete'>('choose');
  const [passphrase, setPassphrase] = useState('');
  const [customPhrase, setCustomPhrase] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPhrase, setRecordedPhrase] = useState('');
  const [loading, setLoading] = useState(false);

  const selectPhrase = (phrase: string) => {
    setPassphrase(phrase);
  };

  const handleProceedToRecord = () => {
    const finalPhrase = passphrase || customPhrase.trim();
    if (!finalPhrase || finalPhrase.length < 4) {
      toast({
        title: 'Passphrase Too Short',
        description: 'Please enter at least 4 characters for your voice password.',
        variant: 'destructive',
      });
      return;
    }
    setPassphrase(finalPhrase);
    setStep('record');
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({
        title: 'Not Supported',
        description: 'Voice recognition is not supported in this browser.',
        variant: 'destructive',
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setRecordedPhrase(result);
      setStep('confirm');
    };

    recognition.onerror = () => {
      setIsRecording(false);
      toast({
        title: 'Recording Error',
        description: 'Could not record voice. Please try again.',
        variant: 'destructive',
      });
    };

    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - matrix[len1][len2] / maxLen;
  };

  const verifyAndSave = async () => {
    const normalizedRecorded = recordedPhrase.toLowerCase().trim();
    const normalizedPassphrase = passphrase.toLowerCase().trim();

    const similarity = calculateSimilarity(normalizedRecorded, normalizedPassphrase);

    if (similarity < 0.75) {
      toast({
        title: 'Phrase Mismatch',
        description: `What you said doesn't match your passphrase. Please try again.`,
        variant: 'destructive',
      });
      setStep('record');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          voice_enrolled: true,
          voice_passphrase: passphrase,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      setStep('complete');
      toast({
        title: 'Voice Enrolled!',
        description: 'Your voice password has been saved successfully.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save voice data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Voice Setup</h1>
            <p className="text-xs text-muted-foreground">Set your voice password</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Step 1: Choose / type passphrase */}
        {step === 'choose' && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Choose Your Voice Password</CardTitle>
              <CardDescription>
                Pick a suggested phrase or create your own. You'll speak this phrase to authenticate transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Suggestions */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Suggested phrases</Label>
                <div className="space-y-2">
                  {SUGGESTED_PHRASES.map((phrase) => (
                    <button
                      key={phrase}
                      onClick={() => { setPassphrase(phrase); setCustomPhrase(''); }}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                        passphrase === phrase
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      "{phrase}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom input */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Or type your own
                </Label>
                <Input
                  placeholder="e.g. Unlock my wallet now"
                  value={customPhrase}
                  onChange={(e) => {
                    setCustomPhrase(e.target.value);
                    setPassphrase(''); // deselect suggestion
                  }}
                  className="text-sm"
                />
              </div>

              <Button className="w-full" onClick={handleProceedToRecord}>
                Continue to Record
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Record */}
        {step === 'record' && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle>Record Your Voice</CardTitle>
              <CardDescription>Tap the mic and say your passphrase clearly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-center">
                <p className="text-xs text-muted-foreground mb-1">Say this:</p>
                <p className="text-lg font-semibold text-foreground">"{passphrase}"</p>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={startRecording}
                  disabled={isRecording}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-accent animate-pulse shadow-lg'
                      : 'bg-primary shadow-glow hover:scale-105'
                  }`}
                >
                  <Mic className="w-10 h-10 text-primary-foreground" />
                </button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                {isRecording ? 'Listening...' : 'Tap to record'}
              </p>

              <Button variant="outline" className="w-full" onClick={() => setStep('choose')}>
                ← Change Passphrase
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle>Confirm Recording</CardTitle>
              <CardDescription>We captured the following</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="bg-muted rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Your passphrase</p>
                  <p className="font-semibold text-foreground">"{passphrase}"</p>
                </div>
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">What we heard</p>
                  <p className="font-semibold text-foreground">"{recordedPhrase}"</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('record')}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Re-record
                </Button>
                <Button className="flex-1" onClick={verifyAndSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Confirm & Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Done */}
        {step === 'complete' && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-3">
                <Check className="w-8 h-8 text-success" />
              </div>
              <CardTitle>Voice Setup Complete!</CardTitle>
              <CardDescription>
                Your voice password "{passphrase}" is now enrolled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default VoiceSetup;
