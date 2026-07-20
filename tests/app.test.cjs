const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=html.match(/<script>([\s\S]*)<\/script>/)[1];

function todayKey(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function createElement(){
  const attrs={};
  return {
    innerHTML:'',textContent:'',className:'',hidden:false,style:{},dataset:{},isConnected:true,
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    setAttribute(k,v){attrs[k]=String(v);},removeAttribute(k){delete attrs[k];},
    getAttribute(k){return attrs[k]??null;},focus(){},click(){},remove(){},appendChild(){},
    querySelector(){return null;},querySelectorAll(){return [];}
  };
}

function boot(initial={}){
  const store=new Map(Object.entries(initial));
  const elements=new Map();
  const element=key=>{ if(!elements.has(key)) elements.set(key,createElement()); return elements.get(key); };
  const document={
    hidden:false,activeElement:createElement(),body:createElement(),
    getElementById:id=>element('#'+id),querySelector:sel=>element(sel),querySelectorAll:()=>[],
    createElement:()=>createElement(),addEventListener(){}
  };
  const localStorage={
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)
  };
  class MockFileReader{
    readAsText(file){ this.result=file.content; if(this.onload) this.onload(); }
  }
  const context=vm.createContext({
    console,document,localStorage,navigator:{},location:{href:'http://localhost/',origin:'http://localhost'},
    window:{addEventListener(){},scrollTo(){},open(){return null;}},
    requestAnimationFrame:fn=>fn(),setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},
    Blob:global.Blob,URL:global.URL,Date,Math,JSON,Number,String,Object,Array,Set,RegExp,
    confirm:()=>true,alert(){},FileReader:MockFileReader
  });
  vm.runInContext(source,context);
  return {context,store,run:code=>vm.runInContext(code,context)};
}

test('preserva seleção manual do primeiro treino no mesmo dia',()=>{
  const app=boot({jovilite_session:'1',jovilite_lastopen:todayKey()});
  assert.equal(app.run('state.session'),1);
});

test('recalcula treino e ocorrência ao retomar em um novo dia',()=>{
  const app=boot({jovilite_session:'1',jovilite_tab:'a',jovilite_lastopen:todayKey()});
  app.store.set('jovilite_lastopen','2000-01-01');
  app.run('syncTodayWorkout()');
  const day=new Date().getDay();
  const expectedTab=['','b','a','c','b','a','c'][day];
  if(expectedTab) assert.deepEqual(JSON.parse(JSON.stringify(app.run('[state.tab,state.session]'))),[expectedTab,day>=4?2:1]);
});

test('migra integralmente dados legados mantendo a convenção da v1.2',()=>{
  const legacy={1:{c_agach_smith:{sets:[{kg:'50',reps:'10'}],done:false}}};
  const app=boot({jovilite_data:JSON.stringify(legacy),jovilite_lastopen:todayKey()});
  assert.equal(app.run("readEntry(1,'c_agach_smith',1).sets[0].kg"),'50');
  assert.equal(app.run("readEntry(1,'c_agach_smith',2).sets.length"),0);
  assert.equal(JSON.parse(app.store.get('jovilite_data')).schemaVersion,4);
});

test('rejeita campos maliciosos e escapa referências em HTML',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  assert.equal(app.run("normalizeData({qualquer:'coisa'}).valid"),false);
  assert.equal(app.run("normalizeStoredField('kg','.5')"),'0.5');
  assert.equal(app.run("normalizeStoredField('kg','50.')"),'50');
  assert.equal(app.run("normalizeStoredField('kg','<img src=x onerror=1>')"),'');
  app.run(`state.week=2;state.session=2;state.data={2:{1:{c_agach_smith:{sets:[{kg:'',reps:''},{kg:'',reps:''},{kg:'<img src=x onerror=1>',reps:'5'}],done:false}},2:{}}}`);
  const card=app.run('exerciseCard(WORKOUTS[2].exercises[4])');
  assert.equal(card.includes('<img src=x'),false);
  assert.equal(card.includes('&lt;img src=x onerror=1&gt;'),true);
});

test('todos os vídeos identificam o canal de origem',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  assert.equal(app.run("[...Object.values(YT),...STRETCHES.map(s=>s.vid)].every(url=>videoSource(url)!=='YouTube')"),true);
});

test('todos os vídeos têm curadoria e justificativa visível',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  assert.equal(app.run("[...Object.values(YT),...STRETCHES.map(s=>s.vid)].every(url=>VIDEO_REVIEW[ytId(url)])"),true);
  assert.equal(app.run("Object.values(VIDEO_REVIEW).every(r=>['guiado','objetivo','visual'].includes(r.l)&&r.s>0)"),true);
  const card=app.run('exerciseCard(WORKOUTS[2].exercises[4])');
  assert.equal(card.includes('Cobre:'),true);
  assert.equal(card.includes('revisado 20/07/2026'),true);
});

test('aplica a sequência pessoal de costas e usa máquinas nas remadas',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  const ids=JSON.parse(JSON.stringify(app.run("WORKOUTS.find(w=>w.tid==='a').exercises.filter(e=>e.kind==='per').map(e=>e.id)")));
  assert.deepEqual(ids.slice(0,5),['a_puxada_supinada','a_puxada_neutra','a_remada_sentada','a_remada_smith','a_remada_unilateral']);
  assert.equal(app.run("WORKOUTS.find(w=>w.tid==='a').label"),'B');
  assert.equal(app.run("WORKOUTS.find(w=>w.tid==='a').exercises.find(e=>e.id==='a_remada_smith').name"),'Remada Articulada');
  assert.equal(app.run("WORKOUTS.find(w=>w.tid==='a').exercises.find(e=>e.id==='a_remada_unilateral').detail.includes('Máquina')"),true);
  assert.equal(app.run("ytId(YT.a_remada_smith)"),'i3FScctBKvc');
  assert.equal(app.run("ytId(YT.a_remada_unilateral)"),'Prevu525iYQ');
});

test('salva feedback por exercício e gera relatório seguro para revisão',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run("state.week=1;state.session=1;setExerciseFeeling('a_remada_unilateral','replace')");
  app.run("setExerciseFeedback('a_remada_unilateral','  prefiro máquina <img src=x onerror=1>  ')");
  assert.equal(app.run("readEntry(1,'a_remada_unilateral').feeling"),'replace');
  assert.equal(app.run("readEntry(1,'a_remada_unilateral').feedback"),'prefiro máquina <img src=x onerror=1>');
  assert.equal(JSON.parse(app.store.get('jovilite_data')).schemaVersion,4);
  const card=app.run("exerciseCard(WORKOUTS.find(w=>w.tid==='a').exercises.find(e=>e.id==='a_remada_unilateral'))");
  assert.equal(card.includes('<img src=x'),false);
  assert.equal(card.includes('&lt;img src=x onerror=1&gt;'),true);
  assert.equal(app.run("feedbackReportText().includes('Quero substituir')"),true);
  assert.equal(app.run("renderFeedbackReview().includes('Treino B · Remada Unilateral')"),true);
});

test('usa a ocorrência imediatamente anterior como referência',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run(`state.data={1:{1:{c_terra_barra:{sets:[{kg:'40',reps:'10'}],done:false}},2:{c_terra_barra:{sets:[{kg:'60',reps:'8'}],done:false}}},2:{1:{c_terra_barra:{sets:[{kg:'70',reps:'8'}],done:false}},2:{}}}`);
  app.run('state.session=1');
  assert.deepEqual(JSON.parse(JSON.stringify(app.run("prevReference('c_terra_barra',2,0)"))),{week:1,session:2,sets:[{kg:'60',reps:'8'}]});
  app.run('state.session=2');
  assert.deepEqual(JSON.parse(JSON.stringify(app.run("prevReference('c_terra_barra',2,0)"))),{week:2,session:1,sets:[{kg:'70',reps:'8'}]});
});

test('calcula evolução somente com séries de trabalho',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run(`state.data={1:{1:{c_agach_smith:{sets:[
    {kg:'100',reps:'5'},{kg:'110',reps:'3'},
    {kg:'50',reps:'10'},{kg:'60',reps:'8'},{kg:'55',reps:'9'}
  ],done:true}},2:{}}}`);
  const point=JSON.parse(JSON.stringify(app.run("evolutionPoints(WORKOUTS[2].exercises[4],'maxKg')[0]")));
  assert.equal(point.maxKg,60);
  assert.equal(point.volume,1475);
  assert.equal(point.totalReps,27);
  assert.equal(point.value,60);
});

test('mantém lacunas e duas ocorrências por semana no histórico',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run(`state.data={2:{1:{c_terra_barra:{sets:[{kg:'70',reps:'8'}],done:false}},2:{c_terra_barra:{sets:[{kg:'75',reps:'8'}],done:false}}}}`);
  const points=JSON.parse(JSON.stringify(app.run("evolutionPoints(WORKOUTS[2].exercises[5],'volume')")));
  assert.equal(points.length,16);
  assert.equal(points[0].value,null);
  assert.equal(points[2].label,'S2 · 1º');
  assert.equal(points[2].value,560);
  assert.equal(points[3].value,600);
  app.run("state.tab='evol';evolutionExerciseId='c_terra_barra';evolutionMetric='volume'");
  assert.equal(app.run("renderEvolutionPanel().includes('+40 kg·rep')"),true);
});

test('painel de evolução trata histórico vazio sem erro',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run("state.tab='evol'");
  const panel=app.run('renderEvolutionPanel()');
  assert.equal(panel.includes('Ainda não há dados suficientes'),true);
  assert.equal(panel.includes('role="tabpanel"'),true);
});

test('reinicia toda a periodização e permite desfazer',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run(`state.data={1:{1:{c_terra_barra:{sets:[{kg:'60',reps:'8'}],done:true}},2:{}}};state.week=4;state.session=2;state.tab='ciclo';saveData()`);
  app.run('resetPeriodization()');
  assert.equal(app.run('Object.keys(state.data).length'),0);
  assert.deepEqual(JSON.parse(JSON.stringify(app.run('[state.week,state.session,state.tab]'))),[1,1,'b']);
  assert.equal(app.run('state.archives.length'),1);
  assert.equal(app.run("state.archives[0].data[1][1].c_terra_barra.sets[0].kg"),'60');
  assert.ok(app.store.has('jovilite_snapshot'));
  app.run('undoLastChange()');
  assert.equal(app.run("readEntry(1,'c_terra_barra',1).sets[0].kg"),'60');
  assert.deepEqual(JSON.parse(JSON.stringify(app.run('[state.week,state.session,state.tab]'))),[4,2,'ciclo']);
  assert.equal(app.run('state.archives.length'),0);
});

test('nomeia e exibe a rotina na ordem A, B, C sem trocar os IDs históricos',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  assert.equal(app.run('state.tab'),'b');
  assert.deepEqual(JSON.parse(JSON.stringify(app.run('DAY_TID'))),['','b','a','c','b','a','c']);
  assert.deepEqual(JSON.parse(JSON.stringify(app.run('orderedWorkouts().map(w=>w.tid)'))),['b','a','c']);
  assert.deepEqual(JSON.parse(JSON.stringify(app.run('orderedWorkouts().map(w=>w.label)'))),['A','B','C']);
  assert.deepEqual(JSON.parse(JSON.stringify(app.run('orderedWorkouts().map(w=>w.name)'))),['Peito + Ombros + Tríceps','Costas + Bíceps','Perna']);
  app.run('renderTabs()');
  const tabs=app.run("document.getElementById('tabs').innerHTML");
  assert.ok(tabs.indexOf('Treino A')<tabs.indexOf('Treino B'));
});

test('registra data real e distingue conclusão completa, parcial e sem registro',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run("state.week=1;state.session=1;setVal(1,'c_terra_barra',0,'kg','60')");
  assert.ok(app.run("workoutMeta(1,1,'c',false).startedAt"));
  app.run("toggleDone(1,'c_terra_barra')");
  assert.equal(app.run("workLogStatus(WORKOUTS[2].exercises[5],readEntry(1,'c_terra_barra'))"),'unlogged');
  app.run("toggleDone(1,'c_terra_barra');setVal(1,'c_terra_barra',0,'reps','8');toggleDone(1,'c_terra_barra')");
  assert.equal(app.run("workLogStatus(WORKOUTS[2].exercises[5],readEntry(1,'c_terra_barra'))"),'partial');
  app.run("toggleDone(1,'c_terra_barra');setVal(1,'c_terra_barra',1,'kg','60');setVal(1,'c_terra_barra',1,'reps','8');setVal(1,'c_terra_barra',2,'kg','60');setVal(1,'c_terra_barra',2,'reps','8');toggleDone(1,'c_terra_barra')");
  assert.equal(app.run("workLogStatus(WORKOUTS[2].exercises[5],readEntry(1,'c_terra_barra'))"),'full');
});

test('importação inválida não altera os dados atuais',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run(`state.data={1:{1:{c_terra_barra:{sets:[{kg:'60',reps:'8'}],done:false}},2:{}}};saveData()`);
  app.context.importEvent={target:{files:[{size:100,content:JSON.stringify({app:'outro-app',data:{}})}],value:'arquivo'}};
  app.run('importData(importEvent)');
  assert.equal(app.run("readEntry(1,'c_terra_barra',1).sets[0].kg"),'60');
  assert.equal(app.store.has('jovilite_snapshot'),false);
});

test('importação válida normaliza antes de substituir e cria desfazer',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  const backup={app:'treino-hard-fofo',schemaVersion:1,data:{1:{c_leg_press:{sets:[{kg:'100',reps:'10'}],done:true}}}};
  app.context.importEvent={target:{files:[{size:100,content:JSON.stringify(backup)}],value:'arquivo'}};
  app.run('importData(importEvent)');
  assert.equal(app.run("readEntry(1,'c_leg_press',1).sets[0].kg"),'100');
  assert.equal(app.run("readEntry(1,'c_leg_press',1).done"),true);
  assert.ok(app.store.has('jovilite_snapshot'));
});

test('invalida desfazer ao registrar dados novos após uma limpeza',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run(`state.data={1:{1:{c_terra_barra:{sets:[{kg:'60',reps:'8'}],done:true}},2:{}}};saveData();resetPeriodization()`);
  assert.ok(app.store.has('jovilite_snapshot'));
  app.run("state.week=1;state.session=1;setVal(1,'c_terra_barra',0,'kg','70')");
  assert.equal(app.store.has('jovilite_snapshot'),false);
});

test('preserva conteúdo local corrompido para recuperação',()=>{
  const app=boot({jovilite_data:'{',jovilite_lastopen:todayKey()});
  const recovery=JSON.parse(app.store.get('jovilite_recovery'));
  assert.equal(recovery.raw,'{');
  assert.equal(app.run('Object.keys(state.data).length'),0);
});

test('mescla a gravação mais recente de outra aba antes de editar',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  const external={schemaVersion:2,data:{1:{1:{c_terra_barra:{sets:[{kg:'70',reps:'8'}],done:false}},2:{}}}};
  app.store.set('jovilite_data',JSON.stringify(external));
  app.run("state.week=1;state.session=1;setVal(1,'c_leg_press',0,'kg','100')");
  assert.equal(app.run("readEntry(1,'c_terra_barra',1).sets[0].kg"),'70');
  assert.equal(app.run("readEntry(1,'c_leg_press',1).sets[0].kg"),'100');
});

test('não descarta dados em memória depois de uma falha de armazenamento',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run(`state.data={1:{1:{c_terra_barra:{sets:[{kg:'70',reps:'8'}],done:false}},2:{}}};state.week=1;state.session=1;storageHealthy=false`);
  app.store.set('jovilite_data',JSON.stringify({schemaVersion:2,data:{}}));
  app.run("setVal(1,'c_leg_press',0,'kg','100')");
  assert.equal(app.run("readEntry(1,'c_terra_barra',1).sets[0].kg"),'70');
  assert.equal(app.run("readEntry(1,'c_leg_press',1).sets[0].kg"),'100');
});

test('timer usa prazo absoluto e conclui após suspensão',()=>{
  const app=boot({jovilite_lastopen:todayKey()});
  app.run("startTimer(90,'Descanso');tDeadline=Date.now()-1;tickTimer()");
  assert.equal(app.run('tRem'),0);
  assert.equal(app.run('tFinished'),true);
});
