import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '../../context/AppContext';
import { ProgressIndicator } from '../ProgressIndicator';
import { Mic, Square, ArrowLeft, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function CraftMessageScreen() {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const [concerns, setConcerns] = useState(state.postcardData.concerns || '');
  const [personalImpact, setPersonalImpact] = useState(state.postcardData.personalImpact || '');
  const [isRecording, setIsRecording] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [recordingField, setRecordingField] = useState<'concerns' | 'impact' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribingField, setTranscribingField] = useState<'concerns' | 'impact' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async (field: 'concerns' | 'impact') => {
    try {
      if (isRecording) {
        // Stop any ongoing recording before starting a new one
        stopRecording();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      setRecordingField(field);
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await transcribeAudio(audioBlob, field);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone permissions and try again.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
    setRecordingField(null);
  };

  const transcribeAudio = async (audioBlob: Blob, field: 'concerns' | 'impact') => {
    setTranscribingField(field);
    
    try {
      // Convert audio blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64Audio = btoa(binary);

      // Call Supabase edge function
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio }
      });

      if (error) {
        throw error;
      }

      if (data?.text) {
        const transcribedText = data.text.trim();
        if (field === 'concerns') {
          const newValue = concerns ? `${concerns.trim()} ${transcribedText}` : transcribedText;
          setConcerns(newValue);
          dispatch({ 
            type: 'UPDATE_POSTCARD_DATA', 
            payload: { concerns: newValue }
          });
        } else {
          const newValue = personalImpact ? `${personalImpact.trim()} ${transcribedText}` : transcribedText;
          setPersonalImpact(newValue);
          dispatch({ 
            type: 'UPDATE_POSTCARD_DATA', 
            payload: { personalImpact: newValue }
          });
        }
        toast({
          title: "Transcription complete",
          description: "Your voice has been transcribed and added to the field.",
        });
      } else {
        throw new Error('No transcription received');
      }

    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription failed",
        description: "Please try recording again or use the text input instead.",
        variant: "destructive",
      });
    } finally {
      setTranscribingField(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const convertListToSentence = (input: string): string => {
    // Check if input looks like a list (comma-separated, bullet points, or line breaks)
    const isListLike = input.includes(',') || input.includes('•') || input.includes('-') || 
                       input.includes('\n') || input.match(/^\d+\./) || input.includes(';');
    
    if (!isListLike) {
      return input; // Return as-is if it's already a sentence
    }
    
    // Clean up the input and convert to sentence format
    let cleanedInput = input
      .replace(/[•\-*]/g, '') // Remove bullet points
      .replace(/^\d+\.\s*/gm, '') // Remove numbered list markers
      .replace(/\n+/g, ', ') // Replace line breaks with commas
      .replace(/[,;]+/g, ', ') // Normalize multiple commas/semicolons
      .replace(/,\s*,/g, ',') // Remove duplicate commas
      .trim();
    
    // Remove trailing comma if present
    cleanedInput = cleanedInput.replace(/,\s*$/, '');
    
    // If it doesn't end with punctuation, add a period
    if (!cleanedInput.match(/[.!?]$/)) {
      cleanedInput += '.';
    }
    
    return cleanedInput;
  };

  const handleDraftMessage = async () => {
    const combinedMessage = [concerns, personalImpact].filter(Boolean).join('. ');
    
    if (!combinedMessage.trim()) {
      alert('Please enter your concerns first');
      return;
    }

    // Convert list-style inputs to sentences
    const processedConcerns = convertListToSentence(concerns);
    const processedPersonalImpact = convertListToSentence(personalImpact);

    // Update the postcard data with the processed inputs
    dispatch({
      type: 'UPDATE_POSTCARD_DATA',
      payload: {
        concerns: processedConcerns,
        personalImpact: processedPersonalImpact
      }
    });

    // Navigate to the drafting screen (step 7)
    dispatch({ type: 'SET_STEP', payload: 7 });
  };


  const handleSkipAI = () => {
    const combinedMessage = [concerns, personalImpact].filter(Boolean).join('. ');
    dispatch({ 
      type: 'UPDATE_POSTCARD_DATA', 
      payload: { 
        originalMessage: combinedMessage,
        draftMessage: combinedMessage,
        finalMessage: combinedMessage
      }
    });
    dispatch({ type: 'SET_STEP', payload: 3 }); // Go to review screen
  };

  const goBack = () => {
    dispatch({ type: 'SET_STEP', payload: 1 });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pb-4 max-w-2xl">
        <Card className="card-warm">
          <CardContent className="p-6">
            <div className="text-center mb-3">
              <h1 className="text-2xl display-title mb-2">
                Make It Personal
              </h1>
              
              <h3 className="subtitle text-base mb-4">
                Provide a few details to start. You'll review and edit the draft next.
              </h3>
            </div>

            {/* Simplified inputs with inline microphone controls */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="field-label">I'm most concerned about:</label>
                <div className="relative">
                  <Textarea
                    placeholder="Immigration..."
                    value={concerns}
                    onChange={(e) => {
                      setConcerns(e.target.value);
                      dispatch({ 
                        type: 'UPDATE_POSTCARD_DATA', 
                        payload: { 
                          concerns: e.target.value,
                          // Clear old generated content when user changes input
                          originalMessage: '',
                          draftMessage: '',
                          finalMessage: '',
                          sources: []
                        }
                      });
                    }}
                    className="input-warm min-h-[60px] resize-none pr-16"
                  />
                  <button
                    type="button"
                    aria-label={isRecording && recordingField === 'concerns' ? 'Stop recording' : 'Start recording for concerns'}
                    aria-pressed={isRecording && recordingField === 'concerns'}
                    onClick={() => (isRecording && recordingField === 'concerns') ? stopRecording() : startRecording('concerns')}
                    className={`absolute right-3 top-3 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm ${
                      isRecording && recordingField === 'concerns'
                        ? 'bg-destructive text-destructive-foreground ring-2 ring-destructive/40 shadow-lg animate-pulse'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {isRecording && recordingField === 'concerns' && (
                      <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping sm:hidden" aria-hidden="true" />
                    )}
                    {isRecording && recordingField === 'concerns' ? (
                      <Square className="w-5 h-5" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {isRecording && recordingField === 'concerns' && (
                  <div className="flex justify-end">
                    <span aria-live="polite" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                )}
                {transcribingField === 'concerns' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Transcribing your voice...
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="field-label">How it affects me or my community:</label>
                <div className="relative">
                  <Textarea
                    placeholder="I am a parent of two children in public schools..."
                    value={personalImpact}
                    onChange={(e) => {
                      setPersonalImpact(e.target.value);
                      dispatch({ 
                        type: 'UPDATE_POSTCARD_DATA', 
                        payload: { 
                          personalImpact: e.target.value,
                          // Clear old generated content when user changes input
                          originalMessage: '',
                          draftMessage: '',
                          finalMessage: '',
                          sources: []
                        }
                      });
                    }}
                    className="input-warm min-h-[70px] resize-none pr-16"
                  />
                  <button
                    type="button"
                    aria-label={isRecording && recordingField === 'impact' ? 'Stop recording' : 'Start recording for impact'}
                    aria-pressed={isRecording && recordingField === 'impact'}
                    onClick={() => (isRecording && recordingField === 'impact') ? stopRecording() : startRecording('impact')}
                    className={`absolute right-3 top-3 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm ${
                      isRecording && recordingField === 'impact'
                        ? 'bg-destructive text-destructive-foreground ring-2 ring-destructive/40 shadow-lg animate-pulse'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {isRecording && recordingField === 'impact' && (
                      <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping sm:hidden" aria-hidden="true" />
                    )}
                    {isRecording && recordingField === 'impact' ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {isRecording && recordingField === 'impact' && (
                  <div className="flex justify-end">
                    <span aria-live="polite" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                )}
                {transcribingField === 'impact' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Transcribing your voice...
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <Button
                variant="spotlight"
                onClick={handleDraftMessage}
                disabled={(!concerns.trim() && !personalImpact.trim()) || isDrafting}
                className="w-full button-warm h-10"
              >
                {isDrafting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    AI is thinking...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Draft My Postcard
                  </>
                )}
              </Button>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={goBack}
                  className="flex-1 button-warm h-10"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleSkipAI}
                  className="flex-1 button-warm h-10"
                >
                  Write it myself
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}