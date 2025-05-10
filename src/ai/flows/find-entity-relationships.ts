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
  analysisContext: z.enum(["Geral", "Telefonia", "Financeira", "Pessoas", "Digital"])
    .optional()
    .describe('Contexto opcional da análise para ajudar a IA a focar em tipos de relacionamentos e entidades relevantes (ex: Telefonia, Financeira, Pessoas, Digital). Se "Geral", todos os tipos são considerados.'),
});
export type FindEntityRelationshipsInput = z.infer<typeof FindEntityRelationshipsInputSchema>;

const RelationshipSchema = z.object({
  entity1: z.string().describe('A primeira entidade no relacionamento.'),
  entity1Type: z.string().optional().describe('O tipo inferido da primeira entidade (ex: Pessoa, Organização, Local, Telefone, Email, IP, Valor Monetário, etc.).'),
  entity2: z.string().describe('A segunda entidade no relacionamento.'),
  entity2Type: z.string().optional().describe('O tipo inferido da segunda entidade (ex: Pessoa, Organização, Local, Telefone, Email, IP, Valor Monetário, etc.).'),
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
2. Para cada entidade em um relacionamento, tente inferir seu tipo. Seja o mais específico possível.
   Tipos de entidade sugeridos para inferência: Pessoa (nome completo), Organização (nome da empresa/instituição), Localização (endereço, cidade, estado, país, coordenada geográfica), Número de Telefone (com DDD, ex: (XX) XXXXX-XXXX), Endereço de Email (ex: usuario@dominio.com), Endereço IP (ex: 192.168.1.1), Valor Monetário (com moeda, ex: R$ 1.000,00), Data (ex: DD/MM/AAAA), Documento (ex: CPF XXX.XXX.XXX-XX, CNPJ XX.XXX.XXX/XXXX-XX, RG), Veículo (Placa XXX-YYYY ou XXXX-YYY, Chassi, Modelo), Evento (descrição de um acontecimento), Site/URL (ex: https://www.exemplo.com), Conta Bancária (Agência XXXX, Conta YYYYY-Z), Chave PIX (CPF, CNPJ, Email, Telefone, Aleatória).
3. Descrever sucintamente cada relacionamento identificado.
4. Se possível, estimar a força ou relevância de cada relacionamento em uma escala de 0 (fraco/irrelevante) a 1 (forte/muito relevante).

Entidades fornecidas:
{{#each entities}}
- {{{this}}}
{{/each}}

{{#if analysisContext}}
Contexto Específico da Análise: {{{analysisContext}}}
Foco da Análise: Ao identificar tipos e relacionamentos, dê atenção especial a entidades e conexões pertinentes a este contexto.
  - Se 'Telefonia': foque em Números de Telefone, ERBs, IMEI, contatos, registros de chamadas.
  - Se 'Financeira': foque em Valores Monetários, Contas Bancárias, Chaves PIX, transações, fraudes financeiras.
  - Se 'Pessoas': foque em Pessoas, Organizações, Documentos (CPF, RG), relações familiares, profissionais ou criminosas.
  - Se 'Digital': foque em Endereços de Email, Endereços IP, Sites/URLs, nomes de usuário, atividades online.
Se 'Geral', considere todos os tipos de forma equilibrada.
{{/if}}

Analise cuidadosamente as entidades e suas possíveis conexões. Considere diferentes contextos onde essas entidades poderiam interagir.
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
