// This file is machine-generated - changes may be lost.

'use server';

/**
 * @fileOverview AI flow for analyzing images to extract data and generate descriptions.
 *
 * - analyzeImage - Analyzes an image to extract relevant data and generate a description.
 * - AnalyzeImageInput - The input type for the analyzeImage function.
 * - AnalyzeImageOutput - The return type for the analyzeImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo to analyze, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Corrected description
    ),
});

export type AnalyzeImageInput = z.infer<typeof AnalyzeImageInputSchema>;

const AnalyzeImageOutputSchema = z.object({
  description: z.string().describe('A detailed description of the image content.'),
  possiblePlateRead: z.string().optional().describe('A plausible license plate read if detected.'),
});

export type AnalyzeImageOutput = z.infer<typeof AnalyzeImageOutputSchema>;

export async function analyzeImage(input: AnalyzeImageInput): Promise<AnalyzeImageOutput> {
  return analyzeImageFlow(input);
}

const analyzeImagePrompt = ai.definePrompt({
  name: 'analyzeImagePrompt',
  input: {schema: AnalyzeImageInputSchema},
  output: {schema: AnalyzeImageOutputSchema},
  prompt: `You are an expert in image analysis.  Your job is to analyze an image and extract any relevant data from it and generate a detailed description.

  Analyze the following image:
  {{media url=photoDataUri}}

  Pay close attention to identifying any text in the image, such as license plates.  If a license plate is detected, provide a plausible reading of the plate, but only if you are at least 75% sure of the reading.
  Describe the image in detail, including objects, people, and any other relevant information.
`,
});

const analyzeImageFlow = ai.defineFlow(
  {
    name: 'analyzeImageFlow',
    inputSchema: AnalyzeImageInputSchema,
    outputSchema: AnalyzeImageOutputSchema,
  },
  async input => {
    const {output} = await analyzeImagePrompt(input);
    return output!;
  }
);
