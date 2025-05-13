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
  id: z.string().describe('Identificador único para a entidade no grafo, preferencialmente o próprio label da entidade se for único, ou uma forma sanitizada dele. ESTE ID DEVE SER USADO AO REFERENCIAR ESTA ENTIDADE EM RELACIONAMENTOS.'),
  label: z.string().describe('O valor ou nome da entidade.'),
  type: z.string().describe('O tipo inferido da entidade (ex: Pessoa, Organização, Localização, Telefone, Email, IP, Veículo, Evento, Transação Financeira, Documento, Website, Chave PIX, IMEI, ERB, Conta Bancária, Arma de Fogo, Outros).'),
  properties: z.string().optional().default("{}").describe('Uma STRING JSON VÁLIDA representando propriedades adicionais da entidade (ex: para Pessoa "{\"CPF\": \"XXX.XXX.XXX-XX\", \"RG\": \"12.345.678-9\"}"). Os valores dentro do JSON devem ser strings. Se não houver propriedades, envie uma string JSON vazia como "{}" ou omita o campo.')
});

const RelationshipSchema = z.object({
  source: z.string().describe('O ID da entidade de origem do relacionamento (deve corresponder a um ID de `identifiedEntities`).'),
  target: z.string().describe('O ID da entidade de destino do relacionamento (deve corresponder a um ID de `identifiedEntities`).'),
  label: z.string().describe('Uma descrição concisa do relacionamento (ex: "Comunicou com", "Transferiu para", "Associado a", "Proprietário de", "Localizado em", "Ocorreu em", "Membro de").'),
  type: z.string().optional().describe('Um tipo categorizado de relacionamento (ex: Comunicação, Financeiro, Familiar, Profissional, Geográfico, Técnico, Posse, Social).'),
  direction: z.enum(["direcional", "bidirecional", "nao_direcional"]).optional().default("nao_direcional").describe("A direcionalidade do relacionamento. 'direcional' de source para target, 'bidirecional' para ambos, 'nao_direcional' para associação sem direção clara."),
  strength: z.number().min(0).max(1).optional().describe('Força estimada ou confiança do relacionamento (0 a 1), se aplicável.'),
  properties: z.string().optional().default("{}").describe('Uma STRING JSON VÁLIDA representando propriedades adicionais do relacionamento (ex: "{\"data_hora\": \"DD/MM/AAAA HH:MM\", \"valor_texto\": \"R$ XXX,XX\", \"frequencia_texto\": \"3 vezes\"}"). Os valores dentro do JSON devem ser strings. Se não houver, envie "{}" ou omita o campo.')
});

const FindEntityRelationshipsInputSchema = z.object({
  entities: z
    .array(z.string())
    .min(1, "Pelo menos uma entidade deve ser fornecida.")
    .describe('Uma lista de textos ou valores brutos representando entidades a serem analisadas. A IA deve processar esta lista para identificar, classificar e encontrar relações. Se a lista parecer vir de uma tabela (várias strings curtas), considere que entidades na mesma "linha" conceitual podem estar relacionadas. Se uma das entidades for uma mensagem de sistema indicando falha na leitura de um arquivo, a IA deve usar essa informação para contextualizar a análise de metadados (nome/tipo do arquivo).'),
  analysisContext: z.enum(["Geral", "Telefonia", "Financeira", "Pessoas e Organizações", "Digital e Cibernética", "Investigação Criminal Genérica"])
    .optional()
    .default("Geral")
    .describe('Contexto da análise para guiar a IA no tipo de entidades e relacionamentos a priorizar. Por exemplo, em "Telefonia", foque em números, IMEIs, ERBs; em "Financeira", em transações, contas.'),
  fileOrigin: z.string().optional().describe("Nome do arquivo original de onde as entidades foram extraídas, se aplicável, para contexto adicional.")
});
export type FindEntityRelationshipsInput = z.infer<typeof FindEntityRelationshipsInputSchema>;

// Final schemas for output where properties are parsed JSON objects
const FinalEntitySchema = EntitySchema.omit({ properties: true }).extend({
    properties: z.record(z.string()).optional().default({})
});
const FinalRelationshipSchema = RelationshipSchema.omit({ properties: true }).extend({
    properties: z.record(z.string()).optional().default({})
});

const FindEntityRelationshipsOutputSchema = z.object({
  identifiedEntities: z.array(FinalEntitySchema).describe("Lista de todas as entidades únicas identificadas e classificadas pela IA a partir da entrada, com IDs únicos para ReactFlow."),
  relationships: z.array(FinalRelationshipSchema).describe('Uma lista de relacionamentos identificados entre as entidades, usando os IDs únicos de ReactFlow.'),
  analysisSummary: z.string().optional().describe("Um resumo textual conciso da análise de vínculos realizada pela IA, destacando os achados mais importantes, padrões observados, entidades centrais, ou dificuldades encontradas (como impossibilidade de ler conteúdo de arquivo). Deve ser redigido em linguagem clara e investigativa.")
});
export type FindEntityRelationshipsOutput = z.infer<typeof FindEntityRelationshipsOutputSchema>;

// Schema for the prompt's direct output (with JSON strings for properties)
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

**Entidades Brutas Fornecidas para Análise (podem ser texto extraído de um arquivo, incluindo linhas de tabela, ou metadados de arquivo):**
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
    *   **Importante:** Se uma das 'Entidades Brutas' for claramente uma mensagem do sistema indicando impossibilidade de leitura de conteúdo de arquivo (ex: "Impossibilidade de análise direta...", "AVISO DO SISTEMA: O arquivo..."), NÃO crie uma entidade para essa mensagem no grafo. Em vez disso, use essa informação para detalhar o 'analysisSummary', explicando que a análise de vínculos para o arquivo {{{fileOrigin}}} (se aplicável) foi limitada a metadados (nome, tipo de arquivo) pois seu conteúdo não pôde ser processado. As outras 'Entidades Brutas' (como nome do arquivo, tipo MIME, ou texto extraído de outras fontes) devem ser processadas normalmente para identificação.
    *   Para CADA entidade identificada (que NÃO seja uma mensagem de sistema):
        *   Atribua um 'id' único. Este ID DEVE ser usado consistentemente ao referenciar esta entidade nos relacionamentos. Pode ser baseado no label se curto e único, ou um ID mais sistemático (ex: "Entidade_1", "Pessoa_Joao_Silva"). Certifique-se que o ID seja uma string simples sem espaços ou caracteres especiais problemáticos.
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
            *   **Transação Financeira:** (Ex: PIX R$1000 ContaA para ContaB). Propriedades: "{\"Valor_texto\": \"R$1000,00\", \"DataHora_texto\": \"DD/MM/AAAA HH:MM\", \"Tipo\": \"PIX\", \"OrigemID\": \"ID_Conta_Origem\", \"DestinoID\": \"ID_Conta_Destino\"}". *PODE SER CRIADO PELA IA.*
            *   **Documento (Referência):** (Ex: Contrato Nº ZZZ, Arquivo '{{{fileOrigin}}}'). Se a entidade for o próprio arquivo de origem, use o nome do arquivo como label. Propriedades: "{\"TipoDocumento\": \"Contrato\", \"Data_texto\": \"DD/MM/AAAA\", \"NomeOriginal\": \"{{{fileOrigin}}}\", \"TipoMIME\": \"application/pdf\"}".
            *   **Website/URL:** (Ex: https://www.exemplo.com).
            *   **Chave PIX:** (Ex: CPF, CNPJ, Email, Telefone, Aleatória). Relacionar à Pessoa/Organização dona se identificável. Propriedades: "{\"TipoChave\": \"CPF\", \"AssociadaA_ID\": \"ID_Pessoa_Joao_Silva\"}".
            *   **IMEI:** (Ex: 35XXXXXXXXXXXXX). Relacionar a entidades Telefone, se possível.
            *   **ERB (Estação Rádio Base):** (Ex: ERB-12345). Propriedades: "{\"LocalizacaoERB_texto\": \"Endereço ou Coordenada\"}".
            *   **Conta Bancária:** (Ex: Ag:0001 C:12345-6). Propriedades: "{\"Banco\": \"Nome Banco\", \"TitularID\": \"ID da Pessoa/Organização\"}".
            *   **Arma de Fogo:** (Ex: Pistola Taurus G2C). Propriedades: "{\"NumeroSerie\": \"XXXXX\", \"Calibre_texto\": \".40\"}".
            *   **Tipo de Arquivo:** (Ex: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet). Se uma das entidades brutas for um tipo MIME, identifique-a como tal.
            *   **Outros:** Para entidades que não se encaixam acima, seja específico.
    *   Se uma entidade bruta parecer ser uma linha de dados tabulares (ex: "João Silva,(XX)XXXXX-XXXX,XXX.XXX.XXX-XX"), decomponha-a em múltiplas entidades (Pessoa, Telefone, CPF) e INFERA relacionamentos entre elas (ex: João Silva "possui" Telefone, João Silva "possui" CPF).
    *   Para o campo 'properties' de entidades e relacionamentos, SEMPRE forneça uma STRING JSON VÁLIDA (ex: "{\"CPF\": \"123.456.789-00\"}"). Se NÃO HOUVER propriedades, envie uma string JSON vazia como "{}" ou omita o campo (o schema de output tem default "{}" para isso).

2.  **Inferência e Descrição de Relacionamentos (Campo: relationships):**
    *   Identifique relacionamentos DIRETOS e INDIRETOS (através de entidades intermediárias como Eventos ou Transações) entre as 'identifiedEntities'.
    *   Para CADA relacionamento:
        *   'source' e 'target': Use os IDs EXATOS das entidades de origem/destino definidos em 'identifiedEntities'.
        *   'label': Descrição textual concisa (Ex: "Comunicou com", "Transferiu R$X para", "Reside em", "Proprietário de", "Utilizou ERB", "É do tipo").
        *   'type': (Opcional) Categorize (Ex: Comunicação, Financeiro, Familiar, Profissional, Propriedade, Localização, Técnico, Participação em Evento, Social, Metadado).
        *   'direction': (Opcional) "direcional", "bidirecional", ou "nao_direcional".
        *   'strength': (Opcional) Confiança (0.0 a 1.0).
        *   'properties': (Opcional) STRING JSON VÁLIDA com detalhes (Ex: "{\"data_hora_inicio\": \"DD/MM/AAAA HH:MM\", \"duracao_segundos_texto\": \"120\"}"). Se NÃO HOUVER, omita ou envie "{}".

3.  **Criação de Entidades Implícitas:** Se, por exemplo, Pessoa A e Pessoa B são mencionadas em conexão com um "assalto dia X", crie uma entidade 'Evento/Incidente' "Assalto Dia X" (com seu próprio ID único), e relacione Pessoa A (usando seu ID) e Pessoa B (usando seu ID) a este evento.

4.  **Resumo da Análise (Campo: analysisSummary):**
    *   Forneça um resumo textual conciso (2-4 parágrafos) da análise de vínculos.
    *   Destaque: entidades centrais (com muitas conexões), principais grupos/clusters, tipos de relacionamentos mais comuns, e quaisquer padrões ou anomalias observadas.
    *   Se a análise foi desafiadora devido à natureza dos dados (ex: conteúdo de arquivo não processável, dados esparsos), mencione brevemente essas limitações e como a análise se baseou em metadados ou inferências.
    *   O tom deve ser objetivo e investigativo.

Se a lista de 'Entidades Brutas' for pequena ou genérica, faça o melhor possível. Se for impossível, indique no 'analysisSummary'.
Foco na QUALIDADE e ESPECIFICIDADE dos tipos de entidade e na CLAREZA das descrições dos relacionamentos. 
IMPERATIVO: Certifique-se de que TODOS os IDs usados nos campos 'source' e 'target' dos relacionamentos CORRESPONDAM EXATAMENTE a IDs definidos na lista 'identifiedEntities'.
`,
});

let entityFlowCounter = 0; // Counter for unique fallback entity IDs

const findEntityRelationshipsFlow = ai.defineFlow(
  {
    name: 'findEntityRelationshipsFlow',
    inputSchema: FindEntityRelationshipsInputSchema,
    outputSchema: FindEntityRelationshipsOutputSchema, 
  },
  async (input: FindEntityRelationshipsInput): Promise<FindEntityRelationshipsOutput> => {
    entityFlowCounter = 0; // Reset counter for each flow run
    
    const MAX_ENTITIES_TO_PROCESS = 150;
    let processedEntitiesInput = input.entities;
    let analysisSummaryPrefix = "";

    if (input.entities.length > MAX_ENTITIES_TO_PROCESS) {
      processedEntitiesInput = input.entities.slice(0, MAX_ENTITIES_TO_PROCESS);
      analysisSummaryPrefix = `AVISO: A lista de entidades fornecida (${input.entities.length}) excedeu o limite de ${MAX_ENTITIES_TO_PROCESS}. A análise foi realizada nos primeiros ${MAX_ENTITIES_TO_PROCESS} itens. `;
      console.log(`Análise de vínculos: Entrada truncada para ${MAX_ENTITIES_TO_PROCESS} entidades.`);
    }
    
    const promptInput = {
      ...input,
      entities: processedEntitiesInput
    };

    const {output: rawOutput} = await prompt(promptInput); // rawOutput contains properties as JSON strings
    if (!rawOutput) {
      console.error("Análise de vínculos: A IA não retornou um resultado válido.");
      return {
        identifiedEntities: [],
        relationships: [],
        analysisSummary: analysisSummaryPrefix + "A IA não retornou um resultado válido para a análise de vínculos."
      };
    }
    
    console.log("Análise de vínculos: Saída bruta da IA recebida:", JSON.stringify(rawOutput, null, 2));

    const aiEntityIdToReactFlowIdMap = new Map<string, string>();
    const reactFlowIdUsageMap = new Map<string, number>(); 

    const parsedIdentifiedEntities: FindEntityRelationshipsOutput['identifiedEntities'] = rawOutput.identifiedEntities
      .filter(entity => !(entity.label.startsWith("AVISO DO SISTEMA:") || entity.label.startsWith("Impossibilidade de análise"))) // Filter out system messages
      .map((entity, idx) => {
        let baseReactFlowId = entity.label.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.$/, '').substring(0, 50).trim();
        if (baseReactFlowId.length === 0 || /^\W+$/.test(baseReactFlowId)) { 
            baseReactFlowId = `entidade_gerada_${entityFlowCounter++}`;
        }

        let finalReactFlowId = baseReactFlowId;
        let count = reactFlowIdUsageMap.get(baseReactFlowId) || 0;
        if (count > 0) {
          finalReactFlowId = `${baseReactFlowId}_${count}`;
        }
        reactFlowIdUsageMap.set(baseReactFlowId, count + 1);
      
        if (entity.id) { 
            aiEntityIdToReactFlowIdMap.set(entity.id, finalReactFlowId);
        } else {
            // Fallback if AI didn't provide an ID, though it should
            const fallbackId = `ai_ent_${idx}_${finalReactFlowId}`;
            aiEntityIdToReactFlowIdMap.set(fallbackId, finalReactFlowId); 
            entity.id = fallbackId; // Assign a temporary AI-side ID for mapping
            console.warn(`Análise de vínculos: Entidade da IA sem ID original! Label: ${entity.label}, Index: ${idx}. Usando ID de fallback: ${fallbackId}. O prompt da IA DEVE fornecer um 'id' para cada 'identifiedEntities'.`);
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
               console.warn(`Análise de vínculos: Propriedades da entidade '${entity.label}' (ID IA: ${entity.id}) não é um objeto JSON válido: ${entity.properties}`);
            }
          } catch (e) {
            console.warn(`Análise de vínculos: Falha ao parsear JSON das propriedades para entidade '${entity.label}' (ID IA: ${entity.id}): ${entity.properties}`, e);
            // Attempt to keep the original string if parsing fails but it's not just "{}"
            if (entity.properties.trim() !== "{}") {
                parsedProperties["raw_properties"] = entity.properties;
            }
          }
        }
        return { ...entity, id: finalReactFlowId, properties: parsedProperties }; 
    });
    
    console.log("Análise de vínculos: Entidades parseadas para ReactFlow (mostrando id e label):", JSON.stringify(parsedIdentifiedEntities.map(e => ({id: e.id, label: e.label})), null, 2));
    console.log("Análise de vínculos: Mapa de IDs (ID IA -> ID ReactFlow):", JSON.stringify(Array.from(aiEntityIdToReactFlowIdMap.entries()), null, 2));

    const parsedRelationships: FindEntityRelationshipsOutput['relationships'] = rawOutput.relationships.map(rel => {
        const reactFlowSourceId = aiEntityIdToReactFlowIdMap.get(rel.source);
        const reactFlowTargetId = aiEntityIdToReactFlowIdMap.get(rel.target);
        
        if (!reactFlowSourceId) {
            console.warn(`Análise de vínculos: ID de origem do relacionamento IA ('${rel.source}') não encontrado no mapa de IDs para o relacionamento: '${rel.label}'. Relacionamento ignorado. Verifique se a IA forneceu um 'id' para a entidade de origem e usou esse mesmo 'id' no relacionamento.`);
            return null;
        }
        if (!reactFlowTargetId) {
            console.warn(`Análise de vínculos: ID de destino do relacionamento IA ('${rel.target}') não encontrado no mapa de IDs para o relacionamento: '${rel.label}'. Relacionamento ignorado. Verifique se a IA forneceu um 'id' para a entidade de destino e usou esse mesmo 'id' no relacionamento.`);
            return null;
        }
        
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
                     console.warn(`Análise de vínculos: Propriedades do relacionamento '${rel.label}' não é um objeto JSON válido: ${rel.properties}`);
                }
            } catch (e) {
                console.warn(`Análise de vínculos: Falha ao parsear JSON das propriedades para relacionamento '${rel.label}': ${rel.properties}`, e);
                 if (rel.properties.trim() !== "{}") {
                    parsedRelProperties["raw_properties"] = rel.properties;
                }
            }
        }
        
        return {
            source: reactFlowSourceId,
            target: reactFlowTargetId,
            label: rel.label,
            type: rel.type,
            direction: rel.direction,
            strength: rel.strength,
            properties: parsedRelProperties,
        };
    }).filter(rel => rel !== null) 
      .filter(rel => { 
        const sourceNodeExists = parsedIdentifiedEntities.some(node => node.id === rel!.source);
        const targetNodeExists = parsedIdentifiedEntities.some(node => node.id === rel!.target);
        
        if (!sourceNodeExists) {
            console.warn(`Análise de vínculos: Filtrando aresta (APÓS MAPEAMENTO) devido a nó de origem ('${rel!.source}') ausente para o relacionamento: '${rel!.label}'. Verifique se a entidade de origem foi corretamente identificada e mapeada.`);
        }
        if (!targetNodeExists) {
            console.warn(`Análise de vínculos: Filtrando aresta (APÓS MAPEAMENTO) devido a nó de destino ('${rel!.target}') ausente para o relacionamento: '${rel!.label}'. Verifique se a entidade de destino foi corretamente identificada e mapeada.`);
        }
        return sourceNodeExists && targetNodeExists;
    }) as FindEntityRelationshipsOutput['relationships']; 

    console.log("Análise de vínculos: Relacionamentos parseados para ReactFlow (mostrando source, target, label):", JSON.stringify(parsedRelationships.map(r => ({source: r.source, target: r.target, label: r.label})), null, 2));

    const finalSummary = analysisSummaryPrefix + (rawOutput.analysisSummary || "Análise de vínculos concluída. Nenhum resumo adicional fornecido pela IA.");
    console.log("Análise de vínculos: Resumo final:", finalSummary);
    
    if (parsedIdentifiedEntities.length > 0 && parsedRelationships.length === 0 && rawOutput.relationships.length > 0) {
        console.warn("Análise de vínculos: A IA retornou relacionamentos, mas nenhum pôde ser mapeado ou validado. Verifique os logs de 'ID de origem/destino... não encontrado' ou 'Filtrando aresta APÓS MAPEAMENTO'.");
    }

    console.log("Análise de Vínculos: Final output from flow - Identified Entities (showing id and label):", JSON.stringify(parsedIdentifiedEntities.map(e => ({id: e.id, label: e.label})), null, 2));
    console.log("Análise de Vínculos: Final output from flow - Parsed Relationships (showing source, target, label):", JSON.stringify(parsedRelationships.map(r => ({source: r.source, target: r.target, label: r.label})), null, 2));

    return {
      identifiedEntities: parsedIdentifiedEntities,
      relationships: parsedRelationships,
      analysisSummary: finalSummary
    };
  }
);

