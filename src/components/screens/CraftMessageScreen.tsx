import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppContext } from '../../context/AppContext';
import { ProgressIndicator } from '../ProgressIndicator';
import { Mic, Square, ArrowLeft, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeStorage } from '@/lib/safeStorage';
import { captureEdgeFunctionError } from '@/lib/errorTracking';
export function CraftMessageScreen() {
  const {
    state,
    dispatch
  } = useAppContext();
  const {
    toast
  } = useToast();
  const [concerns, setConcerns] = useState(state.postcardData.concerns || '');
  const [personalImpact, setPersonalImpact] = useState(state.postcardData.personalImpact || '');
  const [isRecording, setIsRecording] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [recordingField, setRecordingField] = useState<'concerns' | 'impact' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribingField, setTranscribingField] = useState<'concerns' | 'impact' | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onboardingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show onboarding animation on every page load
  useEffect(() => {
    setShowOnboarding(true);
    // Auto-hide onboarding after 3 seconds
    onboardingTimeoutRef.current = setTimeout(() => {
      setShowOnboarding(false);
    }, 3000);
    return () => {
      if (onboardingTimeoutRef.current) {
        clearTimeout(onboardingTimeoutRef.current);
      }
    };
  }, []);
  const startRecording = async (field: 'concerns' | 'impact') => {
    try {
      if (isRecording) {
        // Stop any ongoing recording before starting a new one
        stopRecording();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      setRecordingField(field);
      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, {
          type: 'audio/wav'
        });
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
        variant: 'destructive'
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
      const {
        data,
        error
      } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio
        }
      });
      if (error) {
        captureEdgeFunctionError(error, 'transcribe-audio', {
          email: state.postcardData?.email,
          zipCode: state.postcardData?.zipCode,
          representative: state.postcardData?.representative?.name,
          step: 'craft_message',
          field
        });
        throw error;
      }
      if (data?.text) {
        const transcribedText = data.text.trim();
        if (field === 'concerns') {
          const newValue = concerns ? `${concerns.trim()} ${transcribedText}` : transcribedText;
          setConcerns(newValue);
          dispatch({
            type: 'UPDATE_POSTCARD_DATA',
            payload: {
              concerns: newValue
            }
          });
        } else {
          const newValue = personalImpact ? `${personalImpact.trim()} ${transcribedText}` : transcribedText;
          setPersonalImpact(newValue);
          dispatch({
            type: 'UPDATE_POSTCARD_DATA',
            payload: {
              personalImpact: newValue
            }
          });
        }
      } else {
        throw new Error('No transcription received');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      captureEdgeFunctionError(error, 'transcribe-audio', {
        email: state.postcardData?.email,
        zipCode: state.postcardData?.zipCode,
        representative: state.postcardData?.representative?.name,
        step: 'craft_message',
        field,
        errorContext: 'catch_block'
      });
      toast({
        title: "Transcription failed",
        description: "Please try recording again or use the text input instead.",
        variant: "destructive"
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
    const isListLike = input.includes(',') || input.includes('•') || input.includes('-') || input.includes('\n') || input.match(/^\d+\./) || input.includes(';');
    if (!isListLike) {
      return input; // Return as-is if it's already a sentence
    }

    // Clean up the input and convert to sentence format
    let cleanedInput = input.replace(/[•\-*]/g, '') // Remove bullet points
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
    dispatch({
      type: 'SET_STEP',
      payload: 7
    });
  };
  const handleSkipAI = async () => {
    setIsSkipping(true);
    try {
      // Convert list-style inputs to sentences first
      const processedConcerns = convertListToSentence(concerns);
      const processedPersonalImpact = convertListToSentence(personalImpact);
      const combinedMessage = [processedConcerns, processedPersonalImpact].filter(Boolean).join('. ');
      try {
        // Capture ref parameter from URL for tracking
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref') || undefined;

        // Create a manual draft in the database
        const {
          data,
          error
        } = await supabase.functions.invoke('postcard-draft', {
          body: {
            action: 'create',
            zipCode: state.postcardData.zipCode,
            concerns: processedConcerns,
            personalImpact: processedPersonalImpact,
            refCode: refCode
          }
        });
        if (error) {
          console.error('Failed to create manual draft:', error);
          toast({
            title: "Error creating draft",
            description: "Please try again or continue without saving.",
            variant: "destructive"
          });
        }

        // Update state with processed data and draftId
        dispatch({
          type: 'UPDATE_POSTCARD_DATA',
          payload: {
            concerns: processedConcerns,
            personalImpact: processedPersonalImpact,
            originalMessage: combinedMessage,
            draftMessage: combinedMessage,
            finalMessage: combinedMessage,
            draftId: data?.draftId || null
          }
        });
      } catch (error) {
        console.error('Error creating manual draft:', error);
        // Continue anyway with just state updates
        dispatch({
          type: 'UPDATE_POSTCARD_DATA',
          payload: {
            concerns: processedConcerns,
            personalImpact: processedPersonalImpact,
            originalMessage: combinedMessage,
            draftMessage: combinedMessage,
            finalMessage: combinedMessage
          }
        });
      }

      // Navigate directly to the review screen
      dispatch({
        type: 'SET_STEP',
        payload: 3
      });
    } finally {
      setIsSkipping(false);
    }
  };
  const goBack = () => {
    dispatch({
      type: 'SET_STEP',
      payload: 1
    });
  };
  return <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-4 max-w-4xl pb-24">
        {/* Desktop two-column layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Left column - Form inputs */}
          <div>
            <Card className="card-warm">
          <CardContent className="p-6">
            <div className="text-center mb-3">
              <h1 className="display-title mb-2">What's on your mind?</h1>
              
              <h3 className="subtitle text-base mb-4">Representatives respond best to personal messages </h3>
            </div>

            {/* External voice button approach with onboarding */}
            <TooltipProvider>
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="field-label">I'm most concerned about:</label>
                  <div className="flex gap-3 items-stretch">
                    <Textarea placeholder="Education" value={concerns} onChange={e => {
                    setConcerns(e.target.value);
                    dispatch({
                      type: 'UPDATE_POSTCARD_DATA',
                      payload: {
                        concerns: e.target.value,
                        originalMessage: '',
                        draftMessage: '',
                        finalMessage: '',
                        sources: []
                      }
                    });
                  }} className="input-warm min-h-[70px] max-h-[120px] resize-none flex-1 overflow-y-auto" data-attr="input-craft-concerns" />
                    
                    <Button type="button" variant="secondary" aria-label={isRecording && recordingField === 'concerns' ? 'Stop recording' : 'Start recording for concerns'} aria-pressed={isRecording && recordingField === 'concerns'} onClick={() => {
                    if (isRecording && recordingField === 'concerns') {
                      stopRecording();
                    } else {
                      startRecording('concerns');
                      // Hide onboarding when user interacts
                      if (showOnboarding) {
                        setShowOnboarding(false);
                      }
                    }
                  }} className={`!h-auto self-stretch w-auto px-3 sm:px-4 py-3 transition-all duration-200 flex-shrink-0 ${showOnboarding && recordingField !== 'concerns' ? 'pulse-subtle' : ''} ${isRecording && recordingField === 'concerns' ? 'bg-destructive text-white hover:bg-destructive/90 recording-pulse' : 'bg-primary text-white hover:bg-primary/90'}`} data-attr={isRecording && recordingField === 'concerns' ? 'click-craft-voice-stop-concerns' : 'click-craft-voice-record-concerns'}>
                      {isRecording && recordingField === 'concerns' ? <>
                          <Square className="w-5 h-5 sm:mr-2" />
                          <span className="hidden sm:inline">Stop</span>
                        </> : <>
                          <Mic className="w-5 h-5 sm:mr-2" />
                          <span className="hidden sm:inline">Speak</span>
                        </>}
                    </Button>
                  </div>
                  
                  
                  {transcribingField === 'concerns' && <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Transcribing your voice...
                    </p>}
                </div>

                <div className="space-y-3">
                  <label className="field-label">How it affects my community (optional):</label>
                  <div className="flex gap-3 items-stretch">
                    <Textarea placeholder="Cuts to arts programs at my kids' school" value={personalImpact} onChange={e => {
                      setPersonalImpact(e.target.value);
                      dispatch({
                        type: 'UPDATE_POSTCARD_DATA',
                        payload: {
                          personalImpact: e.target.value,
                          originalMessage: '',
                          draftMessage: '',
                          finalMessage: '',
                          sources: []
                        }
                      });
                    }} className="input-warm min-h-[70px] max-h-[120px] resize-none flex-1 overflow-y-auto" data-attr="input-craft-impact" />
                    
                    <Button type="button" variant="secondary" aria-label={isRecording && recordingField === 'impact' ? 'Stop recording' : 'Start recording for impact'} aria-pressed={isRecording && recordingField === 'impact'} onClick={() => isRecording && recordingField === 'impact' ? stopRecording() : startRecording('impact')} className={`!h-auto self-stretch w-auto px-3 sm:px-4 py-3 transition-all duration-200 flex-shrink-0 ${isRecording && recordingField === 'impact' ? 'bg-destructive text-white hover:bg-destructive/90 recording-pulse' : 'bg-primary text-white hover:bg-primary/90'}`} data-attr={isRecording && recordingField === 'impact' ? 'click-craft-voice-stop-impact' : 'click-craft-voice-record-impact'}>
                      {isRecording && recordingField === 'impact' ? <>
                          <Square className="w-5 h-5 sm:mr-2" />
                          <span className="hidden sm:inline">Stop</span>
                        </> : <>
                          <Mic className="w-5 h-5 sm:mr-2" />
                          <span className="hidden sm:inline">Speak</span>
                        </>}
                    </Button>
                  </div>
                  
                  
                  {transcribingField === 'impact' && <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Transcribing your voice...
                    </p>}
                </div>
              </div>
            </TooltipProvider>

            <div className="space-y-4 pt-4">
              <Button variant="spotlight" onClick={handleDraftMessage} disabled={!concerns.trim() && !personalImpact.trim() || isDrafting} className="w-full h-10" data-attr="click-craft-ai-draft">
                {isDrafting ? <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    AI is thinking...
                  </> : <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Draft My Postcard With Canary
                  </>}
              </Button>

              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={goBack} className="flex-1 h-10" data-attr="click-craft-back">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <Button variant="secondary" onClick={handleSkipAI} disabled={isSkipping} className="flex-1 h-10" data-attr="click-craft-write-myself">
                  <span>{isSkipping ? 'Saving...' : 'Write it myself'}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
          </div>

          {/* Right column - Tips and context (desktop only) */}
          <div className="hidden lg:block">
            <Card className="card-warm sticky top-4">
              <CardContent className="p-6 space-y-4">
                <h3 className="display-title text-lg">Tips for your message</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="text-primary">💡</span>
                    <p className="body-text">Be specific about how the issue affects you or your community</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-primary">✍️</span>
                    <p className="body-text">Personal stories are more compelling than statistics</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-primary">🎯</span>
                    <p className="body-text">Our AI will craft a professional message based on your input</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>;
}