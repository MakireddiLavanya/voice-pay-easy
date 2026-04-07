/**
 * Security Dashboard Page
 * Shows login attempts, transaction history, security layer toggles, and fraud alerts.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Shield, History, AlertTriangle, Lock, Mic, Camera,
  Mail, CheckCircle, XCircle, Clock, ShieldAlert,
} from 'lucide-react';

interface AuthLog {
  id: string;
  auth_method: string;
  success: boolean;
  details: string | null;
  created_at: string;
}

interface FraudAlert {
  id: string;
  alert_type: string;
  description: string;
  severity: string;
  is_resolved: boolean;
  created_at: string;
}

interface SecuritySettings {
  auth_mode: string;
  voice_enrolled: boolean | null;
  face_enrolled: boolean;
  failed_auth_attempts: number;
  locked_until: string | null;
}

const SecurityDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authLogs, setAuthLogs] = useState<AuthLog[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    try {
      const [logsRes, alertsRes, profileRes] = await Promise.all([
        supabase
          .from('authentication_logs')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('fraud_alerts')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('profiles')
          .select('auth_mode, voice_enrolled, face_enrolled, failed_auth_attempts, locked_until')
          .eq('user_id', user!.id)
          .single(),
      ]);

      if (logsRes.data) setAuthLogs(logsRes.data);
      if (alertsRes.data) setFraudAlerts(alertsRes.data);
      if (profileRes.data) setSettings(profileRes.data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const updateAuthMode = async (mode: string) => {
    await supabase.from('profiles').update({ auth_mode: mode }).eq('user_id', user!.id);
    setSettings(prev => prev ? { ...prev, auth_mode: mode } : null);
  };

  const resolveAlert = async (alertId: string) => {
    await supabase.from('fraud_alerts').update({ is_resolved: true }).eq('id', alertId);
    setFraudAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_resolved: true } : a));
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const methodIcon = (method: string) => {
    switch (method) {
      case 'voice': return <Mic className="w-4 h-4" />;
      case 'pin': return <Lock className="w-4 h-4" />;
      case 'face': return <Camera className="w-4 h-4" />;
      case 'otp': return <Mail className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const unresolvedCount = fraudAlerts.filter(a => !a.is_resolved).length;
  const isLocked = settings?.locked_until && new Date(settings.locked_until) > new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Security Dashboard</h1>
            <p className="text-xs text-muted-foreground">Monitor & manage security</p>
          </div>
          {unresolvedCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unresolvedCount} alerts</Badge>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Account Lock Status */}
        {isLocked && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Account Temporarily Locked</p>
                <p className="text-xs text-muted-foreground">
                  Locked until {formatTime(settings!.locked_until!)} due to {settings!.failed_auth_attempts} failed attempts
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Overview Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{authLogs.length}</p>
              <p className="text-xs text-muted-foreground">Auth Attempts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-accent">{authLogs.filter(l => l.success).length}</p>
              <p className="text-xs text-muted-foreground">Successful</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{authLogs.filter(l => !l.success).length}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="logs" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="logs">Auth Logs</TabsTrigger>
            <TabsTrigger value="alerts">Fraud Alerts</TabsTrigger>
            <TabsTrigger value="settings">Security</TabsTrigger>
          </TabsList>

          {/* Auth Logs Tab */}
          <TabsContent value="logs" className="space-y-2">
            {authLogs.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No authentication logs yet</CardContent></Card>
            ) : (
              authLogs.map(log => (
                <Card key={log.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      log.success ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {log.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {methodIcon(log.auth_method)}
                        <span className="text-sm font-medium text-foreground capitalize">{log.auth_method}</span>
                        <Badge variant={log.success ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                          {log.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                      {log.details && <p className="text-xs text-muted-foreground truncate mt-0.5">{log.details}</p>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatTime(log.created_at)}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Fraud Alerts Tab */}
          <TabsContent value="alerts" className="space-y-2">
            {fraudAlerts.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No fraud alerts — your account is secure!</CardContent></Card>
            ) : (
              fraudAlerts.map(alert => (
                <Card key={alert.id} className={alert.is_resolved ? 'opacity-60' : ''}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        alert.severity === 'high' ? 'text-destructive' : 'text-warning'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{alert.alert_type}</span>
                          <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {alert.severity}
                          </Badge>
                          {alert.is_resolved && (
                            <Badge variant="outline" className="text-[10px] text-accent">Resolved</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatTime(alert.created_at)}</p>
                      </div>
                      {!alert.is_resolved && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => resolveAlert(alert.id)}>
                          Resolve
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Security Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" /> Authentication Layers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary" />
                    <Label className="text-sm">Voice Authentication</Label>
                  </div>
                  <Switch
                    checked={settings?.auth_mode === 'voice' || settings?.auth_mode === 'voice_pin'}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateAuthMode(settings?.auth_mode === 'pin' ? 'voice_pin' : 'voice');
                      } else {
                        updateAuthMode('pin');
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    <Label className="text-sm">PIN Authentication</Label>
                  </div>
                  <Switch
                    checked={settings?.auth_mode === 'pin' || settings?.auth_mode === 'voice_pin'}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateAuthMode(settings?.auth_mode === 'voice' ? 'voice_pin' : 'pin');
                      } else {
                        updateAuthMode('voice');
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    <Label className="text-sm">Face Authentication</Label>
                  </div>
                  <Badge variant={settings?.face_enrolled ? 'default' : 'secondary'} className="text-xs">
                    {settings?.face_enrolled ? 'Enrolled' : 'Not Set'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <Label className="text-sm">Email OTP (High-value)</Label>
                  </div>
                  <Badge variant="default" className="text-xs">Always On</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-primary" /> Fraud Protection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>Voice mismatch blocks transactions</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>High-value transfers require OTP (₹5,000+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>Account locks after 3 failed attempts (30 min)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>Rapid transaction detection (3+ in 5 min)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span>All auth attempts logged</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => navigate('/voice-setup')}>
                <Mic className="w-4 h-4 mr-2" /> Voice Setup
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => navigate('/profile')}>
                <Lock className="w-4 h-4 mr-2" /> Set PIN
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SecurityDashboard;
