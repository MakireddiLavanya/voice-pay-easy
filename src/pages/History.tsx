import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import TransactionList from '@/components/TransactionList';
import { ArrowLeft } from 'lucide-react';

const History = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Transaction History</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <TransactionList />
      </main>
    </div>
  );
};

export default History;
