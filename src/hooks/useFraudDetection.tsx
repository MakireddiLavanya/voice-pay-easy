/**
 * Fraud Detection Hook
 * Detects anomalies: unusual amounts, rapid transactions, unknown voice attempts.
 * Logs suspicious activity to the fraud_alerts table.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FraudCheckResult {
  isSuspicious: boolean;
  alerts: string[];
}

export const useFraudDetection = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Check for anomalies before processing a transaction.
   * Rules:
   * 1. Unusual amount (>5000 for demo)
   * 2. Rapid repeated transactions (>3 in last 5 min)
   * 3. Same recipient repeated transfers
   */
  const checkTransaction = useCallback(
    async (amount: number, receiverId: string): Promise<FraudCheckResult> => {
      if (!user) return { isSuspicious: false, alerts: [] };

      const alerts: string[] = [];

      // Rule 1: High amount threshold (demo: ₹5000)
      if (amount > 5000) {
        alerts.push('High value transaction detected');
      }

      // Rule 2: Rapid transactions - check last 5 minutes
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentTxns } = await supabase
        .from('transactions')
        .select('id')
        .eq('sender_id', user.id)
        .gte('created_at', fiveMinAgo);

      if (recentTxns && recentTxns.length >= 3) {
        alerts.push('Rapid repeated transactions detected');
      }

      // Rule 3: Multiple transfers to same person in short time
      const { data: samePerson } = await supabase
        .from('transactions')
        .select('id')
        .eq('sender_id', user.id)
        .eq('receiver_id', receiverId)
        .gte('created_at', fiveMinAgo);

      if (samePerson && samePerson.length >= 2) {
        alerts.push('Multiple transfers to same recipient in short time');
      }

      const isSuspicious = alerts.length > 0;

      // Log fraud alerts to database
      if (isSuspicious) {
        for (const alertMsg of alerts) {
          await supabase.from('fraud_alerts').insert({
            user_id: user.id,
            alert_type: 'transaction_anomaly',
            description: alertMsg,
            severity: amount > 5000 ? 'high' : 'medium',
          });
        }

        // Show real-time alert popup
        toast({
          title: '⚠️ Security Alert',
          description: alerts.join('. '),
          variant: 'destructive',
        });
      }

      return { isSuspicious, alerts };
    },
    [user, toast]
  );

  /**
   * Log a failed voice authentication attempt as potential fraud.
   */
  const logVoiceMismatch = useCallback(async () => {
    if (!user) return;

    await supabase.from('fraud_alerts').insert({
      user_id: user.id,
      alert_type: 'unknown_voice',
      description: 'Voice authentication mismatch detected - possible unauthorized access attempt',
      severity: 'high',
    });

    toast({
      title: '🔒 Security Alert',
      description: 'Unknown voice detected. This attempt has been logged.',
      variant: 'destructive',
    });
  }, [user, toast]);

  /**
   * Log authentication attempt (success or failure).
   */
  const logAuthAttempt = useCallback(
    async (method: string, success: boolean, details?: string) => {
      if (!user) return;

      await supabase.from('authentication_logs').insert({
        user_id: user.id,
        auth_method: method,
        success,
        details: details || null,
      });
    },
    [user]
  );

  return { checkTransaction, logVoiceMismatch, logAuthAttempt };
};
