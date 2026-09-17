# Fixtures históricas reais de formato

Todos os dados de treino e medidas são **fictícios**. A estrutura foi produzida
pelo código real da versão 3.5.1, esquema 12, do commit
`bcef68ea252bad5a71e7ef4e92bfedcb01bfa5c1`, executado em VM com relógio e IDs
determinísticos. O próprio `assertCurrentStateStructure` daquele código validou
o resultado. Não se rebaixou a versão de um objeto criado pelo esquema atual.

- `schema12-real-backup.json`: envelope real com quatro sessões atuais
  (concluída, parcial, cancelada e planejada), uma sessão arquivada, configurações,
  decisão de progressão e medidas bilaterais fictícias.
- `schema12-workouts.json`: seis fichas completas, materializadas pelo catálogo
  histórico. Deve coincidir com `THFSchema12Workouts` de `js/legacy-v12.js`.
- `schema12-provenance.json`: commit, versões, relógio e SHA-256 das fontes usadas.

O caso intencionalmente importante é a flexora `standing_unilateral`: o esquema
12 criava **um único log bilateral**, embora o nome da variação dissesse
unilateral. A migração precisa preservar esse registro, não inventar dois lados.
A remada unilateral contém registros esquerdo/direito com cargas, repetições,
RIR e observações diferentes, que devem permanecer independentes.

Uso nos testes:

```js
const {readLegacyState, readLegacyBackup} = require('./legacy-fixture.cjs');
const state12 = readLegacyState();
const backup11 = readLegacyBackup(11);
```

Cada leitura produz uma cópia nova. A variante 11 remove somente
`settings.equipmentLoadSteps`, introduzido na migração real 11 → 12, e ajusta os
dois números de esquema do envelope. Essa variante também foi validada pela
migração do código original 3.5.1. Os testes normais não dependem de Git.

Para investigar a geração, `node tests/legacy-fixture.cjs --generate backup`
(ou `workouts` / `metadata`) envia o conteúdo para a saída padrão, sem gravar arquivos.
Não regenere estes arquivos quando o catálogo atual mudar: sua função é congelar
a origem histórica contra regressões futuras.
