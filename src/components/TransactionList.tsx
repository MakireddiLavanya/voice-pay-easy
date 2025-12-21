import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  sender_name?: string;
  receiver_name?: string;
}

interface TransactionListProps {
  limit?: number;
}

const TransactionList = ({ limit }: TransactionListProps) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profile names for transactions
      if (data && data.length > 0) {
        const userIds = [...new Set(data.flatMap((t) => [t.sender_id, t.receiver_id]))];
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

        const enrichedTransactions = data.map((t) => ({
          ...t,
          sender_name: profileMap.get(t.sender_id) || 'Unknown',
          receiver_name: profileMap.get(t.receiver_id) || 'Unknown',
        }));

        setTransactions(enrichedTransactions);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      // Error handled silently - empty transaction list shown to user
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="h-5 bg-muted rounded w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No transactions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use voice commands to send money
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => {
        const isSender = transaction.sender_id === user?.id;
        const otherParty = isSender
          ? transaction.receiver_name
          : transaction.sender_name;

        return (
          <Card key={transaction.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isSender
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-success/10 text-success'
                  }`}
                >
                  {isSender ? (
                    <ArrowUpRight className="w-5 h-5" />
                  ) : (
                    <ArrowDownLeft className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {isSender ? `To ${otherParty}` : `From ${otherParty}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(transaction.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      isSender ? 'text-destructive' : 'text-success'
                    }`}
                  >
                    {isSender ? '-' : '+'}₹{transaction.amount.toLocaleString('en-IN')}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      transaction.status === 'completed'
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {transaction.status}
                  </span>
                </div>
              </div>
              {transaction.description && (
                <p className="mt-2 text-sm text-muted-foreground pl-13">
                  {transaction.description}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default TransactionList;
