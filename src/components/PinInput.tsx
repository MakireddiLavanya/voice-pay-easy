/**
 * PIN Input Component
 * Secure 4-digit PIN entry with masked display.
 */
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface PinInputProps {
  onSubmit: (pin: string) => void;
  loading?: boolean;
  title?: string;
  error?: string;
}

const PinInput = ({ onSubmit, loading, title = 'Enter Transaction PIN', error }: PinInputProps) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newPin = [...pin];
    newPin[index] = value.slice(-1); // Take last digit
    setPin(newPin);

    // Auto-advance to next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (newPin.every((d) => d !== '') && value) {
      onSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Backspace: go to previous input
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="space-y-6 text-center">
      <div className="flex items-center justify-center gap-2 text-foreground">
        <Lock className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="flex justify-center gap-3">
        {pin.map((digit, i) => (
          <Input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-14 h-14 text-center text-2xl font-bold"
            disabled={loading}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        onClick={() => onSubmit(pin.join(''))}
        disabled={loading || pin.some((d) => d === '')}
        className="w-full"
      >
        {loading ? 'Verifying...' : 'Verify PIN'}
      </Button>
    </div>
  );
};

export default PinInput;
