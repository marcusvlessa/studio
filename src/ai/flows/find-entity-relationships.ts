'use server';

/**
 * @fileOverview Um agente de IA para encontrar relacionamentos entre entidades.
 *
 * - findEntityRelationships - Uma função que sugere relacionamentos e conexões entre entidades.
 * - FindEntityRelationshipsInput - O tipo de entrada para a função findEntityRelationships.
 * - FindEntityRelationshipsOutput - O tipo de retorno para a função findEntityRelationships.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FindEntityRelationshipsInputSchema = z.object({
  entities: z
    .array(z.string())
    .describe('Uma lista de entidades para encontrar relacionamentos entre elas.'),
});
export type FindEntityRelationshipsInput = z.infer<typeof FindEntityRelationshipsInputSchema>;

const RelationshipSchema = z.object({
  entity1: z.string().describe('A primeira entidade no relacionamento.'),
  entity1Type: z.string().optional().describe('O tipo inferido da primeira entidade (ex: Pessoa, Organização, Local, Telefone).'),
  entity2: z.string().describe('A segunda entidade no relacionamento.'),
  entity2Type: z.string().optional().describe('O tipo inferido da segunda entidade (ex: Pessoa, Organização, Local, Telefone).'),
  relationship: z
    .string()
    .describe('Uma descrição do relacionamento entre as duas entidades.'),
  strength: z.number().min(0).max(1).optional().describe('Força estimada do relacionamento (0 a 1), se aplicável.'),
});


const FindEntityRelationshipsOutputSchema = z.object({
  relationships: z
    .array(RelationshipSchema)
    .describe('Uma lista de relacionamentos entre as entidades.'),
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
  prompt: `Você é um especialista em análise de inteligência e identificação de relacionamentos complexos entre diversas entidades.

Você receberá uma lista de entidades. Sua tarefa é:
1. Identificar os relacionamentos diretos e indiretos mais prováveis entre essas entidades.
2. Para cada entidade em um relacionamento, tente inferir seu tipo (ex: Pessoa, Organização, Localização, Veículo, Número de Telefone, Email, Evento, Documento).
3. Descrever sucintamente cada relacionamento identificado.
4. Se possível, estimar a força ou relevância de cada relacionamento em uma escala de 0 (fraco/irrelevante) a 1 (forte/muito relevante).

Entidades fornecidas:
{{#each entities}}
- {{{this}}}
{{/each}}

Analise cuidadosamente as entidades e suas possíveis conexões. Considere diferentes contextos onde essas entidades poderiam interagir.
Seja o mais específico possível na descrição dos relacionamentos e na tipificação das entidades.

Relacionamentos Identificados:`,
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
