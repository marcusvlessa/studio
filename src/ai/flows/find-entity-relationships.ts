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
  properties: z.record(z.string()).optional().describe('Propriedades adicionais da entidade COMO STRINGS (ex: para Pessoa { "CPF": "XXX.XXX.XXX-XX" }). Os valores das propriedades devem ser strings.')
});

const RelationshipSchema = z.object({
  source: z.string().describe('O ID da entidade de origem do relacionamento.'),
  target: z.string().describe('O ID da entidade de destino do relacionamento.'),
  label: z.string().describe('Uma descrição concisa do relacionamento (ex: "Comunicou com", "Transferiu para", "Associado a", "Proprietário de", "Localizado em", "Ocorreu em").'),
  type: z.string().optional().describe('Um tipo categorizado de relacionamento (ex: Comunicação, Financeiro, Familiar, Profissional, Geográfico, Técnico).'),
  direction: z.enum(["direcional", "bidirecional", "nao_direcional"]).optional().describe("A direcionalidade do relacionamento. 'direcional' de source para target, 'bidirecional' para ambos, 'nao_direcional' para associação sem direção clara."),
  strength: z.number().min(0).max(1).optional().describe('Força estimada ou confiança do relacionamento (0 a 1), se aplicável.'),
  properties: z.record(z.string()).optional().describe('Propriedades adicionais do relacionamento COMO STRINGS (ex: { "data_hora": "DD/MM/AAAA HH:MM", "valor_texto": "R$ XXX,XX" }). Os valores das propriedades devem ser strings.')
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
  identifiedEntities: z.array(EntitySchema).describe("Lista de todas as entidades únicas identificadas e classificadas pela IA a partir da entrada."),
  relationships: z.array(RelationshipSchema).describe('Uma lista de relacionamentos identificados entre as entidades.'),
  analysisSummary: z.string().optional().describe("Um breve resumo da análise de vínculos realizada pela IA, destacando os achados mais importantes ou dificuldades.")
});
export type FindEntityRelationshipsOutput = z.infer<typeof FindEntityRelationshipsOutputSchema>;

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
  output: {schema: FindEntityRelationshipsOutputSchema},
  prompt: `Você é um especialista em análise de inteligência e construção de grafos de vínculos, modelado a partir das capacidades do IBM i2 Analyst's Notebook. Sua tarefa é analisar uma lista de entidades de entrada, identificar entidades distintas, classificá-las e, o mais importante, inferir e descrever os relacionamentos entre elas, incluindo a criação de novas entidades implícitas se necessário (como eventos ou transações que conectam outras entidades).

**Contexto da Análise:** {{{analysisContext}}}
{{#if fileOrigin}}Arquivo de Origem dos Dados: {{{fileOrigin}}}{{/if}}

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
        *   **Pessoa:** (Ex: João Silva, Maria Oliveira). Propriedades podem incluir CPF (como string: "XXX.XXX.XXX-XX"), RG.
        *   **Organização:** (Ex: Empresa XYZ Ltda, Polícia Civil). Propriedades podem incluir CNPJ (como string: "XX.XXX.XXX/XXXX-XX").
        *   **Localização:** (Ex: Rua Principal 123, Porto Alegre, RS; Coordenada -30.0346° S, -51.2177° W).
        *   **Telefone:** (Ex: (XX) XXXXX-XXXX, +55 XX XXXXX-XXXX). Propriedades podem incluir operadora (string), tipo (string: celular, fixo).
        *   **Email:** (Ex: usuario@dominio.com).
        *   **Endereço IP:** (Ex: 192.168.1.1). Propriedades podem incluir geolocalização IP (string).
        *   **Veículo:** (Ex: Placa XXX-0000, Chassi YYYYYYY). Propriedades podem incluir marca (string), modelo (string), cor (string).
        *   **Evento/Incidente:** (Ex: Roubo a Banco na Data X, Homicídio Local Y). Propriedades podem incluir data/hora (string), tipo de crime (string). ESTA ENTIDADE PODE SER CRIADA PELA IA para conectar outras entidades.
        *   **Transação Financeira:** (Ex: Transferência R$1000 de Conta A para Conta B). Propriedades podem incluir valor_texto (string: "R$1000,00"), data/hora (string), tipo (string: TED, PIX), contas de origem/destino (strings). ESTA ENTIDADE PODE SER CRIADA PELA IA.
        *   **Documento (Referência):** (Ex: Contrato Nº ZZZ, Relatório XXX). Propriedades podem incluir tipo de documento (string), data (string). (Não confundir com o arquivo de origem dos dados).
        *   **Website/URL:** (Ex: https://www.exemplo.com).
        *   **Chave PIX:** (Ex: CPF, CNPJ, Email, Telefone, Aleatória associada a uma Pessoa ou Organização).
        *   **IMEI:** (Ex: 35XXXXXXXXXXXXX).
        *   **ERB (Estação Rádio Base):** (Ex: ERB-12345). Propriedades podem incluir localização (string).
        *   **Conta Bancária:** (Ex: Agência 0001 Conta 12345-6). Propriedades podem incluir banco (string).
        *   **Item/Objeto Físico:** (Ex: Arma de Fogo, Notebook Dell).
        *   **Outros:** Use se nenhuma das anteriores se aplicar, e especifique.
    *   Se uma entidade bruta puder ser decomposta em várias (ex: uma linha de CSV com nome, telefone e CPF), crie entidades separadas para cada um, se fizer sentido para a análise de vínculos.
    *   Para o campo 'properties' de cada entidade, se houver propriedades, elas DEVEM ser um objeto onde todas as chaves e valores são strings. Exemplo: { "CPF": "123.456.789-00", "RG": "1234567" }. Se não houver propriedades, omita o campo 'properties'. NÃO inclua 'properties: {}'.

2.  **Inferência e Descrição de Relacionamentos (Campo: relationships):**
    *   Identifique relacionamentos diretos e INDIRETOS (se possível, através de entidades intermediárias como Eventos ou Transações) entre as 'identifiedEntities'.
    *   Para CADA relacionamento:
        *   'source': ID da entidade de origem.
        *   'target': ID da entidade de destino.
        *   'label': Descrição textual concisa do relacionamento. Ex: "Comunicou com", "Efetuou Pagamento para", "Reside em", "Registrado em nome de", "Utilizou ERB", "Associado a".
        *   'type': (Opcional) Categorize o relacionamento (ex: Comunicação, Financeiro, Familiar, Profissional, Propriedade, Localização, Técnico, Participação em Evento).
        *   'direction': (Opcional) "direcional" (ex: Pessoa -> Telefone "possui"), "bidirecional" (ex: Pessoa <-> Pessoa "comunicou com"), "nao_direcional" (ex: Pessoa - Evento "participou de").
        *   'strength': (Opcional) Estime a confiança da IA na existência desse vínculo (0.0 a 1.0).
        *   'properties': (Opcional) Detalhes adicionais do relacionamento. Se houver propriedades, elas DEVEM ser um objeto onde todas as chaves e valores são strings. Ex: para "Comunicou com", { "data_hora_inicio": "DD/MM/AAAA HH:MM", "duracao_segundos_texto": "120" }. Se não houver propriedades, omita o campo 'properties'. NÃO inclua 'properties: {}'.

3.  **Considerações Específicas do Contexto ({{{analysisContext}}}):**
    *   **Geral:** Ampla gama de entidades e relações.
    *   **Telefonia:** Priorize Pessoas, Telefones, IMEIs, ERBs. Relações como "utilizou", "registrado para", "comunicou com", "localizado próximo a ERB".
    *   **Financeira:** Pessoas, Organizações, Contas Bancárias, Chaves PIX, Transações Financeiras. Relações como "transferiu para", "recebeu de", "é titular de", "efetuou pagamento para".
    *   **Pessoas e Organizações:** Pessoas, Organizações, Documentos, Localizações. Relações como "empregado de", "sócio de", "familiar de", "reside em", "associado com".
    *   **Digital e Cibernética:** IPs, Websites/URLs, Emails, Pessoas (usuários), Dispositivos. Relações como "acessou", "enviou email para", "registrou domínio", "conectou-se de IP".
    *   **Investigação Criminal Genérica:** Pessoas, Eventos/Incidentes, Localizações, Veículos, Itens. Relações como "suspeito de", "vítima de", "testemunha de", "ocorreu em", "utilizou veículo".

4.  **Criação de Entidades Implícitas:**
    *   Se múltiplas entidades se conectam através de um evento ou transação não explicitamente listado, CRIE uma nova entidade do tipo Evento ou Transação Financeira para representar esse nexo. Ex: Se Pessoa A ligou para Pessoa B (Telefone A para Telefone B), você pode criar uma entidade "Comunicação Telefônica" que liga Telefone A e Telefone B, e então ligar Pessoa A e Pessoa B aos seus respectivos telefones.

5.  **Análise de Vínculos i2 Style:** Pense como se estivesse construindo um gráfico no i2. O objetivo é revelar conexões, mesmo que não óbvias à primeira vista. Se um texto diz "João encontrou Maria no Parque X em 10/10/2023", crie entidades para João (Pessoa), Maria (Pessoa), Parque X (Localização), e um Evento "Encontro João e Maria" (ligando João, Maria, Parque X e com propriedade de data { "data_encontro_texto": "10/10/2023" }).

6.  **Output (Schema):** Popule rigorosamente os campos 'identifiedEntities' e 'relationships' conforme o schema. Se um relacionamento não for claro, atribua uma 'strength' menor. Lembre-se: os valores no campo 'properties' devem ser strings.

7.  **Resumo da Análise (analysisSummary):** Forneça um breve resumo textual dos principais achados, complexidades ou limitações da análise.

Se a lista de 'Entidades Brutas' for muito pequena ou os itens forem muito genéricos, faça o melhor possível para extrair significado e inferir relações, mesmo que com baixa confiança. Se for impossível, indique isso no 'analysisSummary'.
Foco na QUALIDADE e ESPECIFICIDADE dos tipos de entidade e na CLAREZA das descrições dos relacionamentos.
`,
});

const findEntityRelationshipsFlow = ai.defineFlow(
  {
    name: 'findEntityRelationshipsFlow',
    inputSchema: FindEntityRelationshipsInputSchema,
    outputSchema: FindEntityRelationshipsOutputSchema,
  },
  async (input: FindEntityRelationshipsInput) => {
    
    const MAX_ENTITIES_TO_PROCESS = 100; 
    let processedEntities = input.entities;
    let analysisSummaryPrefix = "";

    if (input.entities.length > MAX_ENTITIES_TO_PROCESS) {
      processedEntities = input.entities.slice(0, MAX_ENTITIES_TO_PROCESS);
      analysisSummaryPrefix = `AVISO: A lista de entidades fornecida (${input.entities.length}) excedeu o limite de ${MAX_ENTITIES_TO_PROCESS}. A análise foi realizada nos primeiros ${MAX_ENTITIES_TO_PROCESS} itens. `;
    }
    
    const promptInput = {
      ...input,
      entities: processedEntities
    };

    const {output} = await prompt(promptInput);
    if (!output) {
      return {
        identifiedEntities: [],
        relationships: [],
        analysisSummary: analysisSummaryPrefix + "A IA não retornou um resultado válido para a análise de vínculos."
      };
    }
    
    const entityIdMap = new Map<string, number>();
    const uniqueIdentifiedEntities = output.identifiedEntities.map(entity => {
      let newId = entity.label.replace(/[^a-zA-Z0-9_]/g, '_'); 
      if (entityIdMap.has(newId)) {
        entityIdMap.set(newId, entityIdMap.get(newId)! + 1);
        newId = `${newId}_${entityIdMap.get(newId)}`;
      } else {
        entityIdMap.set(newId, 1);
      }
      // Ensure properties is an object, even if AI omits it or sends null/undefined
      const validatedProperties = typeof entity.properties === 'object' && entity.properties !== null ? entity.properties : {};
      return { ...entity, id: newId, properties: validatedProperties };
    });

    const entityLabelToNewIdMap = new Map(uniqueIdentifiedEntities.map(e => [e.label, e.id]));
    const entityOriginalIdToNewIdMap = new Map(output.identifiedEntities.map((oe, index) => [oe.id, uniqueIdentifiedEntities[index].id]));
    
    const updatedRelationships = output.relationships.map(rel => {
        const newSourceId = entityOriginalIdToNewIdMap.get(rel.source) || entityLabelToNewIdMap.get(rel.source) || rel.source;
        const newTargetId = entityOriginalIdToNewIdMap.get(rel.target) || entityLabelToNewIdMap.get(rel.target) || rel.target;
        
        // Ensure properties is an object
        const validatedProperties = typeof rel.properties === 'object' && rel.properties !== null ? rel.properties : {};

        return {
            ...rel,
            source: newSourceId,
            target: newTargetId,
            properties: validatedProperties,
        };
    }).filter(rel => {
      const sourceNodeExists = uniqueIdentifiedEntities.some(node => node.id === rel.source);
      const targetNodeExists = uniqueIdentifiedEntities.some(node => node.id === rel.target);
      return rel.source && rel.target && sourceNodeExists && targetNodeExists;
    });


    return {
      identifiedEntities: uniqueIdentifiedEntities,
      relationships: updatedRelationships,
      analysisSummary: analysisSummaryPrefix + (output.analysisSummary || "Análise concluída.")
    };
  }
);
