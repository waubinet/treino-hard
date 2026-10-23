# Treino Hard — revisão visual 3.7.0

Pedido de 2026-10-23: melhorar a aparência em detalhes, substituir rosa por cinza e harmonizar o ursinho. Escopo: apresentação e assets; nenhuma mudança na ficha, curadoria, progressão ou formato persistido.

## Direção e implementação

Tema escuro grafite com ação em prata. As superfícies, e não bordas coloridas em todos os blocos, organizam a hierarquia. A navegação continua horizontal e rolável; a barra de rolagem indica a existência das demais abas. Seleções usam preenchimento, contorno e estado acessível, não apenas cor.

| Papel | Valor |
|---|---|
| Fundo, cor do navegador e manifesto | `#111315` |
| Superfície elevada | `#191c1f` |
| Cartão | `#202428` |
| Superfície interna | `#292e33` |
| Campo | `#15181b` |
| Borda de separação | `#3d444c` |
| Borda de controle | `#68737f` |
| Texto principal | `#f2f4f6` |
| Texto secundário | `#bcc4cc` |
| Texto discreto | `#a5afba` |
| Ação prata / texto sobre ação | `#ccd2d9` / `#111315` |
| Foco | `#edf1f5` |

Verde para conclusão, âmbar para atenção e vermelho para dor/erro/cancelamento continuam semânticos. Fotografias de vídeos e emojis do sistema não são recoloridos. O app não é estritamente monocromático em todos os pixels: a identidade e as superfícies são neutras.

Refinamentos: cartões com respiro e raio consistentes; textos secundários mais legíveis; ações de toque com área mínima; feedback e detalhes com foco interno para não ser cortado; linhas de série sem caixa interna redundante e com quebra em telas estreitas; numerais tabulares; contorno atual contínuo e anterior tracejado na silhueta.

## Auditoria do fluxo — evidência desta rodada

Capturas do IAB salvas em `output/playwright/gray-audit/` e inspecionadas individualmente. Antes: versão pública 3.6.10; depois: servidor local da 3.7.0. Conteúdo de teste/data podem diferir; as capturas são evidência visual, não comparação de dados ou prescrição. Viewport móvel 390 × 844; a barra de rolagem reduz a largura útil. Desktop adicional: 1265 × 712.

1. **Hoje — boa após revisão.** Antes, destaque rosa em marca, semana, abas e ação competia com o conteúdo; agora, ação prata, superfícies neutras e texto secundário mais claro. Evidências: `01-before-today.jpg` / `05-after-today.jpg`.
2. **Treino — boa após revisão.** Seleção de equipamento, alvo, vídeos e séries mantêm a estrutura, com hierarquia, bordas e campos consistentes. Foco interno de “Como me senti” aparece inteiro. Evidências: `02-before-workout.jpg` / `06-after-workout.jpg` / `09-after-feedback-focus.jpg`.
3. **Medidas — boa após revisão.** Agrupamentos e rótulos preservados, com distinção entre cartão, grupo e campo; contraste e espaçamentos aprimorados. Evidências: `03-before-measurements.jpg` / `07-after-measurements.jpg`.
4. **Ajustes — boa após revisão.** Metadados, controles e cartões alinhados ao restante da identidade; versão/esquema/cache continuam explícitos. Evidências: `04-before-settings.jpg` / `08-after-settings.jpg`.

Desktop: `10-after-desktop.jpg`. Tela estreita e foco: `11-after-320px.jpg`. Sem bloqueio visual identificado nessas telas; não se afirma ausência de defeitos em todos os dispositivos. QA funcional/contraste automatizado e estado público estão em `TESTES.md`.

Revisão complementar do pacote final: nove imagens em `output/playwright/3.7.0-local/`, cobrindo Hoje, supinos com barra/halteres, leg press, remada com anilhas, medidas em móvel/desktop, silhueta e mobilidade. Todas inspecionadas. O smoke compara SHA-256 de `logo.png` e dos três ícones com os bytes servidos, além de verificar tema, cache, offline e diferenciação contínua/tracejada da silhueta.

Publicação confirmada para `947ef3b`. Smoke público aprovado, inclusive hashes dos quatro assets. No IAB, `12-public-today.jpg` e `13-public-settings.jpg` documentam aparência e versão/cache 3.7.0 após confirmar “Atualizar agora”; ambas inspecionadas. Não houve limpeza de dados para a atualização.

## Ursinho e assets

Arte existente editada com **Image Gen integrado**; preservados personagem preto, expressão, pose, barra, pesos, corações e badge. Os detalhes rosa passam a prata e cinza. Nenhuma ferramenta de desenho programático foi usada para redesenhar o personagem. `scripts/build-brand-assets.cjs` usa Sharp apenas para redimensionamento, transparência e composição do fundo dos ícones.

- Logo final: `C:\Users\waubi\Projetos\treino-hard\logo.png`, 512 × 512, transparência externa.
- Ícones: `icon-192.png`, `icon-512.png` e `icon-maskable-512.png`, com fundo `#111315`.
- Maskable: arte central de 280 × 280 em 512 × 512, preservada dentro da zona segura; ícones comuns não recebem essa margem adicional.
- Master da geração (fora do repositório): `C:\Users\waubi\.codex\generated_images\019f50a1-f597-7dd0-8d75-ad08e7630386\exec-dc9dfb0c-71ed-45f1-9b75-2ead15b7a3a8.png`.

Prompt completo utilizado:

> Use case: precise-object-edit. Asset type: existing mobile fitness PWA mascot logo / app icon. Image 1 is the EDIT TARGET, not just a style reference. Preserve the exact recognizable black teddy bear character, facial expression, body proportions, standing pose, hands gripping the same barbell, weights, belly cloud emblem, small hearts, decorative clouds and circular badge composition. Change ONLY the color treatment and improve clean crisp edge quality for small-size display. Replace EVERY pink/rose/magenta accent (rings, outlines, cheek hearts, wristbands, plate hearts, belly hearts, stars, cloud outlines) with neutral silver, light gray and charcoal. Entire artwork must be genuinely monochrome: black, graphite, neutral grays and off-white only, no pink/purple/blue/beige tints anywhere. Keep strong separation between the dark teddy bear and the charcoal badge using restrained silver edge highlights; avoid chrome glare or heavy glow. Inside the circular badge use a uniform dark graphite #111315 background; outside the outer circular badge preserve true transparent background. Keep the full circular badge and complete barbell visible with balanced safe margin in a centered square image. No text, no new elements, no cropping of weights or ears, no change of mascot identity, no extra limbs. The result will be displayed around 56px in a header and also downscaled to PWA icons, so maintain a clear silhouette and readable face.

## Limites

Revisão visual do navegador emulado não equivale a QA em iPhone físico, avaliação por leitor de tela real ou instalação pelo sistema. A geração da logo preserva a identidade visual, mas não é uma cópia pixel a pixel da arte anterior. A mudança de ícone instalada pode depender do comportamento do sistema; não orientar limpeza de dados como forma de atualizar o tema.
