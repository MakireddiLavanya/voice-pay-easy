/**
 * Noise Cancellation Hook
 * Uses Web Audio API to filter crowd noise and improve voice clarity.
 * Provides microphone sensitivity control.
 */
import { useState, useRef, useCallback } from 'react';

export const useNoiseFilter = () => {
  const [sensitivity, setSensitivity] = useState(75); // 0-100 scale
  const [isFilterActive, setIsFilterActive] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Create a noise-filtered audio stream using Web Audio API.
   * Applies high-pass filter (removes low rumble) and dynamic compressor.
   */
  const getFilteredStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!isFilterActive) {
        streamRef.current = stream;
        return stream;
      }

      // Create Audio Context for noise filtering
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // High-pass filter: removes low-frequency crowd noise (below 85Hz)
      const highPass = audioContext.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 85;
      highPass.Q.value = 0.7;

      // Low-pass filter: removes high-frequency hiss (above 3500Hz)
      const lowPass = audioContext.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 3500;

      // Dynamic compressor: normalizes volume and reduces background noise
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50 + (sensitivity / 100) * 30; // -50 to -20 dB
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      // Gain node: adjust microphone sensitivity
      const gainNode = audioContext.createGain();
      gainNode.gain.value = sensitivity / 50; // 0 to 2x gain

      // Connect the audio processing chain
      source
        .connect(highPass)
        .connect(lowPass)
        .connect(compressor)
        .connect(gainNode);

      // Create output stream from processed audio
      const destination = audioContext.createMediaStreamDestination();
      gainNode.connect(destination);

      streamRef.current = destination.stream;
      return destination.stream;
    } catch (error) {
      return null;
    }
  }, [sensitivity, isFilterActive]);

  /**
   * Clean up audio resources.
   */
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return {
    sensitivity,
    setSensitivity,
    isFilterActive,
    setIsFilterActive,
    getFilteredStream,
    cleanup,
  };
};
