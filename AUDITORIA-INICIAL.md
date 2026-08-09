# Auditoria inicial — Treino Hard (Fofo) 2.2

Data da auditoria: 8 de agosto de 2026  
Commit de referência: `ad2e55281c5e2fa4e9efc6798b7d11d82e875ce8`  
Baseline preservado em: `C:\Users\waubi\Projetos\treino-hard-original-v2.2-2026-08-08`

## Escopo e método

Todos os cinco arquivos do projeto foram lidos antes de qualquer alteração. A cópia de referência foi comparada por SHA-256 com o diretório de trabalho: cinco arquivos na origem, cinco na cópia e zero diferenças.

Arquivos encontrados:

- `index.html` — 165.204 bytes e 2.257 linhas;
- `sw.js` — 1.393 bytes e 46 linhas;
- `manifest.webmanifest` — 430 bytes e 20 linhas;
- `logo.png` — PNG de 512 × 512 px, SHA-256 `76A7F748F04D99387F44EBE281554F3FE765230145DC20421E900129D649A8DA`;
- `tests/app.test.cjs` — 29.297 bytes e 471 linhas.

Não havia CSS ou JavaScript separado, vídeos locais, ícones adicionais, relatórios de auditoria, exemplos de exportação nem documentação de migração.

## Verificações executadas antes da alteração

- JavaScript embutido de `index.html`: sintaxe válida por `node --check -`.
- `sw.js`: sintaxe válida por `node --check sw.js`.
- Manifesto: JSON válido por `ConvertFrom-Json`.
- Testes existentes: 39 aprovados e zero falhas por `node --test tests/app.test.cjs`.
- Servidor local: HTTP 200.
- Recarregamento sem o servidor: a interface abriu pelo cache do service worker.
- Console do navegador na carga inicial: nenhum erro ou aviso capturado.
- Larguras de 320, 360 e 430 px: sem transbordamento horizontal global.

Esses resultados demonstram que a versão 2.2 era funcional dentro do modelo antigo; não validam os novos requisitos nem a correção da prescrição de treino.

## Estado funcional inicial

### Treinos e periodização

- Três fichas ABC executadas duas vezes por semana.
- IDs históricos invertidos: o objeto interno `a` era exibido como treino B e `b` como treino A.
- Associação fixa por dia e por primeira/segunda ocorrência.
- Oito semanas aplicadas de modo uniforme à maior parte dos exercícios.
- Descanso de 90 ou 120 segundos aplicado quase globalmente.
- Levantamento terra recebia a mesma faixa de até 12–15 repetições dos demais movimentos.
- Existiam supino reto com barra, stiff e pulldown no programa padrão.
- Não havia RIR por série, status por série, recomendação auditável de progressão dupla, seis fichas distintas, caminhada ou rotina de vacuum.
- O cronômetro era iniciado ao sair do campo de repetições quando o valor havia mudado.

### Sessões e histórico

- Dados organizados por `semana → ocorrência → exercício`, e não por sessões cronológicas.
- Metadados registravam apenas início/conclusão por semana, ocorrência e treino.
- Não existiam data planejada, data efetiva, duração completa, remarcação, cancelamento ou relação formal com cardio.
- Os gráficos percorriam 16 posições fixas e apenas rotulavam a variação; valores de variações diferentes ainda podiam formar a mesma linha.

### Dados e migração

- Esquema atual: 9, distribuído em várias chaves de `localStorage`.
- Importação possuía limite de 2 MB, validação parcial, snapshot de desfazer e neutralização de fórmulas no CSV.
- O normalizador descartava IDs desconhecidos. Isso poderia apagar registros futuros ou não mapeados durante uma importação.
- `a_remada_smith` é historicamente ambíguo e não pode ser associado automaticamente a uma remada nova; deve permanecer como legado.
- Um `schemaVersion` futuro armazenado localmente podia ser normalizado e regravado como esquema 9.
- O armazenamento não era criptografado, mas a interface não apresentava aviso suficientemente direto sobre acesso pelo mesmo perfil do navegador.
- IndexedDB não era utilizado.

### Vídeos

- Havia 28 URLs ativas entre exercícios e mobilidades, além de URLs legadas nos mapas de metadados.
- O próprio código identificava ao menos uma incompatibilidade: a URL comentada como flexora deitada apontava para um vídeo de stiff.
- Outro identificador chamado `c_flexor_sentado` descrevia flexora em pé unilateral.
- A interface afirmava revisão e cobertura técnica sem manter um inventário documental completo com título, idioma, disponibilidade, incorporação, limitações e decisão.
- O player já usava `youtube-nocookie.com`, e os vídeos não faziam parte do cache offline.

### Arquitetura e segurança

- HTML, CSS, catálogo, regras, armazenamento e interface estavam concentrados em um único arquivo de 2.257 linhas.
- Foram contados 821 atributos de evento inline na interface renderizada.
- Uso extensivo de `innerHTML` e funções globais acopladas aos atributos inline.
- Nenhuma Content Security Policy estava configurada.
- Havia escape de diversos campos e whitelist parcial, mas também construção de HTML por strings.
- Falhas importantes do registro do service worker eram ocultadas por `.catch(()=>{})`.
- O cache era versionado e removia versões antigas, porém gravações secundárias no cache não tinham tratamento explícito de falha.

### Acessibilidade e interface

- Existiam `tablist`, `tab`, `tabpanel`, `aria-selected`, modal com Escape, retenção de foco, foco visível e redução de movimento.
- Faltava roving `tabindex`: todas as abas não tinham atributo `tabindex`.
- Pressionar seta direita na aba selecionada não mudou a seleção.
- Não havia suporte completo a setas, Home, End, Enter e espaço conforme o padrão WAI-ARIA.
- Existiam muitos controles, métricas e cards simultâneos; não havia tela resumida “Hoje”.
- O título “Silhueta anatômica proporcional” sugeria precisão maior que a oferecida pelo método aproximado.

## Riscos prioritários

1. Perda ou reclassificação indevida de histórico durante a troca de IDs.
2. Mistura de cargas de equipamentos/variações diferentes nos gráficos.
3. Prescrição uniforme incompatível com a nova especificação por categoria.
4. Vídeo incorreto apresentado como guia técnico.
5. Cronômetro iniciado sem confirmação explícita.
6. Monólito com eventos inline, dificultando CSP e testes isolados.
7. Falta de sessão cronológica e de estados de remarcação/pulo.
8. Ausência de aviso de privacidade proporcional ao armazenamento local.

## Decisão de reforma

A versão nova será estática e modular, preservará o baseline e importará o esquema 9 como ciclo legado. IDs ambíguos serão mantidos como legados; nenhuma carga será transferida artificialmente para exercício ou aparelho novo. A publicação só ocorrerá depois dos testes automatizados, testes reais no navegador e revisão dos relatórios.
