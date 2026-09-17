# Base de evidências — acompanhamento independente dos lados

Data da síntese: 6 de setembro de 2026. Público: manutenção do Treino Hard. Escopo: decisões de produto da versão 3.6.0; não constitui prescrição, diagnóstico nem avaliação individual.

## Resposta direta

O aplicativo pode registrar os dois lados de forma independente, permitir variantes unilaterais compatíveis com o aparelho e mostrar a evolução absoluta de cada lado. Não há base para transformar uma diferença de circunferência em diagnóstico, definir um percentual universal de risco ou aumentar automaticamente o volume de um lado. A preferência unilateral é uma escolha explícita de acompanhamento, não uma conclusão de superioridade universal.

O comportamento implementado preserva séries e periodização. Observações adversas solicitam revisão e não modificam a carga. Este mecanismo é uma precaução de produto; não é uma regra clínica validada nos estudos abaixo. O registro antigo bilateral permanece bilateral, inclusive quando a variante agora oferece dois registros.

## Evidência e limites de aplicação

### Unilateral e bilateral

Kassiano et al. (2025), *Comparison of Muscle Growth and Dynamic Strength Adaptations Induced by Unilateral and Bilateral Resistance Training*, DOI 10.1007/s40279-024-02169-z: a revisão de nove estudos não encontrou diferença significativa de hipertrofia entre os modos e observou especificidade dos ganhos de força. Ausência de diferença significativa não prova equivalência. A qualidade dos estudos e a população limitam qualquer extrapolação individual. Não fundamenta séries extras automáticas nem substituição obrigatória dos exercícios bilaterais. [Registro bibliográfico e resumo no PubMed](https://pubmed.ncbi.nlm.nih.gov/39794667/).

### Diferenças entre lados

Parkinson et al. (2021), *The Calculation, Thresholds and Reporting of Inter-Limb Strength Asymmetry*, DOI 10.52082/jssm.2021.594: revisão de 53 artigos sobre métodos, índices e limiares. O uso frequente de 10–15% nem sempre tem suporte apropriado, e os efeitos sobre lesão/desempenho são inconsistentes. A revisão trata de força e tarefas específicas, não valida um ponto de corte para circunferências. Por isso, o app mostra os números absolutos e a fórmula sem classificação de gravidade. [Texto integral no Journal of Sports Science and Medicine](https://www.jssm.org/volume20/iss4/cap/jssm-20-594.pdf).

### Treinamento resistido e individualização

O posicionamento ACSM de 2026, *Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults*, DOI 10.1249/MSS.0000000000003897, sintetiza revisões sobre adultos saudáveis. Sustenta treinamento resistido progressivo e individualização; não valida especificamente a ficha de oito semanas do app nem seus RIR exatos para uma pessoa com limitações. A atualização conserva a periodização autorizada, em vez de apresentá-la como protocolo clínico comprovado. [Resumo oficial ACSM](https://acsm.org/science-spotlight-acsm-releases-new-position-stand-on-resistance-training/), [registro PubMed](https://pubmed.ncbi.nlm.nih.gov/41843416/).

### Referências de reabilitação: aplicação indireta

As diretrizes AHA/ASA de 2026, DOI 10.1161/STR.0000000000000536, destacam avaliação, coordenação e individualização da reabilitação após AVC. O resumo oficial também reconhece incerteza sobre tratamentos, momento e dose. A classificação específica de uma recomendação sobre treinar ambos os membros não foi confirmada no texto integral oficial acessível e não é usada para justificar o app. A população das diretrizes não é automaticamente a população do aplicativo. [Resumo oficial AHA/ASA, publicado em 27/08/2026](https://professional.heart.org/en/science-news/2026-guideline-for-adult-stroke-rehabilitation-and-recovery/top-things-to-know).

O Canadian Stroke Best Practices recomenda treinamento orientado a tarefas e resistência em situações selecionadas de reabilitação. Ganhos de força não se traduzem necessariamente em melhora equivalente de marcha/mobilidade. O app não interpreta kg levantados ou circunferências como recuperação funcional. [Diretriz oficial, membros inferiores, equilíbrio, mobilidade e treino aeróbico](https://www.strokebestpractices.ca/recommendations/stroke-rehabilitation-delivery/4-lower-extremity-balance-mobility-and-aerobic-training).

Pereira et al. (2023), DOI 10.1016/j.rehab.2023.101766, revisaram 14 ensaios em AVC crônico. Encontraram ganhos em componentes de força, com evidência baixa ou muito baixa, sem melhora consistente dos domínios de atividade e participação. O primeiro autor é Tales Andrade Pereira; Marcos Paulo Braz de Oliveira é coautor, corrigindo a atribuição abreviada “Braz et al.”. O estudo não prova superioridade unilateral universal. [Resumo primário no PubMed](https://pubmed.ncbi.nlm.nih.gov/37883831/).

Chacon-Barba et al. (2024), DOI 10.3390/brainsci14010057, revisaram treinamento resistido e espasticidade após AVC. A síntese não sustenta a afirmação de que resistência necessariamente piora a espasticidade, nem uma garantia individual de melhora ou segurança irrestrita. Acesso ao PMC foi intermitente e retornou verificação de navegador na conferência final; a conclusão é mantida em nível geral, sem converter resultados em dose individual. [Artigo no PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10813883/), [identificador da publicação](https://doi.org/10.3390/brainsci14010057).

Gracies (2005), *Pathophysiology of spastic paresis. I: Paresis and soft tissue changes*, DOI 10.1002/mus.20284, é uma revisão mecanística sobre paresia, desuso e alterações dos tecidos. Não é ensaio de prescrição do treino do aplicativo nem permite diagnosticar a origem de uma diferença entre lados. [Resumo no PubMed](https://pubmed.ncbi.nlm.nih.gov/15714510/).

## Decisões de engenharia, separadas das conclusões científicas

- `sideMode` é propriedade da variante. `sideModeSnapshot` e `workoutSnapshot` preservam a definição usada em cada sessão, sem reconstruir o passado com a ficha atual.
- Histórico de carga: exercício + variante + máquina + lado. A faixa identifica séries comparáveis e aparece nos pontos de evolução; trocar a faixa não apaga o histórico físico do aparelho.
- O lado de acompanhamento muda apenas apresentação/preferência das novas sessões. Não altera o significado de `left`, `right` e `bilateral`.
- Registros adversos da execução bloqueiam sugestões de aumento naquele registro. Relato pós-pernas e caminhada explicitamente vinculada qualificam as recomendações da sessão, sem atribuir um relato de uma data a outra.
- O volume unilateral usa séries equivalentes: direita e esquerda juntas não duplicam a ficha. Os dados de cada lado permanecem disponíveis separadamente.
- Circunferência: `abs(R − L) / max(R, L) × 100`. Exemplo fictício: 58 e 61,5 cm produzem 3,5 cm e 5,7%. A escolha do denominador é descritiva e documentada, não um teste clínico.
- Valores derivados de um registro legado único não são duas medições diretas. São mantidos, identificados e excluídos do cálculo de diferença entre lados.
- Vídeos novos só serão aprovados com fonte brasileira, português do Brasil, variante exata e inspeção visual individual. Novas associações unilaterais ficam pendentes, sem reutilizar o vídeo bilateral como se ensinasse a mesma execução.

## Matriz de lacunas e encerramento da pesquisa

| Questão | Evidência | Confiança/limite | Consequência |
|---|---|---|---|
| Unilateral é sempre superior? | Kassiano 2025 | Não sustentado; especificidade e limitações de amostra | Oferecer opções, sem impor superioridade |
| Percentual universal de risco? | Parkinson 2021 | Não sustentado, sobretudo para circunferências | Não classificar gravidade |
| Resistência individualizada? | ACSM 2026 | Direta para adultos saudáveis, indireta para condições clínicas | Não alegar validação individual da ficha |
| Dose extra para um lado? | Estudos e diretrizes revisados | Não há dose universal aplicável ao caso | Não adicionar séries automaticamente |
| Mudança funcional inferível da carga? | Pereira 2023; diretriz canadense | Força, marcha e participação são domínios diferentes | Registro descritivo e check opcional |
| Recomendação AHA específica e classe exata? | Resumo oficial 2026 | Texto integral/classificação não confirmados | Não citar classe ou nível como verificado |
| Todos os vídeos unilaterais são exatos? | Inventário do app | Cinco novas associações sem inspeção individual | Pendentes; nenhum ID inventado |

Foram feitas consultas por DOI/PMID e título, leitura de resumos primários, texto integral JSSM e diretrizes oficiais, além de conferência independente das afirmações de maior impacto. Houve bloqueios intermitentes no PMC/PubMed; não foram contornados com conclusões clínicas de fontes secundárias. A pesquisa para decisões de produto encerra-se porque as lacunas restantes não autorizam automatizar prescrição ou diagnóstico. Revisão clínica individual e curadoria audiovisual exata permanecem limites explícitos.

## Contrato visual aplicado

Superfície escolhida pelo usuário: aplicativo existente, com dados locais e uso offline. Pergunta: como cada lado mudou e qual a diferença observada em uma mesma medição? Consulta exata por registro, com tabelas semânticas e cartões de primeira/última medição de cada lado; sem interpolar dados escassos. Unidades cm/% e datas acompanham os valores. Ordem segue a preferência do perfil; nomes dos lados são explícitos e não dependem de cor. Paleta do app, foco de teclado e rolagem horizontal confinada à tabela no celular. Dados de teste são fictícios; não há envio de medições pessoais a ferramentas de visualização externas.

## Proveniência

Cada seção acima contém o título, autores/instituição, ano, DOI quando disponível e URL primária consultada. Os detalhes de implementação são verificáveis em `js/core.js`, `js/workouts.js`, `js/legacy-v12.js`, `js/measurements.js` e `js/app.js`; a evidência de testes e publicação pertence a `TESTES.md` e `RELATORIO-FINAL.md`, não a esta pesquisa.
