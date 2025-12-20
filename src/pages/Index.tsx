import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wallet, Mic, ArrowRight, Shield, Zap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-fade-in space-y-8 max-w-md">
          {/* Logo */}
          <div className="mx-auto w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-glow">
            <Wallet className="w-10 h-10 text-primary-foreground" />
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-foreground">
              Voice Wallet
            </h1>
            <p className="text-lg text-muted-foreground">
              Voice-Enabled UPI Payment System
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 py-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <Mic className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Voice Control</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Secure</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Fast</span>
            </div>
          </div>

          {/* CTA */}
          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={() => navigate('/auth')}
          >
            Get Started
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-sm text-muted-foreground">
            Transfer money using just your voice
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-xs text-muted-foreground">
          © 2024 Voice Wallet. Secure voice-powered payments.
        </p>
      </footer>
    </div>
  );
};

export default Index;
