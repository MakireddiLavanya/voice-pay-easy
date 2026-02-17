/**
 * Fraud Alert Banner Component
 * Shows unresolved fraud alerts on the dashboard.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

interface FraudAlert {
  id: string;
  alert_type: string;
  description: string;
  severity: string;
  created_at: string;
}

const FraudAlertBanner = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from('fraud_alerts')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) setAlerts(data);
  };

  const dismissAlert = async (id: string) => {
    await supabase
      .from('fraud_alerts')
      .update({ is_resolved: true })
      .eq('id', id);

    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Card
          key={alert.id}
          className={`border-l-4 ${
            alert.severity === 'high'
              ? 'border-l-destructive bg-destructive/5'
              : 'border-l-warning bg-warning/5'
          }`}
        >
          <CardContent className="p-3 flex items-start gap-3">
            <AlertTriangle
              className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                alert.severity === 'high' ? 'text-destructive' : 'text-warning'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {alert.alert_type === 'unknown_voice' ? '🔒 Unknown Voice' : '⚠️ Transaction Alert'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {alert.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 h-8 w-8"
              onClick={() => dismissAlert(alert.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FraudAlertBanner;
