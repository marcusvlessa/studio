'use server';

/**
 * @fileOverview An AI agent for finding relationships between entities.
 *
 * - findEntityRelationships - A function that suggests relationships and connections between entities.
 * - FindEntityRelationshipsInput - The input type for the findEntityRelationships function.
 * - FindEntityRelationshipsOutput - The return type for the findEntityRelationships function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FindEntityRelationshipsInputSchema = z.object({
  entities: z
    .array(z.string())
    .describe('A list of entities to find relationships between.'),
});
export type FindEntityRelationshipsInput = z.infer<typeof FindEntityRelationshipsInputSchema>;

const FindEntityRelationshipsOutputSchema = z.object({
  relationships: z
    .array(
      z.object({
        entity1: z.string().describe('The first entity in the relationship.'),
        entity2: z.string().describe('The second entity in the relationship.'),
        relationship: z
          .string()
          .describe('A description of the relationship between the two entities.'),
      })
    )
    .describe('A list of relationships between the entities.'),
});
export type FindEntityRelationshipsOutput = z.infer<typeof FindEntityRelationshipsOutputSchema>;

export async function findEntityRelationships(
  input: FindEntityRelationshipsInput
): Promise<FindEntityRelationshipsOutput> {
  return findEntityRelationshipsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findEntityRelationshipsPrompt',
  input: {schema: FindEntityRelationshipsInputSchema},
  output: {schema: FindEntityRelationshipsOutputSchema},
  prompt: `You are an expert in identifying relationships between entities.

You will be provided with a list of entities, and you will identify the relationships between them.

Entities: {{entities}}

Relationships:`,
});

const findEntityRelationshipsFlow = ai.defineFlow(
  {
    name: 'findEntityRelationshipsFlow',
    inputSchema: FindEntityRelationshipsInputSchema,
    outputSchema: FindEntityRelationshipsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
