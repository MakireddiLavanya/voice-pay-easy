/**
 * Smart Transaction Confirmation Component
 * Uses Text-to-Speech to read back the transaction details,
 * then listens for voice confirmation ("Yes Confirm").
 * Falls back to Voice Code on failure.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Volume2, AlertTriangle, Check, X } from 'lucide-react';

interface VoiceConfirmationProps {
  recipientName: string;
  amount: number;
  onConfirmed: () => void;
  onCancel: () => void;
  onFallbackToVoiceCode: () => void;
}

const VoiceConfirmation = ({
  recipientName,
  amount,
  onConfirmed,
  onCancel,
  onFallbackToVoiceCode,
}: VoiceConfirmationProps) => {
  const [phase, setPhase] = useState<'speaking' | 'listening' | 'result'>('speaking');
  const [transcript, setTranscript] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [attempts, setAttempts] = useState(0);

  /**
   * Speak the confirmation question using Text-to-Speech.
   */
  const speakConfirmation = useCallback(() => {
    const utterance = new SpeechSynthesisUtterance(
      `Are you sure you want to transfer ${amount} rupees to ${recipientName}? Say Yes Confirm to proceed.`
    );
    utterance.lang = 'en-IN';
    utterance.rate = 0.9;

    utterance.onend = () => {
      setPhase('listening');
      startListening();
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [amount, recipientName]);

  useEffect(() => {
    speakConfirmation();
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [speakConfirmation]);

  /**
   * Listen for "Yes Confirm" voice response.
   */
  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback for unsupported browsers
      setPhase('result');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      const text = result[0].transcript;
      setTranscript(text);

      if (result.isFinal) {
        const lower = text.toLowerCase().trim();
        // Accept variations: "yes confirm", "yes", "confirm", "haan confirm"
        const isConfirmed =
          lower.includes('yes') ||
          lower.includes('confirm') ||
          lower.includes('haan') ||
          lower.includes('ha');

        if (isConfirmed) {
          setConfirmed(true);
          setPhase('result');
          // Small delay for visual feedback
          setTimeout(() => onConfirmed(), 1000);
        } else {
          setAttempts((prev) => prev + 1);
          if (attempts >= 1) {
            // After 2 failed attempts, fallback to Voice Code
            setPhase('result');
            onFallbackToVoiceCode();
          } else {
            setPhase('listening');
            // Retry
            speakConfirmation();
          }
        }
      }
    };

    recognition.onerror = () => {
      setAttempts((prev) => prev + 1);
      if (attempts >= 1) {
        onFallbackToVoiceCode();
      }
    };

    recognition.start();
  };

  return (
    <Card className="animate-fade-in border-primary/30">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-lg">Voice Confirmation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Transaction summary */}
        <div className="bg-muted rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-foreground">
            ₹{amount.toLocaleString('en-IN')}
          </p>
          <p className="text-muted-foreground mt-1">to {recipientName}</p>
        </div>

        {/* Phase indicator */}
        {phase === 'speaking' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Volume2 className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Reading transaction details...
            </p>
          </div>
        )}

        {phase === 'listening' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Mic className="w-8 h-8 text-accent animate-pulse" />
            </div>
            {/* Voice waveform animation */}
            <div className="flex items-center justify-center gap-1 h-10">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-primary rounded-full animate-voice-wave"
                  style={{ height: '60%', animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <p className="text-sm font-medium text-foreground">
              Say "Yes Confirm" to proceed
            </p>
            {transcript && (
              <p className="text-xs text-muted-foreground italic">
                Heard: "{transcript}"
              </p>
            )}
          </div>
        )}

        {phase === 'result' && confirmed && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-success" />
            </div>
            <p className="text-sm font-medium text-success">Confirmed! Processing...</p>
          </div>
        )}

        {phase === 'result' && !confirmed && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
            <p className="text-sm font-medium text-warning">
              Confirmation failed. Switching to Voice Code...
            </p>
          </div>
        )}

        {/* Cancel button */}
        <Button variant="outline" className="w-full" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancel Transfer
        </Button>
      </CardContent>
    </Card>
  );
};

export default VoiceConfirmation;
