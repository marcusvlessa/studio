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

// Schema to define properties objects in a way that might satisfy strict API schema validators
// by having at least one (optional) defined property, while still allowing other string key-values.
const CustomPropertiesSchema = z.object({
    _internal_marker_: z.string().optional().describe("Campo interno para validação de schema, não deve ser preenchido ou gerado pela IA ativamente.")
}).catchall(z.string());


const EntitySchema = z.object({
  id: z.string().describe('Um ID único e SIMPLES para esta entidade (ex: "ent_1", "pessoa_joao_silva", "org_xpto_ltda"). Use apenas letras, números e underscores. ESTE ID, E SOMENTE ESTE ID, DEVE SER USADO nos campos "source" e "target" dos relacionamentos. NÃO use o label da entidade diretamente como ID nos relacionamentos; use este campo "id" que você está gerando aqui.'),
  label: z.string().describe('O valor ou nome da entidade (ex: João Silva, Empresa XYZ Ltda, (XX) XXXXX-XXXX).'),
  type: z.string().describe('O tipo inferido da entidade (ex: Pessoa, Organização, Localização, Telefone, Email, IP, Veículo, Evento, Transação Financeira, Documento, Website, Chave PIX, IMEI, ERB, Conta Bancária, Arma de Fogo, Outros). Seja o mais específico possível.'),
  properties: CustomPropertiesSchema.optional().default({}).describe('Um objeto JSON representando propriedades adicionais da entidade (ex: para Pessoa {"CPF": "XXX.XXX.XXX-XX", "RG": "12.345.678-9", "Nascimento_texto": "DD/MM/AAAA"}). Os valores dentro do JSON devem ser strings. Se não houver propriedades, envie um objeto JSON vazio como {} ou omita o campo.')
});

const RelationshipSchema = z.object({
  source: z.string().describe('O ID da entidade de origem do relacionamento (DEVE CORRESPONDER EXATAMENTE a um "id" de uma entidade definida em identifiedEntities).'),
  target: z.string().describe('O ID da entidade de destino do relacionamento (DEVE CORRESPONDER EXATAMENTE a um "id" de uma entidade definida em identifiedEntities).'),
  label: z.string().describe('Uma descrição concisa do relacionamento (ex: "Comunicou com", "Transferiu para", "Associado a", "Proprietário de", "Localizado em", "Ocorreu em", "Membro de", "Utilizou ERB", "É do tipo").'),
  type: z.string().optional().describe('Um tipo categorizado de relacionamento (ex: Comunicação, Financeiro, Familiar, Profissional, Geográfico, Técnico, Posse, Social, Metadado).'),
  direction: z.enum(["direcional", "bidirecional", "nao_direcional"]).optional().default("nao_direcional").describe("A direcionalidade do relacionamento. 'direcional' de source para target, 'bidirecional' para ambos, 'nao_direcional' para associação sem direção clara."),
  strength: z.number().min(0).max(1).optional().describe('Força estimada ou confiança do relacionamento (0 a 1), se aplicável.'),
  properties: CustomPropertiesSchema.optional().default({}).describe('Um objeto JSON representando propriedades adicionais do relacionamento (ex: {"data_hora": "DD/MM/AAAA HH:MM", "valor_texto": "R$ XXX,XX", "frequencia_texto": "3 vezes"}). Os valores dentro do JSON devem ser strings. Se não houver, envie {} ou omita o campo.')
});

const FindEntityRelationshipsInputSchema = z.object({
  entities: z
    .array(z.string())
    .min(1, "Pelo menos uma entidade deve ser fornecida.")
    .describe('Uma lista de textos ou valores brutos representando entidades a serem analisadas. A IA deve processar esta lista para identificar, classificar e encontrar relações. Se a lista parecer vir de uma tabela (várias strings curtas), considere que entidades na mesma "linha" conceitual podem estar relacionadas e decomponha-as em múltiplas entidades relacionadas. Se uma das entidades for uma mensagem de sistema indicando falha na leitura de um arquivo, a IA deve usar essa informação para contextualizar a análise de metadados (nome/tipo do arquivo).'),
  analysisContext: z.enum(["Geral", "Telefonia", "Financeira", "Pessoas e Organizações", "Digital e Cibernética", "Investigação Criminal Genérica"])
    .optional()
    .default("Geral")
    .describe('Contexto da análise para guiar a IA no tipo de entidades e relacionamentos a priorizar. Por exemplo, em "Telefonia", foque em números, IMEIs, ERBs; em "Financeira", em transações, contas.'),
  fileOrigin: z.string().optional().describe("Nome do arquivo original de onde as entidades foram extraídas, se aplicável, para contexto adicional.")
});
export type FindEntityRelationshipsInput = z.infer<typeof FindEntityRelationshipsInputSchema>;

// Schema for the prompt's direct output
const FindEntityRelationshipsOutputSchema = z.object({
  identifiedEntities: z.array(EntitySchema).describe("Lista de todas as entidades únicas identificadas e classificadas pela IA a partir da entrada, com IDs únicos para ReactFlow."),
  relationships: z.array(RelationshipSchema).describe('Uma lista de relacionamentos identificados entre as entidades, usando os IDs únicos de ReactFlow.'),
  analysisSummary: z.string().optional().describe("Um resumo textual conciso da análise de vínculos realizada pela IA, destacando os achados mais importantes, padrões observados, entidades centrais, ou dificuldades encontradas (como impossibilidade de ler conteúdo de arquivo). Deve ser redigido em linguagem clara e investigativa.")
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
  prompt: `Você é um especialista em análise de inteligência e construção de grafos de vínculos, modelado a partir das capacidades do IBM i2 Analyst's Notebook. Sua tarefa é analisar uma lista de 'Entidades Brutas' fornecidas, identificar entidades distintas, classificá-las e, o mais importante, inferir e descrever os relacionamentos entre elas. Se necessário, crie entidades implícitas (como Eventos ou Transações) para conectar outras entidades de forma significativa.

**Contexto da Análise:** {{{analysisContext}}}
{{#if fileOrigin}}Arquivo de Origem dos Dados: {{{fileOrigin}}}{{/if}}

**Entidades Brutas Fornecidas para Análise (podem ser texto extraído de um arquivo, incluindo linhas de tabela, ou metadados de arquivo como nome e tipo):**
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
    *   **Tratamento de Mensagens de Sistema:** Se uma das 'Entidades Brutas' for claramente uma mensagem do sistema indicando impossibilidade de leitura de conteúdo de arquivo (ex: "Impossibilidade de análise direta...", "AVISO DO SISTEMA: O arquivo..."), NÃO crie uma entidade para essa mensagem no grafo. Em vez disso, use essa informação para detalhar o 'analysisSummary', explicando que a análise de vínculos para o arquivo {{{fileOrigin}}} (se aplicável) foi limitada a metadados (nome, tipo de arquivo) pois seu conteúdo não pôde ser processado. As outras 'Entidades Brutas' (como nome do arquivo, tipo MIME, ou texto extraído de outras fontes) devem ser processadas normalmente para identificação de entidades e relações.
    *   Para CADA entidade identificada (que NÃO seja uma mensagem de sistema):
        *   **ID da Entidade (Campo 'id'):** Atribua um ID único e SIMPLES para esta entidade (ex: "ent_1", "pessoa_joao_silva", "org_xpto_ltda", "tel_5511999998888"). **Este ID DEVE SER uma string não vazia, composta apenas por letras minúsculas, números e underscores ('_').** Este ID é CRUCIAL e DEVE ser usado EXATAMENTE IGUAL nos campos 'source' e 'target' dos relacionamentos. NÃO use o label da entidade diretamente como ID nos relacionamentos; use este campo 'id' que você está gerando aqui.
        *   **Label da Entidade (Campo 'label'):** O valor textual da entidade como ela aparece nos dados ou como foi inferida (ex: João Silva, Empresa XYZ Ltda, (51) 99999-8888, 192.168.1.100).
        *   **Tipo da Entidade (Campo 'type'):** Classifique com um 'type' o mais específico possível, usando os tipos PRIMÁRIOS listados abaixo e refinando quando possível. Priorize a especificidade conforme o 'analysisContext'.
            *   **Pessoa:** (Ex: João Silva). Propriedades: {"CPF": "XXX.XXX.XXX-XX", "RG": "XX.XXX.XXX-X", "Nascimento_texto": "DD/MM/AAAA", "Apelido": "Zé"}.
            *   **Organização:** (Ex: Empresa XYZ Ltda, Polícia Civil, Facção Os Manos). Propriedades: {"CNPJ": "XX.XXX.XXX/XXXX-XX", "Tipo": "ONG", "Ramo_Atividade": "Comércio"}.
            *   **Localização:** (Ex: Rua Principal 123, Porto Alegre; Coordenada GEO: -30.03, -51.21). Propriedades: {"CEP": "XXXXX-XXX", "Cidade": "Nome Cidade", "País": "Brasil"}.
            *   **Telefone:** (Ex: (51) 99999-8888, 5511988887777). Propriedades: {"Operadora": "Vivo", "TipoLinha": "Celular", "IMEI_associado": "id_do_imei_correspondente_se_identificado"}.
            *   **Email:** (Ex: usuario@dominio.com).
            *   **Endereço IP:** (Ex: 192.168.1.100). Propriedades: {"Provedor": "Nome Provedor", "GeolocalizacaoIP_texto": "Cidade, País", "TipoIP": "IPv4"}.
            *   **Veículo:** (Ex: Placa XXX-0000, IXX1A23). Propriedades: {"Marca": "Ford", "Modelo": "Fiesta", "Cor": "Preto", "Chassi_texto": "YYYYYYYYY", "RENAVAM_texto": "ZZZZZZZZZ"}.
            *   **Evento/Incidente:** (Ex: Assalto Banco X em DD/MM/AA, Homicídio Vítima Y). Propriedades: {"DataHora_texto": "DD/MM/AAAA HH:MM", "TipoCrime_texto": "Roubo", "Local_ID": "id_da_localizacao_do_evento"}. *PODE SER CRIADO PELA IA para conectar outras entidades.*
            *   **Transação Financeira:** (Ex: PIX R$1000 ContaA para ContaB). Propriedades: {"Valor_texto": "R$1000,00", "DataHora_texto": "DD/MM/AAAA HH:MM", "TipoTransacao": "PIX", "OrigemID": "id_da_entidade_origem", "DestinoID": "id_da_entidade_destino", "Status": "Confirmada"}. *PODE SER CRIADO PELA IA.*
            *   **Documento (Referência):** (Ex: Contrato Nº ZZZ, Relatório RIF_001, {{{fileOrigin}}}). Se a entidade for o próprio arquivo de origem, use o nome do arquivo como label. Propriedades: {"TipoDocumento": "Contrato", "DataCriacao_texto": "DD/MM/AAAA", "NomeOriginal_texto": "{{{fileOrigin}}}", "TipoMIME_texto": "application/pdf"}.
            *   **Website/URL:** (Ex: https://www.exemplo.com/pagina_suspeita). Propriedades: {"Dominio": "exemplo.com", "Status": "Ativo"}.
            *   **Chave PIX:** (Ex: CPF:XXX.XXX.XXX-XX, CNPJ:XX.XXX.XXX/XXXX-XX, Email:pix@ex.com, Telefone:(XX)XXXXX-XXXX, ChaveAleatoria:abc-123). Relacionar à Pessoa/Organização dona se identificável. Propriedades: {"TipoChave": "CPF", "AssociadaA_ID": "id_da_pessoa_ou_organizacao_dona_da_chave"}.
            *   **IMEI:** (Ex: 35XXXXXXXXXXXXX). Relacionar a entidades Telefone, se possível. Propriedades: {"Fabricante": "Samsung", "ModeloAparelho": "Galaxy S20"}.
            *   **ERB (Estação Rádio Base):** (Ex: ERB-12345_TORRE_CENTRO). Propriedades: {"LocalizacaoERB_texto": "Endereço ou Coordenada da ERB", "Operadora": "Claro"}.
            *   **Conta Bancária:** (Ex: Ag:0001 C:12345-6 Banco X). Propriedades: {"Banco": "Nome Banco", "Agencia_texto": "0001", "Conta_texto": "12345-6", "TitularID": "id_da_pessoa_ou_organizacao_titular"}.
            *   **Arma de Fogo:** (Ex: Pistola Taurus G2C Cal.9mm). Propriedades: {"NumeroSerie_texto": "XXXXX", "Calibre_texto": ".9mm", "TipoArma": "Pistola"}.
            *   **Nome de Arquivo:** (Ex: {{{fileOrigin}}}). Usar se o próprio arquivo é uma entidade central na análise de metadados.
            *   **Tipo de Arquivo:** (Ex: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet). Se uma das entidades brutas for um tipo MIME, identifique-a como tal.
            *   **Outros:** Para entidades que não se encaixam acima, seja específico (ex: "Produto Químico", "Droga", "Apelido").
    *   **Dados Tabulares:** Se uma 'Entidade Bruta' parecer ser uma linha de dados tabulares (ex: "João Silva,(XX)XXXXX-XXXX,XXX.XXX.XXX-XX"), decomponha-a em múltiplas entidades (Pessoa "João Silva", Telefone "(XX)XXXXX-XXXX", Documento "CPF XXX.XXX.XXX-XX") CADA UMA COM SEU PRÓPRIO 'id' ÚNICO (seguindo as regras de ID simples), e INFERA relacionamentos entre elas (ex: João Silva "possui" Telefone, João Silva "possui" CPF).
    *   **Propriedades (Campo 'properties'):** Para CADA entidade e relacionamento, se houver propriedades, forneça um objeto JSON com pares chave-valor (ex: {"CPF": "123.456.789-00", "Status": "Ativo"}). Os valores dentro do JSON devem ser strings. Se NÃO HOUVER propriedades para uma entidade ou relacionamento, OMITA COMPLETAMENTE o campo 'properties' para esse item específico. Não envie um objeto JSON vazio como {}.

2.  **Inferência e Descrição de Relacionamentos (Campo: relationships):**
    *   Identifique relacionamentos DIRETOS e INDIRETOS (através de entidades intermediárias como Eventos ou Transações) entre as identifiedEntities.
    *   Para CADA relacionamento:
        *   'source' e 'target': **IMPERATIVO E ABSOLUTAMENTE ESSENCIAL:** Use os IDs EXATOS das entidades de origem/destino conforme definidos por VOCÊ no campo 'id' da lista identifiedEntities. O valor de 'source' e 'target' aqui DEVE ser IDÊNTICO ao valor do campo 'id' da entidade correspondente. Não use labels, não use variações, use o ID exato.
        *   'label': Descrição textual concisa do relacionamento (Ex: "Comunicou com (Telefone)", "Transferiu R$X para (PIX)", "Reside em (Endereço)", "Proprietário de (Veículo)", "Utilizou ERB (Telefone)", "É do tipo (Metadado)", "Membro de (Organização)"). Seja específico, indicando o tipo de relação se ajudar.
        *   'type': (Opcional) Categorize (Ex: Comunicação, Financeiro, Familiar, Profissional, Propriedade, Localização, Técnico, Participação em Evento, Social, Metadado).
        *   'direction': (Opcional) "direcional", "bidirecional", ou "nao_direcional". Se "direcional", indique o fluxo (ex: de source para target).
        *   'strength': (Opcional) Confiança (0.0 a 1.0).
        *   'properties': (Opcional) Se houver propriedades, forneça um objeto JSON com detalhes (Ex: {"data_hora_inicio_texto": "DD/MM/AAAA HH:MM", "duracao_segundos_texto": "120", "valor_transferido_texto": "R$ 500,00"}). Se NÃO HOUVER, OMITA COMPLETAMENTE o campo 'properties'.

3.  **Criação de Entidades Implícitas:** Se, por exemplo, Pessoa A e Pessoa B são mencionadas em conexão com um "assalto dia X", crie uma entidade 'Evento/Incidente' "Assalto Dia X" (com seu próprio ID único, ex: "evento_assalto_dia_x", seguindo as regras de ID simples), e relacione Pessoa A (usando seu ID) e Pessoa B (usando seu ID) a este evento (ex: Pessoa A "participou de" evento_assalto_dia_x). Certifique-se de que esta entidade implícita também esteja listada em identifiedEntities.

4.  **Resumo da Análise (Campo: analysisSummary):**
    *   Forneça um resumo textual conciso (2-5 parágrafos) da análise de vínculos.
    *   **Destaque:** Entidades centrais (com muitas conexões), principais grupos/clusters, tipos de relacionamentos mais comuns, e quaisquer padrões ou anomalias observadas.
    *   **Importante:** Se a análise foi desafiadora devido à natureza dos dados (ex: conteúdo de arquivo não processável, dados esparsos, texto muito genérico), mencione explicitamente essas limitações e como a análise se baseou em metadados ou inferências limitadas. Por exemplo: "A análise do arquivo '{{{fileOrigin}}}' foi limitada, pois seu conteúdo não pôde ser extraído diretamente. Os vínculos identificados baseiam-se no nome e tipo do arquivo, e em outras entidades fornecidas." Se você identificou relacionamentos, mas teve dificuldade em mapeá-los devido a inconsistências nos IDs, mencione isso brevemente.
    *   O tom deve ser objetivo, investigativo e em LÍNGUA PORTUGUESA.

Se a lista de 'Entidades Brutas' for pequena ou muito genérica, faça o melhor possível para extrair significado e indique no 'analysisSummary' as limitações.
Foco na QUALIDADE e ESPECIFICIDADE dos tipos de entidade e na CLAREZA das descrições dos relacionamentos.
**REITERAÇÃO CRUCIAL E FINAL:** A consistência dos IDs é FUNDAMENTAL. O ID que você define para uma entidade no campo 'id' da lista identifiedEntities DEVE SER EXATAMENTE O MESMO ID usado nos campos 'source' ou 'target' de QUALQUER relacionamento que envolva essa entidade. Qualquer pequena variação (maiúscula/minúscula, espaço extra, caractere diferente) fará com que o vínculo não seja visualizado corretamente.
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

    const {output: rawOutput} = await prompt(promptInput);
    if (!rawOutput) {
      console.error("Análise de vínculos: A IA não retornou um resultado válido.");
      return {
        identifiedEntities: [],
        relationships: [],
        analysisSummary: analysisSummaryPrefix + "A IA não retornou um resultado válido para a análise de vínculos."
      };
    }

    console.log("[findEntityRelationshipsFlow] Saída bruta da IA recebida:", JSON.stringify(rawOutput, null, 2));

    const aiEntityIdToReactFlowIdMap = new Map<string, string>();
    const reactFlowIdUsageMap = new Map<string, number>();

    const parsedIdentifiedEntities: FindEntityRelationshipsOutput['identifiedEntities'] = (rawOutput.identifiedEntities || [])
      .filter(entity => entity && entity.label && !(entity.label.startsWith("AVISO DO SISTEMA:") || entity.label.startsWith("Impossibilidade de análise")))
      .map((entity, idx) => {
        const aiProvidedId = (typeof entity.id === 'string' && entity.id.trim() !== "") ? entity.id.trim() : null;
        const aiOriginalId = aiProvidedId || `entidade_sem_id_original_ia_${entityFlowCounter++}_${(entity.label || 'nolabel').substring(0,10).replace(/[^a-zA-Z0-9_]/g, '')}`;

        if (!aiProvidedId) {
            console.warn(`[findEntityRelationshipsFlow] Entidade da IA (Label: ${entity.label}, Index: ${idx}) veio SEM ID ou com ID VAZIO! Usando ID de fallback para mapeamento: ${aiOriginalId}. O prompt da IA DEVE fornecer um 'id' válido para cada 'identifiedEntities'.`);
        }

        let baseReactFlowId = aiOriginalId.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50);
        if (baseReactFlowId.length === 0 || /^\\W+$/.test(baseReactFlowId) || baseReactFlowId.startsWith('_')) {
            baseReactFlowId = `entidade_gerada_${entityFlowCounter++}`;
        }

        let finalReactFlowId = baseReactFlowId;
        let count = reactFlowIdUsageMap.get(baseReactFlowId) || 0;
        if (count > 0) {
          finalReactFlowId = `${baseReactFlowId}_${count}`;
        }
        reactFlowIdUsageMap.set(baseReactFlowId, count + 1);

        aiEntityIdToReactFlowIdMap.set(aiOriginalId, finalReactFlowId);

        // Ensure properties is an object, defaulting to empty if undefined or not an object
        let parsedProperties: Record<string, string> = {};
        if (typeof entity.properties === 'object' && entity.properties !== null && !Array.isArray(entity.properties)) {
            // Convert all property values to strings
            Object.entries(entity.properties).forEach(([key, value]) => {
                if (key !== '_internal_marker_') { // Exclude dummy field if present
                    parsedProperties[key] = String(value);
                }
            });
        } else if (entity.properties) {
            console.warn(`[findEntityRelationshipsFlow] 'properties' for entity '${entity.label}' was not a valid object:`, entity.properties);
        }


        return { ...entity, id: finalReactFlowId, properties: parsedProperties };
    });

    console.log("[findEntityRelationshipsFlow] Entidades parseadas para ReactFlow (mostrando id, label, id_original_IA_mapeado_de):", JSON.stringify(parsedIdentifiedEntities.map(e => ({id: e.id, label: e.label, id_original_IA_mapeado_de: Array.from(aiEntityIdToReactFlowIdMap.entries()).find(entry => entry[1] === e.id)?.[0] || 'N/A'})), null, 2));
    console.log("[findEntityRelationshipsFlow] Mapa de IDs (ID IA Original/Fallback -> ID ReactFlow):", JSON.stringify(Array.from(aiEntityIdToReactFlowIdMap.entries()), null, 2));

    const parsedRelationships: FindEntityRelationshipsOutput['relationships'] = (rawOutput.relationships || [])
    .map((rel, index) => {
        if (!rel || typeof rel.source !== 'string' || rel.source.trim() === "") {
            console.warn(`[findEntityRelationshipsFlow] Relacionamento (Label: ${rel?.label || 'N/A'}, Index: ${index}) da IA veio com 'source' inválido ou vazio. Relacionamento ignorado.`);
            return null;
        }
        if (typeof rel.target !== 'string' || rel.target.trim() === "") {
            console.warn(`[findEntityRelationshipsFlow] Relacionamento (Label: ${rel.label}, Index: ${index}) da IA veio com 'target' inválido ou vazio. Relacionamento ignorado.`);
            return null;
        }

        const reactFlowSourceId = aiEntityIdToReactFlowIdMap.get(rel.source.trim());
        const reactFlowTargetId = aiEntityIdToReactFlowIdMap.get(rel.target.trim());

        if (!reactFlowSourceId) {
            console.warn(`[findEntityRelationshipsFlow] ID de origem do relacionamento IA ('${rel.source}') não encontrado no mapa de IDs para o relacionamento: '${rel.label}'. Chaves do mapa: [${Array.from(aiEntityIdToReactFlowIdMap.keys()).join(', ')}]. Relacionamento ignorado.`);
            return null;
        }
        if (!reactFlowTargetId) {
            console.warn(`[findEntityRelationshipsFlow] ID de destino do relacionamento IA ('${rel.target}') não encontrado no mapa de IDs para o relacionamento: '${rel.label}'. Chaves do mapa: [${Array.from(aiEntityIdToReactFlowIdMap.keys()).join(', ')}]. Relacionamento ignorado.`);
            return null;
        }

        let parsedRelProperties: Record<string, string> = {};
         if (typeof rel.properties === 'object' && rel.properties !== null && !Array.isArray(rel.properties)) {
            Object.entries(rel.properties).forEach(([key, value]) => {
                 if (key !== '_internal_marker_') {
                    parsedRelProperties[key] = String(value);
                }
            });
        } else if (rel.properties){
             console.warn(`[findEntityRelationshipsFlow] 'properties' for relationship '${rel.label}' was not a valid object:`, rel.properties);
        }


        return {
            ...rel,
            id: rel.id || `edge-${index}-${reactFlowSourceId}-${reactFlowTargetId}`,
            source: reactFlowSourceId,
            target: reactFlowTargetId,
            properties: parsedRelProperties,
        };
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null)
    .filter(edge => {
        const sourceNodeExists = parsedIdentifiedEntities.some(node => node.id === edge.source);
        const targetNodeExists = parsedIdentifiedEntities.some(node => node.id === edge.target);

        if (!sourceNodeExists) {
            console.warn(`[findEntityRelationshipsFlow] Filtrando aresta (APÓS MAPEAMENTO) devido a nó de origem ('${edge.source}') ausente para o relacionamento: '${edge.label}'. Verifique se a entidade de origem foi corretamente identificada e mapeada.`);
        }
        if (!targetNodeExists) {
            console.warn(`[findEntityRelationshipsFlow] Filtrando aresta (APÓS MAPEAMENTO) devido a nó de destino ('${edge.target}') ausente para o relacionamento: '${edge.label}'. Verifique se a entidade de destino foi corretamente identificada e mapeada.`);
        }
        return sourceNodeExists && targetNodeExists;
    });

    console.log("[findEntityRelationshipsFlow] Relacionamentos parseados para ReactFlow (mostrando source, target, label):", JSON.stringify(parsedRelationships.map(r => ({id: r.id, source: r.source, target: r.target, label: r.label})), null, 2));

    const finalSummary = analysisSummaryPrefix + (rawOutput.analysisSummary || "Análise de vínculos concluída. Nenhum resumo adicional fornecido pela IA.");
    console.log("[findEntityRelationshipsFlow] Resumo final:", finalSummary);

    if (parsedIdentifiedEntities.length > 0 && parsedRelationships.length === 0 && rawOutput.relationships && rawOutput.relationships.length > 0) {
        console.warn("[findEntityRelationshipsFlow] A IA retornou relacionamentos, mas NENHUM pôde ser mapeado ou validado para o grafo. Verifique os logs de 'ID de origem/destino... não encontrado' ou 'Filtrando aresta APÓS MAPEAMENTO'. Isto geralmente indica que a IA não usou os IDs corretos nos campos 'source' e 'target' dos relacionamentos, ou não definiu as entidades correspondentes aos IDs usados.");
    } else if (parsedIdentifiedEntities.length > 0 && parsedRelationships.length > 0) {
        console.log(`[findEntityRelationshipsFlow] Análise de vínculos bem-sucedida: ${parsedIdentifiedEntities.length} entidades e ${parsedRelationships.length} relacionamentos para o grafo.`);
    }


    return {
      identifiedEntities: parsedIdentifiedEntities,
      relationships: parsedRelationships,
      analysisSummary: finalSummary
    };
  }
);
