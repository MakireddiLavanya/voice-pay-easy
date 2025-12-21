import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceButtonProps {
  onCommand?: (command: { recipient: string; amount: number }) => void;
}

const VoiceButton = ({ onCommand }: VoiceButtonProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const text = result[0].transcript;
      setTranscript(text);

      if (result.isFinal) {
        processCommand(text);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      toast({
        title: 'Voice Error',
        description: 'Could not recognize speech. Please try again.',
        variant: 'destructive',
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []);

  const processCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    
    // Patterns to match: "transfer 500 to avinash", "send 1000 rupees to ravi"
    const patterns = [
      /(?:transfer|send|pay)\s+(\d+)\s*(?:rupees?)?\s*(?:to)\s+(\w+)/i,
      /(?:transfer|send|pay)\s+(?:rupees?)\s*(\d+)\s*(?:to)\s+(\w+)/i,
      /(\d+)\s*(?:rupees?)?\s*(?:to)\s+(\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const amount = parseInt(match[1], 10);
        const recipient = match[2].charAt(0).toUpperCase() + match[2].slice(1);
        
        if (amount > 0 && recipient) {
          toast({
            title: 'Command Recognized',
            description: `Transfer ₹${amount} to ${recipient}`,
          });
          
          if (onCommand) {
            onCommand({ recipient, amount });
          }
          return;
        }
      }
    }

    toast({
      title: 'Command Not Recognized',
      description: 'Try saying "Transfer 500 rupees to John"',
      variant: 'destructive',
    });
  };

  const toggleListening = () => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Voice recognition is not supported in this browser',
        variant: 'destructive',
      });
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setTranscript('');
    } else {
      setTranscript('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  return (
    <>
      {/* Overlay when listening */}
      {isListening && (
        <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40 animate-fade-in">
          <div className="absolute inset-x-4 bottom-32 max-w-lg mx-auto">
            <div className="bg-card rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Listening...
                </h3>
                <button
                  onClick={toggleListening}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              {/* Voice Waveform Animation */}
              <div className="flex items-center justify-center gap-1 h-16 mb-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 bg-primary rounded-full animate-voice-wave"
                    style={{
                      height: '40%',
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>

              <div className="min-h-[60px] p-4 bg-muted rounded-xl">
                <p className="text-foreground text-center">
                  {transcript || 'Say something like "Transfer 500 to John"'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={toggleListening}
          className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening
              ? 'bg-accent shadow-success scale-110'
              : 'bg-primary shadow-glow hover:scale-105'
          }`}
          disabled={!isSupported}
        >
          {/* Pulse rings */}
          {isListening && (
            <>
              <span className="absolute inset-0 rounded-full bg-accent animate-pulse-ring" />
              <span
                className="absolute inset-0 rounded-full bg-accent animate-pulse-ring"
                style={{ animationDelay: '0.5s' }}
              />
            </>
          )}
          
          {isListening ? (
            <MicOff className="w-8 h-8 text-accent-foreground relative z-10" />
          ) : (
            <Mic className="w-8 h-8 text-primary-foreground relative z-10" />
          )}
        </button>
        
        <p className="text-center text-xs text-muted-foreground mt-2">
          {isListening ? 'Tap to stop' : 'Tap to speak'}
        </p>
      </div>
    </>
  );
};

export default VoiceButton;
