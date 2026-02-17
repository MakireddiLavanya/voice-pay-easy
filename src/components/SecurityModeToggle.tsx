/**
 * Security Mode Toggle Component
 * Allows users to switch between Voice, PIN, and Voice+PIN auth modes.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Lock, ShieldCheck } from 'lucide-react';

type AuthMode = 'voice' | 'pin' | 'voice_pin';

interface SecurityModeToggleProps {
  currentMode: AuthMode;
  onChange: (mode: AuthMode) => void;
  voiceEnrolled: boolean;
}

const modes: { id: AuthMode; label: string; description: string; icon: typeof Mic }[] = [
  {
    id: 'voice',
    label: 'Voice Only',
    description: 'Authenticate with your voice passphrase',
    icon: Mic,
  },
  {
    id: 'pin',
    label: 'PIN Only',
    description: 'Authenticate with 4-digit transaction PIN',
    icon: Lock,
  },
  {
    id: 'voice_pin',
    label: 'Voice + PIN',
    description: 'High security: both voice and PIN required',
    icon: ShieldCheck,
  },
];

const SecurityModeToggle = ({ currentMode, onChange, voiceEnrolled }: SecurityModeToggleProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Authentication Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isDisabled = (mode.id === 'voice' || mode.id === 'voice_pin') && !voiceEnrolled;

          return (
            <button
              key={mode.id}
              onClick={() => !isDisabled && onChange(mode.id)}
              disabled={isDisabled}
              className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                currentMode === mode.id
                  ? 'bg-primary/10 border-2 border-primary'
                  : 'bg-muted border-2 border-transparent hover:border-border'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentMode === mode.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{mode.label}</p>
                <p className="text-xs text-muted-foreground">{mode.description}</p>
                {isDisabled && (
                  <p className="text-xs text-warning mt-0.5">Enroll voice first</p>
                )}
              </div>
              {currentMode === mode.id && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SecurityModeToggle;
