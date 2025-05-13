'use server';

/**
 * @fileOverview Um agente de IA para encontrar relacionamentos entre entidades, inspirado nas capacidades do i2 Analyst's Notebook.
 *
 * - findEntityRelationships - Uma função que identifica, classifica e descreve relacionamentos complexos entre um conjunto de entidades fornecidas, considerando um contexto de análise específico.
 * - FindEntityRelationshipsInput - O tipo de entrada para a função findEntityRelationships.
 * - FindEntityRelationshipsOutput - O tipo de retorno para a função findEntityRelationships.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EntitySchema = z.object({
  id: z.string().describe('Identificador único para a entidade no grafo, preferencialmente o próprio label da entidade se for único, ou uma forma sanitizada dele.'),
  label: z.string().describe('O valor ou nome da entidade.'),
  type: z.string().describe('O tipo inferido da entidade (ex: Pessoa, Organização, Localização, Telefone, Email, IP, Veículo, Evento, Transação Financeira, Documento, Website, Chave PIX, IMEI, ERB, Conta Bancária, Arma de Fogo, Outros).'),
  properties: z.string().optional().describe('Uma STRING JSON representando propriedades adicionais da entidade (ex: para Pessoa "{\"CPF\": \"XXX.XXX.XXX-XX\", \"RG\": \"12.345.678-9\"}"). Os valores dentro do JSON devem ser strings. Se não houver propriedades, envie uma string JSON vazia "{}" ou omita o campo.')
});

const RelationshipSchema = z.object({
  source: z.string().describe('O ID da entidade de origem do relacionamento (deve corresponder a um ID de `identifiedEntities`).'),
  target: z.string().describe('O ID da entidade de destino do relacionamento (deve corresponder a um ID de `identifiedEntities`).'),
  label: z.string().describe('Uma descrição concisa do relacionamento (ex: "Comunicou com", "Transferiu para", "Associado a", "Proprietário de", "Localizado em", "Ocorreu em", "Membro de").'),
  type: z.string().optional().describe('Um tipo categorizado de relacionamento (ex: Comunicação, Financeiro, Familiar, Profissional, Geográfico, Técnico, Posse, Social).'),
  direction: z.enum(["direcional", "bidirecional", "nao_direcional"]).optional().default("nao_direcional").describe("A direcionalidade do relacionamento. 'direcional' de source para target, 'bidirecional' para ambos, 'nao_direcional' para associação sem direção clara."),
  strength: z.number().min(0).max(1).optional().describe('Força estimada ou confiança do relacionamento (0 a 1), se aplicável.'),
  properties: z.string().optional().describe('Uma STRING JSON representando propriedades adicionais do relacionamento (ex: "{\"data_hora\": \"DD/MM/AAAA HH:MM\", \"valor_texto\": \"R$ XXX,XX\", \"frequencia_texto\": \"3 vezes\"}"). Os valores dentro do JSON devem ser strings. Se não houver, envie "{}" ou omita.')
});

const FindEntityRelationshipsInputSchema = z.object({
  entities: z
    .array(z.string())
    .min(1, "Pelo menos uma entidade deve ser fornecida.")
    .describe('Uma lista de textos ou valores brutos representando entidades a serem analisadas. A IA deve processar esta lista para identificar, classificar e encontrar relações. Se a lista parecer vir de uma tabela (várias strings curtas), considere que entidades na mesma "linha" conceitual podem estar relacionadas.'),
  analysisContext: z.enum(["Geral", "Telefonia", "Financeira", "Pessoas e Organizações", "Digital e Cibernética", "Investigação Criminal Genérica"])
    .optional()
    .default("Geral")
    .describe('Contexto da análise para guiar a IA no tipo de entidades e relacionamentos a priorizar. Por exemplo, em "Telefonia", foque em números, IMEIs, ERBs; em "Financeira", em transações, contas.'),
  fileOrigin: z.string().optional().describe("Nome do arquivo original de onde as entidades foram extraídas, se aplicável, para contexto adicional.")
});
export type FindEntityRelationshipsInput = z.infer<typeof FindEntityRelationshipsInputSchema>;

const FinalEntitySchema = EntitySchema.extend({
    properties: z.record(z.string()).optional()
});
const FinalRelationshipSchema = RelationshipSchema.extend({
    properties: z.record(z.string()).optional()
});

const FindEntityRelationshipsOutputSchema = z.object({
  identifiedEntities: z.array(FinalEntitySchema).describe("Lista de todas as entidades únicas identificadas e classificadas pela IA a partir da entrada."),
  relationships: z.array(FinalRelationshipSchema).describe('Uma lista de relacionamentos identificados entre as entidades.'),
  analysisSummary: z.string().optional().describe("Um resumo textual conciso da análise de vínculos realizada pela IA, destacando os achados mais importantes, padrões observados, entidades centrais, ou dificuldades encontradas. Deve ser redigido em linguagem clara e investigativa.")
});
export type FindEntityRelationshipsOutput = z.infer<typeof FindEntityRelationshipsOutputSchema>;

// Define schemas for the prompt's expected output (with JSON strings for properties)
const PromptOutputSchema = z.object({
    identifiedEntities: z.array(EntitySchema).describe("Lista de todas as entidades únicas identificadas e classificadas pela IA a partir da entrada."),
    relationships: z.array(RelationshipSchema).describe('Uma lista de relacionamentos identificados entre as entidades.'),
    analysisSummary: z.string().optional().describe("Resumo textual da análise de vínculos.")
});


export async function findEntityRelationships(
  input: FindEntityRelationshipsInput
): Promise<FindEntityRelationshipsOutput> {
  if (!input.entities || input.entities.length === 0) {
    return {
      identifiedEntities: [],
      relationships: [],
      analysisSummary: "Nenhuma entidade de entrada fornecida para análise de vínculos."
    };
  }
  return findEntityRelationshipsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findEntityRelationshipsPrompt',
  input: {schema: FindEntityRelationshipsInputSchema},
  output: {schema: PromptOutputSchema}, 
  prompt: `Você é um especialista em análise de inteligência e construção de grafos de vínculos, modelado a partir das capacidades do IBM i2 Analyst's Notebook. Sua tarefa é analisar uma lista de entidades de entrada, identificar entidades distintas, classificá-las e, o mais importante, inferir e descrever os relacionamentos entre elas. Se necessário, crie entidades implícitas (como Eventos ou Transações) para conectar outras entidades de forma significativa.

**Contexto da Análise:** {{{analysisContext}}}
{{#if fileOrigin}}Arquivo de Origem dos Dados: {{{fileOrigin}}}{{/if}}

**Entidades Brutas Fornecidas para Análise (podem ser texto extraído de um arquivo, incluindo linhas de tabela):**
{{#if entities.length}}
  {{#each entities}}
    - {{{this}}}
  {{/each}}
{{else}}
  - Nenhuma entidade bruta fornecida.
{{/if}}

**Instruções Detalhadas:**

1.  **Identificação e Classificação de Entidades (Campo: identifiedEntities):**
    *   Processe a lista de 'Entidades Brutas'. Identifique entidades únicas e significativas.
    *   Para CADA entidade identificada:
        *   Atribua um 'id' único. Use o próprio valor da entidade ('label') como ID se for razoavelmente único e curto, caso contrário, crie um ID baseado no label (ex: "Pessoa_Joao_Silva").
        *   Atribua um 'label' que é o valor textual da entidade.
        *   Classifique com um 'type' o mais específico possível, usando os tipos PRIMÁRIOS listados abaixo e refinando quando possível. Priorize a especificidade conforme o 'analysisContext'.
            *   **Pessoa:** (Ex: João Silva). Propriedades: "{\"CPF\": \"XXX.XXX.XXX-XX\", \"RG\": \"XX.XXX.XXX-X\", \"Nascimento_texto\": \"DD/MM/AAAA\"}".
            *   **Organização:** (Ex: Empresa XYZ Ltda, Polícia Civil). Propriedades: "{\"CNPJ\": \"XX.XXX.XXX/XXXX-XX\", \"Tipo\": \"ONG\"}".
            *   **Localização:** (Ex: Rua Principal 123, Porto Alegre; Coordenada GEO: -30.03, -51.21). Propriedades: "{\"CEP\": \"XXXXX-XXX\", \"Cidade\": \"Nome Cidade\"}".
            *   **Telefone:** (Ex: (XX) XXXXX-XXXX). Propriedades: "{\"Operadora\": \"Vivo\", \"TipoLinha\": \"Celular\", \"IMEI_associado\": \"XXXXXXXXXXXXXXX\"}".
            *   **Email:** (Ex: usuario@dominio.com).
            *   **Endereço IP:** (Ex: 192.168.1.1). Propriedades: "{\"Provedor\": \"Nome Provedor\", \"GeolocalizacaoIP_texto\": \"Cidade, País\"}".
            *   **Veículo:** (Ex: Placa XXX-0000). Propriedades: "{\"Marca\": \"Ford\", \"Modelo\": \"Fiesta\", \"Cor\": \"Preto\", \"Chassi\": \"YYYYYYYYY\"}".
            *   **Evento/Incidente:** (Ex: Assalto Banco X em DD/MM/AA). Propriedades: "{\"DataHora_texto\": \"DD/MM/AAAA HH:MM\", \"TipoCrime\": \"Roubo\", \"Local\": \"Rua Tal\"}". *PODE SER CRIADO PELA IA para conectar outras entidades.*
            *   **Transação Financeira:** (Ex: PIX R$1000 ContaA para ContaB). Propriedades: "{\"Valor_texto\": \"R$1000,00\", \"DataHora_texto\": \"DD/MM/AAAA HH:MM\", \"Tipo\": \"PIX\", \"Origem\": \"Conta X\", \"Destino\": \"Conta Y\"}". *PODE SER CRIADO PELA IA.*
            *   **Documento (Referência):** (Ex: Contrato Nº ZZZ). Propriedades: "{\"TipoDocumento\": \"Contrato\", \"Data_texto\": \"DD/MM/AAAA\"}".
            *   **Website/URL:** (Ex: https://www.exemplo.com).
            *   **Chave PIX:** (Ex: CPF, CNPJ, Email, Telefone, Aleatória associada a Pessoa/Organização). SEPARAR Chave PIX como entidade e relacionar à Pessoa/Organização dona.
            *   **IMEI:** (Ex: 35XXXXXXXXXXXXX). Relacionar a entidades Telefone, se possível.
            *   **ERB (Estação Rádio Base):** (Ex: ERB-12345). Propriedades: "{\"LocalizacaoERB_texto\": \"Endereço ou Coordenada\"}".
            *   **Conta Bancária:** (Ex: Ag:0001 C:12345-6). Propriedades: "{\"Banco\": \"Nome Banco\", \"TitularID\": \"ID da Pessoa/Organização\"}".
            *   **Arma de Fogo:** (Ex: Pistola Taurus G2C). Propriedades: "{\"NumeroSerie\": \"XXXXX\", \"Calibre_texto\": \".40\"}".
            *   **Outros:** Para entidades que não se encaixam acima, seja específico.
    *   Se uma entidade bruta parecer ser uma linha de dados tabulares (ex: "João Silva,(XX)XXXXX-XXXX,XXX.XXX.XXX-XX"), decomponha-a em múltiplas entidades (Pessoa, Telefone, CPF) e INFERA relacionamentos entre elas (ex: João Silva "possui" Telefone, João Silva "possui" CPF).
    *   Para o campo 'properties', SE HOUVER propriedades, elas DEVEM ser uma STRING JSON válida (ex: "{\"CPF\": \"123.456.789-00\"}"). Se NÃO HOUVER, omita o campo 'properties' ou envie uma string JSON vazia como "{}".

2.  **Inferência e Descrição de Relacionamentos (Campo: relationships):**
    *   Identifique relacionamentos DIRETOS e INDIRETOS (através de entidades intermediárias como Eventos ou Transações) entre as 'identifiedEntities'.
    *   Para CADA relacionamento:
        *   'source' e 'target': IDs das entidades de origem/destino (DEVEM existir em 'identifiedEntities').
        *   'label': Descrição textual concisa (Ex: "Comunicou com", "Transferiu R$X para", "Reside em", "Proprietário de", "Utilizou ERB").
        *   'type': (Opcional) Categorize (Ex: Comunicação, Financeiro, Familiar, Profissional, Propriedade, Localização, Técnico, Participação em Evento, Social).
        *   'direction': (Opcional) "direcional", "bidirecional", ou "nao_direcional".
        *   'strength': (Opcional) Confiança (0.0 a 1.0).
        *   'properties': (Opcional) STRING JSON com detalhes (Ex: "{\"data_hora_inicio\": \"DD/MM/AAAA HH:MM\", \"duracao_segundos_texto\": \"120\"}"). Se NÃO HOUVER, omita ou envie "{}".
    *   Se as 'Entidades Brutas' vierem de uma tabela, entidades da mesma linha provavelmente estão relacionadas (ex: Pessoa "possui" Telefone da mesma linha).

3.  **Criação de Entidades Implícitas:** Se, por exemplo, Pessoa A e Pessoa B são mencionadas em conexão com um "assalto dia X", crie uma entidade 'Evento/Incidente' "Assalto Dia X" e relacione Pessoa A e Pessoa B a este evento. Propriedades do evento também como STRING JSON.

4.  **Resumo da Análise (Campo: analysisSummary):**
    *   Forneça um resumo textual conciso (2-4 parágrafos) da análise de vínculos.
    *   Destaque: entidades centrais (com muitas conexões), principais grupos/clusters, tipos de relacionamentos mais comuns, e quaisquer padrões ou anomalias observadas.
    *   Se a análise foi desafiadora devido à natureza dos dados, mencione brevemente.
    *   O tom deve ser objetivo e investigativo.

Se a lista de 'Entidades Brutas' for pequena ou genérica, faça o melhor possível. Se for impossível, indique no 'analysisSummary'.
Foco na QUALIDADE e ESPECIFICIDADE dos tipos de entidade e na CLAREZA das descrições dos relacionamentos. Certifique-se de que TODOS os IDs em 'relationships' correspondam a IDs em 'identifiedEntities'.
`,
});

const findEntityRelationshipsFlow = ai.defineFlow(
  {
    name: 'findEntityRelationshipsFlow',
    inputSchema: FindEntityRelationshipsInputSchema,
    outputSchema: FindEntityRelationshipsOutputSchema, // Final output uses parsed objects
  },
  async (input: FindEntityRelationshipsInput): Promise<FindEntityRelationshipsOutput> => {
    
    const MAX_ENTITIES_TO_PROCESS = 150; // Increased limit slightly
    let processedEntitiesInput = input.entities;
    let analysisSummaryPrefix = "";

    if (input.entities.length > MAX_ENTITIES_TO_PROCESS) {
      processedEntitiesInput = input.entities.slice(0, MAX_ENTITIES_TO_PROCESS);
      analysisSummaryPrefix = `AVISO: A lista de entidades fornecida (${input.entities.length}) excedeu o limite de ${MAX_ENTITIES_TO_PROCESS}. A análise foi realizada nos primeiros ${MAX_ENTITIES_TO_PROCESS} itens. `;
    }
    
    const promptInput = {
      ...input,
      entities: processedEntitiesInput
    };

    const {output: rawOutput} = await prompt(promptInput);
    if (!rawOutput) {
      return {
        identifiedEntities: [],
        relationships: [],
        analysisSummary: analysisSummaryPrefix + "A IA não retornou um resultado válido para a análise de vínculos."
      };
    }
    
    const entityIdMap = new Map<string, number>();
    const originalIdToNewLabelIdMap = new Map<string, string>();

    const parsedIdentifiedEntities: FindEntityRelationshipsOutput['identifiedEntities'] = rawOutput.identifiedEntities.map(entity => {
      // Sanitize label to form a base for newId, ensuring it's more ReactFlow friendly
      let baseId = entity.label.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.$/, '').substring(0, 50);
      if (baseId.length === 0) baseId = `entidade_${crypto.randomUUID().substring(0,8)}`;

      let newLabelId = baseId;
      let count = entityIdMap.get(baseId) || 0;
      if (count > 0) {
        newLabelId = `${baseId}_${count}`;
      }
      entityIdMap.set(baseId, count + 1);

      originalIdToNewLabelIdMap.set(entity.id, newLabelId); // Map AI's original ID to new graph ID

      let parsedProperties: Record<string, string> = {};
      if (typeof entity.properties === 'string' && entity.properties.trim() !== "" && entity.properties.trim() !== "{}") {
        try {
          const parsed = JSON.parse(entity.properties);
          if (typeof parsed === 'object' && parsed !== null) {
            for (const key in parsed) {
              if (Object.prototype.hasOwnProperty.call(parsed, key)) {
                parsedProperties[key] = String(parsed[key]); // Ensure all property values are strings
              }
            }
          } else {
             console.warn(`Campo de propriedades para entidade ${entity.label} era uma string JSON, mas não um objeto: ${entity.properties}`);
          }
        } catch (e) {
          console.warn(`Falha ao parsear propriedades JSON para entidade ${entity.label}: ${entity.properties}`, e);
        }
      }
      return { ...entity, id: newLabelId, properties: parsedProperties }; // Use newLabelId as the graph node ID
    });
    
    const parsedRelationships: FindEntityRelationshipsOutput['relationships'] = rawOutput.relationships.map(rel => {
        const newSourceId = originalIdToNewLabelIdMap.get(rel.source);
        const newTargetId = originalIdToNewLabelIdMap.get(rel.target);
        
        let parsedRelProperties: Record<string, string> = {};
         if (typeof rel.properties === 'string' && rel.properties.trim() !== "" && rel.properties.trim() !== "{}") {
            try {
                const parsed = JSON.parse(rel.properties);
                if (typeof parsed === 'object' && parsed !== null) {
                    for (const key in parsed) {
                        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
                           parsedRelProperties[key] = String(parsed[key]);
                        }
                    }
                } else {
                    console.warn(`Campo de propriedades para relacionamento ${rel.label} era uma string JSON, mas não um objeto: ${rel.properties}`);
                }
            } catch (e) {
                console.warn(`Falha ao parsear propriedades JSON para relacionamento ${rel.label}: ${rel.properties}`, e);
            }
        }
        
        // Return the relationship only if both source and target IDs were successfully mapped
        if (newSourceId && newTargetId) {
          return {
              ...rel,
              source: newSourceId,
              target: newTargetId,
              properties: parsedRelProperties,
          };
        }
        return null; // Mark for filtering
    }).filter(rel => {
        if (!rel) return false; // Filter out nulls from failed ID mapping
        const sourceNodeExists = parsedIdentifiedEntities.some(node => node.id === rel.source);
        const targetNodeExists = parsedIdentifiedEntities.some(node => node.id === rel.target);
        if (!sourceNodeExists) console.warn(`Filtrando aresta devido a nó de origem (${rel.source}) ausente para o relacionamento: ${rel.label}`);
        if (!targetNodeExists) console.warn(`Filtrando aresta devido a nó de destino (${rel.target}) ausente para o relacionamento: ${rel.label}`);
        return rel.source && rel.target && sourceNodeExists && targetNodeExists;
    }) as FindEntityRelationshipsOutput['relationships']; // Cast back after filtering nulls


    return {
      identifiedEntities: parsedIdentifiedEntities,
      relationships: parsedRelationships,
      analysisSummary: analysisSummaryPrefix + (rawOutput.analysisSummary || "Análise concluída. Nenhum resumo adicional fornecido pela IA.")
    };
  }
);
