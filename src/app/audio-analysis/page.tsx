"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Mic, FileAudio, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { transcribeAudio, type TranscribeAudioInput, type TranscribeAudioOutput } from "@/ai/flows/transcribe-audio";

export default function AudioAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscribeAudioOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("audio/")) {
        setSelectedFile(file);
        setTranscriptionResult(null); // Reset previous results
        setProgress(0);
        toast({ title: "Audio File Selected", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload an audio file." });
        setSelectedFile(null);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "No File Selected", description: "Please select an audio file to transcribe." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    
    // Simulate upload progress for larger files (visual only)
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 5;
      if (currentProgress <= 30) { // Simulate initial upload part
        setProgress(currentProgress);
      } else {
        clearInterval(progressInterval);
      }
    }, 100);


    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async (e) => {
        const audioDataUri = e.target?.result as string;
        if (!audioDataUri) {
          throw new Error("Could not read file.");
        }
        
        // Update progress to indicate processing has started
        setProgress(50);

        const input: TranscribeAudioInput = { audioDataUri };
        const result = await transcribeAudio(input);
        setTranscriptionResult(result);
        setProgress(100);
        toast({ title: "Transcription Complete", description: "Audio processed successfully." });
      };
      reader.onerror = () => {
        throw new Error("Error reading file.");
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast({ variant: "destructive", title: "Transcription Failed", description: error instanceof Error ? error.message : "An unknown error occurred." });
      setProgress(0);
    } finally {
      clearInterval(progressInterval); // Ensure interval is cleared
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTranscriptionResult(null);
    setIsLoading(false);
    setProgress(0);
    const fileInput = document.getElementById('audio-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = ""; // Reset file input
    }
    toast({ title: "Reset", description: "Cleared file and transcription results." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Audio Transcription & Analysis</h1>
        <p className="text-muted-foreground">Upload audio files to generate transcripts and analysis reports.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Upload Audio File</CardTitle>
          <CardDescription>Select an audio file (e.g., MP3, WAV, OGG) to begin analysis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="audio-upload">Audio File</Label>
            <Input id="audio-upload" type="file" accept="audio/*" onChange={handleFileChange} />
          </div>
          {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileAudio className="mr-2 h-4 w-4" /> 
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Analysis Progress:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">{progress}% {progress < 100 && progress > 30 ? "(Processing...)" : ""}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="mr-2 h-4 w-4" />}
            {isLoading ? "Transcribing..." : "Transcribe Audio"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </CardFooter>
      </Card>

      {transcriptionResult && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={transcriptionResult.transcript} readOnly rows={15} className="bg-muted/50" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Analysis Report</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={transcriptionResult.report} readOnly rows={15} className="bg-muted/50" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
