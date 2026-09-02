// ───────────────────────────── 실행 A: 설계 → 심사 → 종합 ─────────────────────────────
log('설계 3안 × 7 → 심사 2 → 종합 (엔진별 파이프라인)')
const synths = await pipeline(
  ENGINES,
  (engine) => parallel(LENSES.map((lens) => () => agent(designPrompt(engine, lens), { label: `설계:${engine}:${lens.key.slice(0, 1)}`, phase: '설계', schema: DESIGN_SCHEMA, effort: 'high' }))).then((ds) => ds.filter(Boolean)),
  (designs, engine) => {
    if (!designs.length) throw new Error('설계 0안: ' + engine)
    return parallel([
      () => agent(judgePrompt(engine, designs, '철학 정합·차원 변화 우선'), { label: `심사:${engine}:철학`, phase: '심사', schema: JUDGE_SCHEMA, effort: 'high' }),
      () => agent(judgePrompt(engine, designs, '실현성·명품·세로줄 기여 우선'), { label: `심사:${engine}:실현`, phase: '심사', schema: JUDGE_SCHEMA, effort: 'high' }),
    ]).then((js) => ({ designs, judges: js.filter(Boolean) }))
  },
  ({ designs, judges }, engine) => agent(synthPrompt(engine, designs, judges), { label: `종합:${engine}`, phase: '심사', schema: DESIGN_SCHEMA, effort: 'high' }).then((s) => ({ engine, synth: s, designs, judges })),
)
const ok = synths.filter(Boolean).filter((x) => x.synth)
log(`종합 완료 ${ok.length}/7`)
const missing = ENGINES.filter((e, i) => !synths[i] || !synths[i].synth)
if (missing.length) log('⚠ 종합 빠짐: ' + missing.join(', '))
return { synths: ok.map((x) => x.synth), designsByEngine: ok.map((x) => ({ engine: x.engine, designs: x.designs, judges: x.judges })), missing }
