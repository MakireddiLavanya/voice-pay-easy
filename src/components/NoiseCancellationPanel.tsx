/**
 * Noise Cancellation Control Panel
 * Provides UI for microphone sensitivity and noise filter toggle.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { AudioLines, Volume2 } from 'lucide-react';

interface NoiseCancellationPanelProps {
  sensitivity: number;
  onSensitivityChange: (value: number) => void;
  isFilterActive: boolean;
  onFilterToggle: (active: boolean) => void;
}

const NoiseCancellationPanel = ({
  sensitivity,
  onSensitivityChange,
  isFilterActive,
  onFilterToggle,
}: NoiseCancellationPanelProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AudioLines className="w-5 h-5 text-primary" />
          Noise Cancellation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="noise-filter" className="text-sm">
            Crowd Noise Filter
          </Label>
          <Switch
            id="noise-filter"
            checked={isFilterActive}
            onCheckedChange={onFilterToggle}
          />
        </div>

        {/* Sensitivity slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Mic Sensitivity
            </Label>
            <span className="text-xs text-muted-foreground">{sensitivity}%</span>
          </div>
          <Slider
            value={[sensitivity]}
            onValueChange={([val]) => onSensitivityChange(val)}
            min={10}
            max={100}
            step={5}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NoiseCancellationPanel;
