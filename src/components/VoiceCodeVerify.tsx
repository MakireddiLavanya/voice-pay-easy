/**
 * Voice Code Verification Component
 * Fallback authentication: user speaks their pre-set secret phrase.
 * Uses Levenshtein similarity matching.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, ShieldAlert, X } from 'lucide-react';

interface VoiceCodeVerifyProps {
  storedPassphrase: string;
  voiceTolerance: number;
  onVerified: () => void;
  onCancel: () => void;
  onFailed: () => void;
}

const VoiceCodeVerify = ({
  storedPassphrase,
  voiceTolerance,
  onVerified,
  onCancel,
  onFailed,
}: VoiceCodeVerifyProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');

  // Levenshtein similarity calculation
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

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Voice recognition not supported in this browser');
      return;
    }

    setIsListening(true);
    setTranscript('');
    setError('');

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      setTranscript(result[0].transcript);

      if (result.isFinal) {
        const spoken = result[0].transcript.toLowerCase().trim();
        const stored = storedPassphrase.toLowerCase().trim();
        const similarity = calculateSimilarity(spoken, stored);

        if (similarity >= voiceTolerance) {
          onVerified();
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          if (newAttempts >= 3) {
            onFailed();
          } else {
            setError(`Voice code mismatch (${Math.round(similarity * 100)}% match). ${3 - newAttempts} attempts remaining.`);
          }
        }
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setError('Could not recognize speech. Try again.');
    };

    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  return (
    <Card className="animate-fade-in border-warning/30">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mb-2">
          <ShieldAlert className="w-7 h-7 text-warning" />
        </div>
        <CardTitle className="text-lg">Voice Code Verification</CardTitle>
        <CardDescription>
          Speak your secret voice passphrase to authenticate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mic button */}
        <div className="flex justify-center">
          <button
            onClick={startListening}
            disabled={isListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-accent animate-pulse shadow-success'
                : 'bg-primary shadow-glow hover:scale-105'
            }`}
          >
            <Mic className="w-8 h-8 text-primary-foreground" />
          </button>
        </div>

        {/* Waveform */}
        {isListening && (
          <div className="flex items-center justify-center gap-1 h-10">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-primary rounded-full animate-voice-wave"
                style={{ height: '60%', animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isListening ? 'Listening...' : 'Tap microphone to speak your voice code'}
        </p>

        {transcript && (
          <div className="bg-muted rounded-xl p-3 text-center">
            <p className="text-sm text-foreground">Heard: "{transcript}"</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button variant="outline" className="w-full" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" /> Cancel
        </Button>
      </CardContent>
    </Card>
  );
};

export default VoiceCodeVerify;
