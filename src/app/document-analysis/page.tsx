"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { FileUp, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DocumentAnalysisPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf" || file.type.startsWith("application/vnd.openxmlformats-officedocument") || file.type.startsWith("image/")) {
        setSelectedFile(file);
        setAnalysisResult(null); // Reset previous results
        setProgress(0);

        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setFilePreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          setFilePreview(null); // For non-image files, don't show a preview
        }
        toast({ title: "File Selected", description: file.name });
      } else {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a PDF, Word, or image file." });
        setSelectedFile(null);
        setFilePreview(null);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "No File Selected", description: "Please select a file to analyze." });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    
    // Simulate analysis progress
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      if (currentProgress <= 100) {
        setProgress(currentProgress);
      } else {
        clearInterval(interval);
      }
    }, 200);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    clearInterval(interval);
    setProgress(100);

    // Placeholder for actual OCR/analysis logic
    const mockAnalysis = `Analysis for ${selectedFile.name}:\n\n- Document Type: ${selectedFile.type}\n- Key Entities: Person A, Organization B, Location C\n- Summary: This document discusses a potential security breach involving multiple parties. Further investigation is recommended.`;
    setAnalysisResult(mockAnalysis);
    setIsLoading(false);
    toast({ title: "Analysis Complete", description: "Document processed successfully." });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setAnalysisResult(null);
    setIsLoading(false);
    setProgress(0);
    const fileInput = document.getElementById('document-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = ""; // Reset file input
    }
    toast({ title: "Reset", description: "Cleared file and analysis results." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Document Analysis Module</h1>
        <p className="text-muted-foreground">Upload and process PDF, Word, or image files for analysis.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>Select a file (PDF, DOCX, PNG, JPG) to begin analysis. OCR will be applied to images.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="document-upload">Document File</Label>
            <Input id="document-upload" type="file" accept=".pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={handleFileChange} />
          </div>
          {selectedFile && filePreview && selectedFile.type.startsWith("image/") && (
            <div>
              <Label>Image Preview:</Label>
              <img src={filePreview} alt="Preview" className="mt-2 max-h-60 w-auto rounded border" />
            </div>
          )}
          {selectedFile && !selectedFile.type.startsWith("image/") && (
             <p className="text-sm text-muted-foreground">Selected file: {selectedFile.name} ({ (selectedFile.size / 1024).toFixed(2) } KB)</p>
          )}
          {isLoading && (
            <div className="space-y-2">
              <Label>Analysis Progress:</Label>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">{progress}%</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={!selectedFile || isLoading}>
            <Search className="mr-2 h-4 w-4" />
            {isLoading ? "Analyzing..." : "Analyze Document"}
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
          <CardContent>
            <Textarea value={analysisResult} readOnly rows={10} className="bg-muted/50" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
