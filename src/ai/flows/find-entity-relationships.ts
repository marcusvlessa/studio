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
  id: z.string().describe('Identificador único para a entidade no grafo.'),
  label: z.string().describe('O valor ou nome da entidade.'),
  type: z.string().describe('O tipo inferido da entidade (ex: Pessoa, Organização, Localização, Telefone, Email, IP, Veículo, Evento, Transação Financeira, Documento, Website, Chave PIX, IMEI, ERB, Conta Bancária).'),
  properties: z.string().optional().describe('Uma STRING JSON representando propriedades adicionais da entidade (ex: para Pessoa "{\"CPF\": \"XXX.XXX.XXX-XX\", \"RG\": \"12.345.678-9\"}"). Os valores dentro do JSON devem ser strings.')
});

const RelationshipSchema = z.object({
  source: z.string().describe('O ID da entidade de origem do relacionamento.'),
  target: z.string().describe('O ID da entidade de destino do relacionamento.'),
  label: z.string().describe('Uma descrição concisa do relacionamento (ex: "Comunicou com", "Transferiu para", "Associado a", "Proprietário de", "Localizado em", "Ocorreu em").'),
  type: z.string().optional().describe('Um tipo categorizado de relacionamento (ex: Comunicação, Financeiro, Familiar, Profissional, Geográfico, Técnico).'),
  direction: z.enum(["direcional", "bidirecional", "nao_direcional"]).optional().describe("A direcionalidade do relacionamento. 'direcional' de source para target, 'bidirecional' para ambos, 'nao_direcional' para associação sem direção clara."),
  strength: z.number().min(0).max(1).optional().describe('Força estimada ou confiança do relacionamento (0 a 1), se aplicável.'),
  properties: z.string().optional().describe('Uma STRING JSON representando propriedades adicionais do relacionamento (ex: "{\"data_hora\": \"DD/MM/AAAA HH:MM\", \"valor_texto\": \"R$ XXX,XX\"}"). Os valores dentro do JSON devem ser strings.')
});

const FindEntityRelationshipsInputSchema = z.object({
  entities: z
    .array(z.string())
    .min(1, "Pelo menos uma entidade deve ser fornecida.")
    .describe('Uma lista de textos ou valores brutos representando entidades a serem analisadas. A IA deve processar esta lista para identificar, classificar e encontrar relações.'),
  analysisContext: z.enum(["Geral", "Telefonia", "Financeira", "Pessoas e Organizações", "Digital e Cibernética", "Investigação Criminal Genérica"])
    .optional()
    .default("Geral")
    .describe('Contexto da análise para guiar a IA no tipo de entidades e relacionamentos a priorizar. Por exemplo, em "Telefonia", foque em números, IMEIs, ERBs; em "Financeira", em transações, contas.'),
  fileOrigin: z.string().optional().describe("Nome do arquivo original de onde as entidades foram extraídas, se aplicável, para contexto adicional.")
});
export type FindEntityRelationshipsInput = z.infer<typeof FindEntityRelationshipsInputSchema>;


const FindEntityRelationshipsOutputSchema = z.object({
  identifiedEntities: z.array(EntitySchema.extend({
    // Override properties for output to be a parsed object, not a JSON string
    properties: z.record(z.string()).optional()
  })).describe("Lista de todas as entidades únicas identificadas e classificadas pela IA a partir da entrada."),
  relationships: z.array(RelationshipSchema.extend({
    // Override properties for output to be a parsed object, not a JSON string
    properties: z.record(z.string()).optional()
  })).describe('Uma lista de relacionamentos identificados entre as entidades.'),
  analysisSummary: z.string().optional().describe("Um breve resumo da análise de vínculos realizada pela IA, destacando os achados mais importantes ou dificuldades.")
});
export type FindEntityRelationshipsOutput = z.infer<typeof FindEntityRelationshipsOutputSchema>;

// Define schemas for the prompt's expected output (with JSON strings for properties)
const PromptEntitySchema = EntitySchema; // Uses string for properties
const PromptRelationshipSchema = RelationshipSchema; // Uses string for properties

const PromptOutputSchema = z.object({
    identifiedEntities: z.array(PromptEntitySchema).describe("Lista de todas as entidades únicas identificadas e classificadas pela IA a partir da entrada."),
    relationships: z.array(PromptRelationshipSchema).describe('Uma lista de relacionamentos identificados entre as entidades.'),
    analysisSummary: z.string().optional().describe("Um breve resumo da análise de vínculos realizada pela IA, destacando os achados mais importantes ou dificuldades.")
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
  output: {schema: PromptOutputSchema}, // Use the schema with string properties for AI output
  prompt: `Você é um especialista em análise de inteligência e construção de grafos de vínculos, modelado a partir das capacidades do IBM i2 Analyst's Notebook. Sua tarefa é analisar uma lista de entidades de entrada, identificar entidades distintas, classificá-las e, o mais importante, inferir e descrever os relacionamentos entre elas, incluindo a criação de novas entidades implícitas se necessário (como eventos ou transações que conectam outras entidades).

**Contexto da Análise:** {{{analysisContext}}}
{{#if fileOrigin}}Arquivo de Origem dos Dados: {{{fileOrigin}}}{{#endif}}

**Entidades Brutas Fornecidas para Análise (pré-processadas ou extraídas de um arquivo):**
{{#if entities.length}}
  {{#each entities}}
    - {{{this}}}
  {{/each}}
{{else}}
  - Nenhuma entidade bruta fornecida (analise o contexto, se houver).
{{/if}}

**Instruções Detalhadas:**

1.  **Identificação e Classificação de Entidades (Campo: identifiedEntities):**
    *   Processe a lista de 'Entidades Brutas'. Identifique entidades únicas e significativas.
    *   Para CADA entidade identificada, atribua um 'id' único (sugestão: use o próprio valor da entidade se for único e adequado como ID, ou um prefixo_valor).
    *   Classifique CADA entidade com um 'type' o mais específico possível. Use os seguintes tipos PRIMÁRIOS e refinar se possível:
        *   **Pessoa:** (Ex: João Silva, Maria Oliveira). Propriedades podem incluir CPF (como string JSON: "{\"CPF\": \"XXX.XXX.XXX-XX\", \"RG\": \"XX.XXX.XXX-X\"}").
        *   **Organização:** (Ex: Empresa XYZ Ltda, Polícia Civil). Propriedades podem incluir CNPJ (como string JSON: "{\"CNPJ\": \"XX.XXX.XXX/XXXX-XX\"}").
        *   **Localização:** (Ex: Rua Principal 123, Porto Alegre, RS; Coordenada -30.0346° S, -51.2177° W).
        *   **Telefone:** (Ex: (XX) XXXXX-XXXX, +55 XX XXXXX-XXXX). Propriedades podem incluir operadora (string JSON: "{\"operadora\": \"Vivo\"}"), tipo (string JSON: "{\"tipo\": \"celular\"}").
        *   **Email:** (Ex: usuario@dominio.com).
        *   **Endereço IP:** (Ex: 192.168.1.1). Propriedades podem incluir geolocalização IP (string JSON: "{\"geolocalizacao_ip\": \"Brasil\"}").
        *   **Veículo:** (Ex: Placa XXX-0000, Chassi YYYYYYY). Propriedades podem incluir marca, modelo, cor (string JSON: "{\"marca\": \"Ford\", \"modelo\": \"Fiesta\", \"cor\": \"Preto\"}").
        *   **Evento/Incidente:** (Ex: Roubo a Banco na Data X, Homicídio Local Y). Propriedades podem incluir data/hora, tipo de crime (string JSON: "{\"data_hora\": \"10/10/2023 14:30\", \"tipo_crime\": \"Roubo\"}"). ESTA ENTIDADE PODE SER CRIADA PELA IA para conectar outras entidades.
        *   **Transação Financeira:** (Ex: Transferência R$1000 de Conta A para Conta B). Propriedades podem incluir valor_texto, data/hora, tipo, contas (string JSON: "{\"valor_texto\": \"R$1000,00\", \"data_hora\": \"10/10/2023 15:00\", \"tipo\": \"PIX\"}"). ESTA ENTIDADE PODE SER CRIADA PELA IA.
        *   **Documento (Referência):** (Ex: Contrato Nº ZZZ, Relatório XXX). Propriedades podem incluir tipo de documento, data (string JSON: "{\"tipo_documento\": \"Contrato\", \"data\": \"01/01/2023\"}").
        *   **Website/URL:** (Ex: https://www.exemplo.com).
        *   **Chave PIX:** (Ex: CPF, CNPJ, Email, Telefone, Aleatória associada a uma Pessoa ou Organização).
        *   **IMEI:** (Ex: 35XXXXXXXXXXXXX).
        *   **ERB (Estação Rádio Base):** (Ex: ERB-12345). Propriedades podem incluir localização (string JSON: "{\"localizacao_erb\": \"Torre Celular Central\"}").
        *   **Conta Bancária:** (Ex: Agência 0001 Conta 12345-6). Propriedades podem incluir banco (string JSON: "{\"banco\": \"Banco do Brasil\"}").
        *   **Item/Objeto Físico:** (Ex: Arma de Fogo, Notebook Dell).
        *   **Outros:** Use se nenhuma das anteriores se aplicar, e especifique.
    *   Se uma entidade bruta puder ser decomposta em várias (ex: uma linha de CSV com nome, telefone e CPF), crie entidades separadas para cada um, se fizer sentido para a análise de vínculos.
    *   Para o campo 'properties' de cada entidade, se houver propriedades, elas DEVEM ser uma STRING JSON válida. Exemplo: "{\"CPF\": \"123.456.789-00\", \"RG\": \"1234567\"}". Se não houver propriedades, omita o campo 'properties' ou envie uma string JSON vazia "{}".

2.  **Inferência e Descrição de Relacionamentos (Campo: relationships):**
    *   Identifique relacionamentos diretos e INDIRETOS (se possível, através de entidades intermediárias como Eventos ou Transações) entre as 'identifiedEntities'.
    *   Para CADA relacionamento:
        *   'source': ID da entidade de origem.
        *   'target': ID da entidade de destino.
        *   'label': Descrição textual concisa do relacionamento. Ex: "Comunicou com", "Efetuou Pagamento para", "Reside em", "Registrado em nome de", "Utilizou ERB", "Associado a".
        *   'type': (Opcional) Categorize o relacionamento (ex: Comunicação, Financeiro, Familiar, Profissional, Propriedade, Localização, Técnico, Participação em Evento).
        *   'direction': (Opcional) "direcional" (ex: Pessoa -> Telefone "possui"), "bidirecional" (ex: Pessoa <-> Pessoa "comunicou com"), "nao_direcional" (ex: Pessoa - Evento "participou de").
        *   'strength': (Opcional) Estime a confiança da IA na existência desse vínculo (0.0 a 1.0).
        *   'properties': (Opcional) STRING JSON com detalhes adicionais. Ex: para "Comunicou com", "{\"data_hora_inicio\": \"DD/MM/AAAA HH:MM\", \"duracao_segundos_texto\": \"120\"}". Se não houver, omita ou envie "{}" como string JSON.

3.  **Considerações Específicas do Contexto ({{{analysisContext}}}):** (Mesmas instruções)

4.  **Criação de Entidades Implícitas:** (Mesmas instruções, mas lembre-se que as propriedades dessas novas entidades também devem ser strings JSON).

5.  **Análise de Vínculos i2 Style:** (Mesmas instruções, lembrando que as propriedades dos eventos devem ser strings JSON. Ex: "{\"data_encontro_texto\": \"10/10/2023\"}").

6.  **Output (Schema):** Popule rigorosamente os campos 'identifiedEntities' e 'relationships' conforme o schema, LEMBRANDO que o campo 'properties' DEVE SER UMA STRING JSON. Se um relacionamento não for claro, atribua uma 'strength' menor.

7.  **Resumo da Análise (analysisSummary):** Forneça um breve resumo textual dos principais achados, complexidades ou limitações da análise.

Se a lista de 'Entidades Brutas' for muito pequena ou os itens forem muito genéricos, faça o melhor possível para extrair significado e inferir relações, mesmo que com baixa confiança. Se for impossível, indique isso no 'analysisSummary'.
Foco na QUALIDADE e ESPECIFICIDADE dos tipos de entidade e na CLAREZA das descrições dos relacionamentos.
`,
});

const findEntityRelationshipsFlow = ai.defineFlow(
  {
    name: 'findEntityRelationshipsFlow',
    inputSchema: FindEntityRelationshipsInputSchema,
    outputSchema: FindEntityRelationshipsOutputSchema, // Final output uses parsed objects
  },
  async (input: FindEntityRelationshipsInput): Promise<FindEntityRelationshipsOutput> => {
    
    const MAX_ENTITIES_TO_PROCESS = 100; 
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

    const {output: rawOutput} = await prompt(promptInput); // rawOutput contains properties as JSON strings
    if (!rawOutput) {
      return {
        identifiedEntities: [],
        relationships: [],
        analysisSummary: analysisSummaryPrefix + "A IA não retornou um resultado válido para a análise de vínculos."
      };
    }
    
    const entityIdMap = new Map<string, number>();

    const parsedIdentifiedEntities: FindEntityRelationshipsOutput['identifiedEntities'] = rawOutput.identifiedEntities.map(entity => {
      let newId = entity.label.replace(/[^a-zA-Z0-9_.]/g, '_').substring(0, 50); // Sanitize and shorten
      if (entityIdMap.has(newId)) {
        let count = entityIdMap.get(newId)! + 1;
        entityIdMap.set(newId, count);
        newId = `${newId}_${count}`;
      } else {
        entityIdMap.set(newId, 1);
      }

      let parsedProperties: Record<string, string> = {};
      if (typeof entity.properties === 'string' && entity.properties.trim() !== "" && entity.properties.trim() !== "{}") {
        try {
          const parsed = JSON.parse(entity.properties);
          if (typeof parsed === 'object' && parsed !== null) {
            for (const key in parsed) {
              if (Object.prototype.hasOwnProperty.call(parsed, key)) {
                parsedProperties[key] = String(parsed[key]);
              }
            }
          } else {
             console.warn(`Properties field for entity ${entity.label} was a JSON string but not an object: ${entity.properties}`);
          }
        } catch (e) {
          console.warn(`Failed to parse JSON properties for entity ${entity.label}: ${entity.properties}`, e);
          // Store the original string if parsing fails, perhaps under a special key
          // parsedProperties['_raw_properties_parse_error'] = entity.properties;
        }
      }
      
      return { ...entity, id: newId, properties: parsedProperties };
    });

    const entityOriginalIdToNewIdMap = new Map(rawOutput.identifiedEntities.map((oe, index) => [oe.id, parsedIdentifiedEntities[index].id]));
    
    const parsedRelationships: FindEntityRelationshipsOutput['relationships'] = rawOutput.relationships.map(rel => {
        const newSourceId = entityOriginalIdToNewIdMap.get(rel.source) || rel.source; // Fallback if original ID not in map
        const newTargetId = entityOriginalIdToNewIdMap.get(rel.target) || rel.target; // Fallback
        
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
                    console.warn(`Properties field for relationship ${rel.label} was a JSON string but not an object: ${rel.properties}`);
                }
            } catch (e) {
                console.warn(`Failed to parse JSON properties for relationship ${rel.label}: ${rel.properties}`, e);
            }
        }

        return {
            ...rel,
            source: newSourceId,
            target: newTargetId,
            properties: parsedRelProperties,
        };
    }).filter(rel => { // Filter out edges with non-existent nodes AFTER ID mapping
      const sourceNodeExists = parsedIdentifiedEntities.some(node => node.id === rel.source);
      const targetNodeExists = parsedIdentifiedEntities.some(node => node.id === rel.target);
      if (!sourceNodeExists) console.warn(`Filtered out edge due to missing source node: ${rel.source}`);
      if (!targetNodeExists) console.warn(`Filtered out edge due to missing target node: ${rel.target}`);
      return rel.source && rel.target && sourceNodeExists && targetNodeExists;
    });


    return {
      identifiedEntities: parsedIdentifiedEntities,
      relationships: parsedRelationships,
      analysisSummary: analysisSummaryPrefix + (rawOutput.analysisSummary || "Análise concluída.")
    };
  }
);