"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ImageIcon, FileImage, Search, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeImage, type AnalyzeImageInput, type AnalyzeImageOutput } from "@/ai/flows/analyze-image";
import Image from "next/image"; // Using next/image for optimized image display

export default function ImageAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeImageOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
        setAnalysisResult(null); // Reset previous results
        setProgress(0);

        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        toast({ title: "Image Selected", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload an image file (PNG, JPG, etc.)." });
        setSelectedFile(null);
        setImagePreview(null);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !imagePreview) {
      toast({ variant: "destructive", title: "No Image Selected", description: "Please select an image file to analyze." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 5;
      if (currentProgress <= 30) { 
        setProgress(currentProgress);
      } else {
        clearInterval(progressInterval);
      }
    }, 100);

    try {
      // imagePreview already contains the data URI from FileReader
      const photoDataUri = imagePreview;
      
      setProgress(50); // Indicate processing has started

      const input: AnalyzeImageInput = { photoDataUri };
      const result = await analyzeImage(input);
      setAnalysisResult(result);
      setProgress(100);
      toast({ title: "Image Analysis Complete", description: "Image processed successfully." });
    } catch (error) {
      console.error("Image analysis error:", error);
      toast({ variant: "destructive", title: "Analysis Failed", description: error instanceof Error ? error.message : "An unknown error occurred." });
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setIsLoading(false);
    setProgress(0);
    const fileInput = document.getElementById('image-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = ""; // Reset file input
    }
    toast({ title: "Reset", description: "Cleared image and analysis results." });
  };


  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Image Analysis Module</h1>
        <p className="text-muted-foreground">Upload images for AI-powered analysis, description generation, and potential plate reading.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Upload Image</CardTitle>
          <CardDescription>Select an image file (PNG, JPG, GIF, etc.) to begin analysis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="image-upload">Image File</Label>
            <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          {selectedFile && (
             <p className="text-sm text-muted-foreground flex items-center">
                <FileImage className="mr-2 h-4 w-4" /> 
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
          {imagePreview && (
            <div className="mt-4">
              <Label>Image Preview:</Label>
              <div className="mt-2 w-full max-w-md aspect-video relative overflow-hidden rounded-md border shadow-sm">
                <Image src={imagePreview} alt="Preview" layout="fill" objectFit="contain" />
              </div>
            </div>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Analysis Progress:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">{progress}% {progress < 100 && progress > 30 ? "(Analyzing...)" : ""}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analyzing..." : "Analyze Image"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </CardFooter>
      </Card>

      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="description-output">Generated Description:</Label>
              <Textarea id="description-output" value={analysisResult.description} readOnly rows={6} className="bg-muted/50" />
            </div>
            {analysisResult.possiblePlateRead && (
              <div>
                <Label htmlFor="plate-output">Possible License Plate Read:</Label>
                <Input id="plate-output" value={analysisResult.possiblePlateRead} readOnly className="bg-muted/50 font-mono text-lg" />
                <p className="text-xs text-muted-foreground mt-1">Note: License plate readings are suggestive and may not be 100% accurate.</p>
              </div>
            )}
            {!analysisResult.possiblePlateRead && (
                 <p className="text-sm text-muted-foreground">No license plate confidently detected.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
