import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mic, Check, RefreshCw } from 'lucide-react';

const PASSPHRASE = "My voice is my password";

const VoiceSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'intro' | 'record' | 'confirm' | 'complete'>('intro');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPhrase, setRecordedPhrase] = useState('');
  const [loading, setLoading] = useState(false);

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({
        title: 'Not Supported',
        description: 'Voice recognition is not supported in this browser',
        variant: 'destructive',
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
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

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  // Calculate string similarity using Levenshtein distance
  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

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
    const normalizedPassphrase = PASSPHRASE.toLowerCase().trim();
    
    // Require 85% similarity to the exact passphrase
    const similarity = calculateSimilarity(normalizedRecorded, normalizedPassphrase);
    
    if (similarity < 0.85) {
      toast({
        title: 'Phrase Mismatch',
        description: `The recorded phrase doesn't match closely enough. Please say "${PASSPHRASE}" clearly.`,
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
          voice_passphrase: recordedPhrase,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      setStep('complete');
      toast({
        title: 'Voice Enrolled!',
        description: 'Your voice has been set up for authentication.',
      });
    } catch (error) {
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
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Voice Setup</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {step === 'intro' && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mic className="w-10 h-10 text-primary" />
              </div>
              <CardTitle>Set Up Voice Authentication</CardTitle>
              <CardDescription>
                Record your voice passphrase to enable secure voice-based transfers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted rounded-xl p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  You will need to say:
                </p>
                <p className="text-lg font-medium text-foreground text-center">
                  "{PASSPHRASE}"
                </p>
              </div>

              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5" />
                  <span>Speak clearly in a quiet environment</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5" />
                  <span>Hold the device close to your mouth</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-success mt-0.5" />
                  <span>Your voice will be used to verify transactions</span>
                </li>
              </ul>

              <Button className="w-full" onClick={() => setStep('record')}>
                Start Voice Setup
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'record' && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle>Record Your Voice</CardTitle>
              <CardDescription>
                Tap the microphone and say the passphrase clearly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-secondary rounded-xl p-6 text-center">
                <p className="text-lg font-medium text-foreground">
                  "{PASSPHRASE}"
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={startRecording}
                  disabled={isRecording}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-accent animate-pulse shadow-success'
                      : 'bg-primary shadow-glow hover:scale-105'
                  }`}
                >
                  <Mic className="w-10 h-10 text-primary-foreground" />
                </button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                {isRecording ? 'Listening...' : 'Tap to record'}
              </p>
            </CardContent>
          </Card>
        )}

        {step === 'confirm' && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle>Confirm Recording</CardTitle>
              <CardDescription>
                We captured the following phrase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted rounded-xl p-6 text-center">
                <p className="text-lg font-medium text-foreground">
                  "{recordedPhrase}"
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('record')}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-record
                </Button>
                <Button
                  className="flex-1"
                  onClick={verifyAndSave}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Confirm & Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'complete' && (
          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-success" />
              </div>
              <CardTitle>Voice Setup Complete!</CardTitle>
              <CardDescription>
                Your voice is now enrolled for secure authentication
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
