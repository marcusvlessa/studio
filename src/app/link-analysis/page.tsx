"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GitFork, Search, Users, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { findEntityRelationships, type FindEntityRelationshipsInput, type FindEntityRelationshipsOutput } from "@/ai/flows/find-entity-relationships";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function LinkAnalysisPage() {
  const [entitiesInput, setEntitiesInput] = useState<string>("");
  const [relationships, setRelationships] = useState<FindEntityRelationshipsOutput['relationships'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!entitiesInput.trim()) {
      toast({ variant: "destructive", title: "No Entities Provided", description: "Please enter entities to analyze." });
      return;
    }

    setIsLoading(true);
    setRelationships(null);

    const entities = entitiesInput.split(',').map(e => e.trim()).filter(e => e.length > 0);
    if (entities.length === 0) {
        toast({ variant: "destructive", title: "Invalid Input", description: "Please enter valid, comma-separated entities." });
        setIsLoading(false);
        return;
    }
    
    try {
      const input: FindEntityRelationshipsInput = { entities };
      const result = await findEntityRelationships(input);
      setRelationships(result.relationships);
      toast({ title: "Relationship Analysis Complete", description: "Found potential links between entities." });
    } catch (error) {
      console.error("Link analysis error:", error);
      toast({ variant: "destructive", title: "Analysis Failed", description: error instanceof Error ? error.message : "An unknown error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setEntitiesInput("");
    setRelationships(null);
    setIsLoading(false);
    toast({ title: "Reset", description: "Cleared entities and relationship results." });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Link Analysis Module</h1>
        <p className="text-muted-foreground">Visualize relationships between entities with AI-powered suggestions.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Enter Entities</CardTitle>
          <CardDescription>Provide a comma-separated list of entities (e.g., people, organizations, locations) to analyze their connections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="entities-input">Entities</Label>
            <Textarea
              id="entities-input"
              placeholder="e.g., John Doe, Acme Corp, New York Office, Project Phoenix"
              value={entitiesInput}
              onChange={(e) => setEntitiesInput(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleAnalyze} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Analyzing..." : "Find Relationships"}
          </Button>
           <Button variant="outline" onClick={handleReset} disabled={isLoading}>
             <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </CardFooter>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Searching for connections...</p>
          </CardContent>
        </Card>
      )}

      {relationships && relationships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Identified Relationships</CardTitle>
            <CardDescription>Below are the potential connections found between the provided entities. (Visualization placeholder)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
              <div className="space-y-4">
                {relationships.map((rel, index) => (
                  <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <Badge variant="secondary" className="py-1 px-2 text-sm">{rel.entity1}</Badge> 
                        <GitFork className="h-5 w-5 text-primary shrink-0" />
                        <Badge variant="secondary" className="py-1 px-2 text-sm">{rel.entity2}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground text-center italic">
                        "{rel.relationship}"
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      {relationships && relationships.length === 0 && !isLoading && (
         <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No direct relationships found for the provided entities.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
