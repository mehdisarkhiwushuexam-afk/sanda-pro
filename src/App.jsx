import { useState, useEffect, useCallback } from "react";

// ── IWUF 2024 DATA ────────────────────────────────────────────────────────────
const WEIGHT_CATEGORIES = {
  children: [26,28,30,32,34,36,39,42,45,48],
  junior:   [39,42,45,48,52,56,60,64,68,72],
  youth:    [48,52,56,60,65,70,75,80,85,90],
  adult:    [48,52,56,60,65,70,75,80,85,90,100,"100+"],
};
const AGE_GROUPS = [
  { id:"children", label:"Enfants",  age:"9–11" },
  { id:"junior",   label:"Juniors",  age:"12–14" },
  { id:"youth",    label:"Jeunes",   age:"15–17" },
  { id:"adult",    label:"Adultes",  age:"18–40" },
];
const GLOVE_WEIGHTS = (cat,weight,gender)=>{
  const w = parseInt(weight);
  if(cat==="children") return 180;
  if(cat==="junior" && w<=48) return 180;
  if(cat==="junior" && w>=52) return 230;
  if(cat==="youth"||cat==="adult"){
    if(gender==="F") return 230;
    if(w<=65) return 230;
    if(w<=85) return 280;
    return 330;
  }
  return 230;
};

const initialState = {
  page: "dashboard",
  competitors: [],
  brackets: {},
  scores: {},
  events: [],
  nextId: 1,
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
const uid = (s) => `${s}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const initials = (n) => n.split(" ").map(w=>w[0]||"").join("").toUpperCase().slice(0,2);
const avatarColor = (name) => {
  const cols = ["#c8f135","#35d9f5","#f53561","#35f5a0","#f5a835","#a835f5","#f535d9"];
  let h = 0; for(let c of name) h = (h*31+c.charCodeAt(0))%cols.length;
  return cols[h];
};

// ── SCORE HELPERS ─────────────────────────────────────────────────────────────
const calcScore = (events) => {
  let s = 0;
  for(const e of events){
    if(e.type==="punch_head"||e.type==="punch_torso") s+=1;
    else if(e.type==="kick_head"||e.type==="kick_torso"||e.type==="knockdown"||
            e.type==="offplatform"||e.type==="warning_opp"||e.type==="forcible_count") s+=2;
    else if(e.type==="kick_thigh"||e.type==="second_down"||e.type==="admonition_opp") s+=1;
  }
  return s;
};

// ── BRACKET GENERATOR ─────────────────────────────────────────────────────────
const generateBracket = (competitors) => {
  const shuffled = [...competitors].sort(()=>Math.random()-0.5);
  const rounds = [];
  let current = shuffled.map(c=>({id:c.id,name:c.name,team:c.team,winner:false}));
  if(current.length%2!==0) current.push({id:"bye",name:"BYE",team:"",winner:true});
  while(current.length>1){
    const pairs = [];
    for(let i=0;i<current.length;i+=2){
      pairs.push({a:current[i], b:current[i+1]||{id:"bye",name:"BYE",team:"",winner:true}, winner:null});
    }
    rounds.push(pairs);
    current = pairs.map(p=>p.winner||null).filter(Boolean);
    if(current.length===1) break;
    if(current.some(c=>c===null)){
      // next round TBD
      current = pairs.map(()=>null);
    }
  }
  return rounds;
};

// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [state, setState] = useState(initialState);
  const [modal, setModal] = useState(null);
  const [liveMatch, setLiveMatch] = useState(null);

  const set = (patch) => setState(s=>({...s,...(typeof patch==="function"?patch(s):patch)}));

  // NAV
  const nav = (page) => set({page});

  // ADD COMPETITOR
  const addCompetitor = (data) => {
    set(s=>({
      competitors:[...s.competitors,{...data,id:uid("comp"),registeredAt:new Date().toISOString()}],
      nextId: s.nextId+1,
    }));
    setModal(null);
  };

  // GENERATE BRACKETS
  const generateBrackets = (ageGroup, weight, gender) => {
    const key = `${ageGroup}-${gender}-${weight}`;
    const comps = state.competitors.filter(c=>c.ageGroup===ageGroup&&c.weight===String(weight)&&c.gender===gender&&c.checked);
    if(comps.length<2){ alert("Minimum 2 compétiteurs requis"); return; }
    const rounds = generateBracket(comps);
    set(s=>({brackets:{...s.brackets,[key]:{rounds,generated:new Date().toISOString()}}}));
  };

  // LIVE SCORING
  const startMatch = (redId, blueId, label) => {
    setLiveMatch({ redId, blueId, label,
      redEvents:[], blueEvents:[],
      round:1, timer:120, running:false,
      redAdmon:0, blueAdmon:0, redWarn:0, blueWarn:0,
      redRoundsWon:0, blueRoundsWon:0,
      status:"ready",
    });
    nav("live");
  };

  const recordEvent = (side, type) => {
    setLiveMatch(m=>{
      if(!m||m.status==="finished") return m;
      const key = side==="red"?"redEvents":"blueEvents";
      const newEvents = [...m[key],{type,time:m.timer,round:m.round}];
      const patch = {[key]:newEvents};
      // handle admon/warn counters
      if(type==="admonition"){ patch[side==="red"?"redAdmon":"blueAdmon"]=(m[side==="red"?"redAdmon":"blueAdmon"]||0)+1; }
      if(type==="warning"){ patch[side==="red"?"redWarn":"blueWarn"]=(m[side==="red"?"redWarn":"blueWarn"]||0)+1; }
      return {...m,...patch};
    });
  };

  const endRound = () => {
    setLiveMatch(m=>{
      if(!m) return m;
      const rs = calcScore(m.redEvents.filter(e=>e.round===m.round));
      const bs = calcScore(m.blueEvents.filter(e=>e.round===m.round));
      let rw=m.redRoundsWon, bw=m.blueRoundsWon;
      if(rs>bs) rw++;
      else if(bs>rs) bw++;
      if(m.round>=3||(rw>=2||bw>=2)){
        return {...m,running:false,status:"finished",redRoundsWon:rw,blueRoundsWon:bw};
      }
      return {...m,round:m.round+1,timer:120,running:false,redRoundsWon:rw,blueRoundsWon:bw};
    });
  };

  // Timer
  useEffect(()=>{
    if(!liveMatch||!liveMatch.running||liveMatch.status!=="active") return;
    const t = setInterval(()=>{
      setLiveMatch(m=>{
        if(!m||!m.running) return m;
        if(m.timer<=1){ endRound(); return m; }
        return {...m,timer:m.timer-1};
      });
    },1000);
    return ()=>clearInterval(t);
  },[liveMatch?.running]);

  const toggleTimer = () => setLiveMatch(m=>m?{...m,running:!m.running,status:m.status==="ready"?"active":m.status}:m);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>
      <Sidebar page={state.page} nav={nav} />
      <div style={styles.main}>
        <Topbar page={state.page} onAdd={()=>setModal("add")} />
        <div style={styles.content}>
          {state.page==="dashboard" && <Dashboard state={state} onStart={startMatch} nav={nav}/>}
          {state.page==="competitors" && <Competitors state={state} set={set} onAdd={()=>setModal("add")} />}
          {state.page==="weigh-in" && <WeighIn state={state} set={set}/>}
          {state.page==="brackets" && <Brackets state={state} generate={generateBrackets} startMatch={startMatch}/>}
          {state.page==="live" && liveMatch && <LiveScoring match={liveMatch} setMatch={setLiveMatch} onEvent={recordEvent} onToggle={toggleTimer} onEndRound={endRound}/>}
          {state.page==="rankings" && <Rankings state={state}/>}
          {state.page==="forms" && <Forms state={state}/>}
        </div>
      </div>
      {modal==="add" && <AddCompetitorModal onAdd={addCompetitor} onClose={()=>setModal(null)}/>}
    </div>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
const navItems = [
  {id:"dashboard", icon:"⚡", label:"Dashboard"},
  {id:"competitors", icon:"👥", label:"Compétiteurs"},
  {id:"weigh-in", icon:"⚖️", label:"Pesée"},
  {id:"brackets", icon:"🏆", label:"Brackets"},
  {id:"live", icon:"🔴", label:"Score Live"},
  {id:"rankings", icon:"📊", label:"Classements"},
  {id:"forms", icon:"📋", label:"Formulaires"},
];

function Sidebar({page,nav}){
  return(
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <div style={styles.logoMark}>散打</div>
        <div>
          <div style={styles.logoTitle}>SANDA PRO</div>
          <div style={styles.logoSub}>IWUF 2024</div>
        </div>
      </div>
      <nav style={styles.nav}>
        {navItems.map(n=>(
          <button key={n.id} style={{...styles.navItem,...(page===n.id?styles.navActive:{})}} onClick={()=>nav(n.id)}>
            <span style={styles.navIcon}>{n.icon}</span>
            <span>{n.label}</span>
            {page===n.id && <span style={styles.navDot}/>}
          </button>
        ))}
      </nav>
      <div style={styles.sidebarFooter}>
        <div style={styles.iwufBadge}>🥋 Conforme IWUF 2024</div>
      </div>
    </aside>
  );
}

// ── TOPBAR ────────────────────────────────────────────────────────────────────
const pageLabels = {dashboard:"Vue d'ensemble",competitors:"Gestion des Compétiteurs",
  "weigh-in":"Pesée Officielle",brackets:"Tableau des Brackets",
  live:"Score en Direct",rankings:"Classements",forms:"Formulaires Officiels"};

function Topbar({page,onAdd}){
  return(
    <div style={styles.topbar}>
      <div>
        <div style={styles.topbarTitle}>{pageLabels[page]||page}</div>
        <div style={styles.topbarSub}>Règlement IWUF 2024 • {new Date().toLocaleDateString("fr-FR")}</div>
      </div>
      {(page==="competitors"||page==="dashboard") &&
        <button style={styles.btnPrimary} onClick={onAdd}>＋ Inscrire</button>
      }
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({state,onStart,nav}){
  const total = state.competitors.length;
  const checked = state.competitors.filter(c=>c.checked).length;
  const weighed = state.competitors.filter(c=>c.weighed).length;
  const brackets = Object.keys(state.brackets).length;

  const kpis = [
    {label:"Inscrits",value:total,icon:"👥",color:"#c8f135"},
    {label:"Vérifiés",value:checked,icon:"✅",color:"#35f5a0"},
    {label:"Pesés",value:weighed,icon:"⚖️",color:"#35d9f5"},
    {label:"Brackets",value:brackets,icon:"🏆",color:"#f5a835"},
  ];

  return(
    <div>
      <div style={styles.kpiGrid}>
        {kpis.map(k=>(
          <div key={k.label} style={styles.kpiCard}>
            <div style={{...styles.kpiIcon,color:k.color}}>{k.icon}</div>
            <div style={{...styles.kpiValue,color:k.color}}>{k.value}</div>
            <div style={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.grid2}>
        <div style={styles.panel}>
          <div style={styles.panelHead}><span style={styles.panelTitle}>Derniers Inscrits</span></div>
          <div style={styles.panelBody}>
            {state.competitors.slice(-5).reverse().map(c=>(
              <div key={c.id} style={styles.listRow}>
                <div style={{...styles.avatar,background:avatarColor(c.name)}}>{initials(c.name)}</div>
                <div>
                  <div style={styles.listName}>{c.name}</div>
                  <div style={styles.listSub}>{c.team} • {c.ageGroup} • {c.weight}kg • {c.gender==="M"?"♂":"♀"}</div>
                </div>
                <span style={{...styles.badge,...(c.checked?styles.badgeGreen:styles.badgeYellow)}}>
                  {c.checked?"Vérifié":"En attente"}
                </span>
              </div>
            ))}
            {state.competitors.length===0 && <div style={styles.empty}>Aucun compétiteur inscrit</div>}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHead}><span style={styles.panelTitle}>Actions Rapides</span></div>
          <div style={styles.panelBody}>
            {[
              {icon:"👥",label:"Inscrire un compétiteur",action:()=>{}},
              {icon:"⚖️",label:"Gérer la pesée",action:()=>nav("weigh-in")},
              {icon:"🏆",label:"Générer les brackets",action:()=>nav("brackets")},
              {icon:"🔴",label:"Démarrer un match",action:()=>nav("live")},
              {icon:"📋",label:"Formulaires officiels",action:()=>nav("forms")},
            ].map(a=>(
              <button key={a.label} style={styles.actionBtn} onClick={a.action}>
                <span style={styles.actionIcon}>{a.icon}</span>
                <span>{a.label}</span>
                <span style={styles.actionArrow}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHead}><span style={styles.panelTitle}>Répartition par Catégorie</span></div>
        <div style={styles.panelBody}>
          <div style={styles.catGrid}>
            {AGE_GROUPS.map(ag=>{
              const count = state.competitors.filter(c=>c.ageGroup===ag.id).length;
              return(
                <div key={ag.id} style={styles.catCard}>
                  <div style={styles.catAge}>{ag.age} ans</div>
                  <div style={styles.catLabel}>{ag.label}</div>
                  <div style={styles.catCount}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── COMPETITORS ───────────────────────────────────────────────────────────────
function Competitors({state,set,onAdd}){
  const [filter,setFilter]=useState({search:"",ageGroup:"",gender:""});

  const filtered = state.competitors.filter(c=>{
    if(filter.search && !c.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if(filter.ageGroup && c.ageGroup!==filter.ageGroup) return false;
    if(filter.gender && c.gender!==filter.gender) return false;
    return true;
  });

  const toggle = (id,field) => set(s=>({
    competitors:s.competitors.map(c=>c.id===id?{...c,[field]:!c[field]}:c)
  }));
  const remove = (id) => set(s=>({competitors:s.competitors.filter(c=>c.id!==id)}));

  return(
    <div>
      <div style={styles.filterBar}>
        <input style={styles.searchInput} placeholder="🔍 Rechercher..." value={filter.search}
          onChange={e=>setFilter(f=>({...f,search:e.target.value}))}/>
        <select style={styles.select} value={filter.ageGroup} onChange={e=>setFilter(f=>({...f,ageGroup:e.target.value}))}>
          <option value="">Toutes catégories</option>
          {AGE_GROUPS.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select style={styles.select} value={filter.gender} onChange={e=>setFilter(f=>({...f,gender:e.target.value}))}>
          <option value="">Tous genres</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>
        <button style={styles.btnPrimary} onClick={onAdd}>＋ Inscrire</button>
      </div>

      <div style={styles.panel}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              {["Compétiteur","Équipe","Catégorie","Poids","Gants","Genre","Vérifié","Pesé","Actions"]
                .map(h=><th key={h} style={styles.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c=>(
              <tr key={c.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={styles.cellComp}>
                    <div style={{...styles.avatarSm,background:avatarColor(c.name)}}>{initials(c.name)}</div>
                    <div>
                      <div style={{fontWeight:600}}>{c.name}</div>
                      <div style={{fontSize:11,color:"#888"}}>{c.nationality}</div>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>{c.team}</td>
                <td style={styles.td}><span style={styles.tag}>{c.ageGroup}</span></td>
                <td style={styles.td}><b>{c.weight}kg</b></td>
                <td style={styles.td}>{GLOVE_WEIGHTS(c.ageGroup,c.weight,c.gender)}g</td>
                <td style={styles.td}>{c.gender==="M"?"♂ Masc":"♀ Fém"}</td>
                <td style={styles.td}>
                  <button style={{...styles.toggleBtn,...(c.checked?styles.toggleOn:{})}} onClick={()=>toggle(c.id,"checked")}>
                    {c.checked?"✓":"○"}
                  </button>
                </td>
                <td style={styles.td}>
                  <button style={{...styles.toggleBtn,...(c.weighed?styles.toggleOn:{})}} onClick={()=>toggle(c.id,"weighed")}>
                    {c.weighed?"✓":"○"}
                  </button>
                </td>
                <td style={styles.td}>
                  <button style={styles.btnDanger} onClick={()=>remove(c.id)}>✕</button>
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={9} style={{...styles.td,...styles.empty}}>Aucun compétiteur trouvé</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── WEIGH-IN ──────────────────────────────────────────────────────────────────
function WeighIn({state,set}){
  const [selectedGroup,setGroup]=useState("adult");
  const comps = state.competitors.filter(c=>c.ageGroup===selectedGroup);

  const updateWeight = (id,val) => set(s=>({
    competitors:s.competitors.map(c=>c.id===id?{...c,actualWeight:val}:c)
  }));
  const markWeighed = (id) => set(s=>({
    competitors:s.competitors.map(c=>c.id===id?{...c,weighed:true}:c)
  }));

  return(
    <div>
      <div style={styles.tabBar}>
        {AGE_GROUPS.map(ag=>(
          <button key={ag.id} style={{...styles.tab,...(selectedGroup===ag.id?styles.tabActive:{})}} onClick={()=>setGroup(ag.id)}>
            {ag.label} <span style={styles.tabBadge}>{state.competitors.filter(c=>c.ageGroup===ag.id).length}</span>
          </button>
        ))}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHead}>
          <span style={styles.panelTitle}>Pesée — {AGE_GROUPS.find(a=>a.id===selectedGroup)?.label}</span>
          <div style={styles.weighStats}>
            <span style={{color:"#35f5a0"}}>{comps.filter(c=>c.weighed).length} pesés</span>
            <span style={{color:"#888"}}>/</span>
            <span>{comps.length} total</span>
          </div>
        </div>
        <table style={styles.table}>
          <thead><tr style={styles.thead}>
            {["Compétiteur","Poids inscrit","Poids réel","Statut","Gants requis","Action"]
              .map(h=><th key={h} style={styles.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {comps.map(c=>{
              const actual = parseFloat(c.actualWeight||0);
              const target = parseFloat(c.weight);
              const ok = actual>0 && actual<=target;
              return(
                <tr key={c.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.cellComp}>
                      <div style={{...styles.avatarSm,background:avatarColor(c.name)}}>{initials(c.name)}</div>
                      <div><div style={{fontWeight:600}}>{c.name}</div><div style={{fontSize:11,color:"#888"}}>{c.team}</div></div>
                    </div>
                  </td>
                  <td style={styles.td}><b>{c.weight}kg</b></td>
                  <td style={styles.td}>
                    <input type="number" step="0.01" style={styles.weightInput}
                      value={c.actualWeight||""} placeholder="kg"
                      onChange={e=>updateWeight(c.id,e.target.value)}/>
                  </td>
                  <td style={styles.td}>
                    {c.weighed
                      ? <span style={{...styles.badge,...styles.badgeGreen}}>✓ Validé — {c.actualWeight}kg</span>
                      : actual>0
                        ? ok
                          ? <span style={{...styles.badge,...styles.badgeGreen}}>Conforme</span>
                          : <span style={{...styles.badge,...styles.badgeRed}}>Hors catégorie</span>
                        : <span style={{...styles.badge,...styles.badgeGray}}>En attente</span>
                    }
                  </td>
                  <td style={styles.td}>{GLOVE_WEIGHTS(c.ageGroup,c.weight,c.gender)}g</td>
                  <td style={styles.td}>
                    {!c.weighed && ok &&
                      <button style={styles.btnSuccess} onClick={()=>markWeighed(c.id)}>Valider ✓</button>
                    }
                  </td>
                </tr>
              );
            })}
            {comps.length===0 && <tr><td colSpan={6} style={{...styles.td,...styles.empty}}>Aucun compétiteur dans cette catégorie</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BRACKETS ──────────────────────────────────────────────────────────────────
function Brackets({state,generate,startMatch}){
  const [sel,setSel]=useState({ageGroup:"adult",weight:"",gender:"M"});

  const key = `${sel.ageGroup}-${sel.gender}-${sel.weight}`;
  const bracket = state.brackets[key];
  const weights = WEIGHT_CATEGORIES[sel.ageGroup]||[];
  const eligible = state.competitors.filter(c=>
    c.ageGroup===sel.ageGroup&&c.weight===String(sel.weight)&&c.gender===sel.gender&&c.checked
  );

  return(
    <div>
      <div style={styles.panel}>
        <div style={styles.panelBody}>
          <div style={styles.bracketControls}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Catégorie d'âge</label>
              <select style={styles.select} value={sel.ageGroup} onChange={e=>setSel(s=>({...s,ageGroup:e.target.value,weight:""}))}>
                {AGE_GROUPS.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Genre</label>
              <select style={styles.select} value={sel.gender} onChange={e=>setSel(s=>({...s,gender:e.target.value}))}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Catégorie de poids</label>
              <select style={styles.select} value={sel.weight} onChange={e=>setSel(s=>({...s,weight:e.target.value}))}>
                <option value="">-- Sélectionner --</option>
                {weights.map(w=><option key={w} value={w}>{w}kg</option>)}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>&nbsp;</label>
              <button style={styles.btnPrimary} onClick={()=>sel.weight&&generate(sel.ageGroup,sel.weight,sel.gender)}
                disabled={!sel.weight||eligible.length<2}>
                🎲 Générer Bracket
              </button>
            </div>
          </div>
          {sel.weight && <div style={{color:"#888",fontSize:13,marginTop:8}}>
            {eligible.length} compétiteur(s) éligible(s) dans cette catégorie
          </div>}
        </div>
      </div>

      {bracket ? (
        <div style={styles.panel}>
          <div style={styles.panelHead}>
            <span style={styles.panelTitle}>Bracket — {sel.ageGroup} {sel.gender==="M"?"♂":"♀"} {sel.weight}kg</span>
            <span style={{fontSize:12,color:"#888"}}>Généré le {new Date(bracket.generated).toLocaleString("fr-FR")}</span>
          </div>
          <div style={styles.panelBody}>
            <BracketView rounds={bracket.rounds} onStart={startMatch} label={`${sel.ageGroup} ${sel.gender} ${sel.weight}kg`}/>
          </div>
        </div>
      ) : sel.weight && (
        <div style={styles.emptyPanel}>
          <div style={styles.emptyIcon}>🏆</div>
          <div>Aucun bracket généré pour cette catégorie</div>
          <div style={{fontSize:12,color:"#888",marginTop:4}}>Cliquez "Générer Bracket" après la pesée</div>
        </div>
      )}
    </div>
  );
}

function BracketView({rounds,onStart,label}){
  return(
    <div style={styles.bracketWrap}>
      {rounds.map((pairs,ri)=>(
        <div key={ri} style={styles.bracketRound}>
          <div style={styles.roundLabel}>
            {ri===0?"1er Tour":ri===rounds.length-1?"Finale":`Tour ${ri+1}`}
          </div>
          {pairs.map((pair,pi)=>(
            <div key={pi} style={styles.matchCard}>
              <CompetitorSlot comp={pair.a} winner={pair.winner?.id===pair.a?.id}/>
              <div style={styles.vsLine}>VS</div>
              <CompetitorSlot comp={pair.b} winner={pair.winner?.id===pair.b?.id}/>
              {pair.a?.id!=="bye"&&pair.b?.id!=="bye"&&!pair.winner && (
                <button style={styles.startBtn} onClick={()=>onStart(pair.a.id,pair.b.id,label)}>
                  ▶ Score Live
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CompetitorSlot({comp,winner}){
  if(!comp) return <div style={styles.emptySlot}>TBD</div>;
  if(comp.id==="bye") return <div style={{...styles.compSlot,opacity:0.4}}>BYE</div>;
  return(
    <div style={{...styles.compSlot,...(winner?styles.compWinner:{})}}>
      <div style={{...styles.avatarSm,background:avatarColor(comp.name),width:22,height:22,fontSize:9}}>{initials(comp.name)}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600}}>{comp.name}</div>
        <div style={{fontSize:11,color:"#888"}}>{comp.team}</div>
      </div>
      {winner && <span style={{color:"#c8f135",fontSize:14}}>🏅</span>}
    </div>
  );
}

// ── LIVE SCORING ──────────────────────────────────────────────────────────────
function LiveScoring({match,setMatch,onEvent,onToggle,onEndRound}){
  const rs = calcScore(match.redEvents.filter(e=>e.round===match.round));
  const bs = calcScore(match.blueEvents.filter(e=>e.round===match.round));
  const tTotal = calcScore(match.redEvents);
  const bTotal = calcScore(match.blueEvents);
  const mins = Math.floor(match.timer/60);
  const secs = String(match.timer%60).padStart(2,"0");

  const scoreActions = [
    {label:"Poing — Tête/Torse",type:"punch_head",pts:1},
    {label:"Pied — Tête/Torse",type:"kick_head",pts:2},
    {label:"Pied — Cuisse",type:"kick_thigh",pts:1},
    {label:"Mise au sol",type:"knockdown",pts:2},
    {label:"Hors plateforme",type:"offplatform",pts:2},
  ];
  const penaltyActions = [
    {label:"Avertissement → Adv +1",type:"admonition",color:"#f5c842"},
    {label:"Pénalité → Adv +2",type:"warning",color:"#f57742"},
  ];

  return(
    <div>
      <div style={styles.liveHeader}>
        <div style={styles.liveRound}>Round {match.round} / 3</div>
        <div style={{...styles.liveTimer,...(match.timer<=30?{color:"#f53561",animation:"pulse 1s infinite"}:{})}}>
          {mins}:{secs}
        </div>
        <div style={styles.liveStatus}>
          {match.status==="finished"?"🏁 TERMINÉ":match.running?"🔴 EN COURS":"⏸ PAUSE"}
        </div>
      </div>

      <div style={styles.scoreBoard}>
        <ScoreColumn side="red" color="#f53561" label="ROUGE" name="Compétiteur Rouge"
          score={rs} total={tTotal} admon={match.redAdmon} warn={match.redWarn}
          roundsWon={match.redRoundsWon} actions={scoreActions} penalties={penaltyActions}
          onEvent={t=>onEvent("red",t)} disabled={!match.running||match.status==="finished"}/>
        <div style={styles.scoreMid}>
          <div style={styles.scoreMidRounds}>
            <div style={{color:"#f53561",fontSize:28,fontWeight:900}}>{match.redRoundsWon}</div>
            <div style={{color:"#888",fontSize:14}}>Rounds</div>
            <div style={{color:"#35d9f5",fontSize:28,fontWeight:900}}>{match.blueRoundsWon}</div>
          </div>
          <button style={{...styles.timerBtn,...(match.running?styles.timerBtnPause:{})}}
            onClick={onToggle} disabled={match.status==="finished"}>
            {match.running?"⏸":"▶"}
          </button>
          {!match.running && match.status!=="finished" &&
            <button style={styles.endRoundBtn} onClick={onEndRound}>
              Fin Round {match.round}
            </button>
          }
          {match.status==="finished" && <WinnerBanner red={match.redRoundsWon} blue={match.blueRoundsWon}/>}
        </div>
        <ScoreColumn side="blue" color="#35d9f5" label="BLEU" name="Compétiteur Bleu"
          score={bs} total={bTotal} admon={match.blueAdmon} warn={match.blueWarn}
          roundsWon={match.blueRoundsWon} actions={scoreActions} penalties={penaltyActions}
          onEvent={t=>onEvent("blue",t)} disabled={!match.running||match.status==="finished"}/>
      </div>

      <div style={styles.eventLog}>
        <div style={styles.panelTitle}>Journal des événements — Round {match.round}</div>
        <div style={{maxHeight:140,overflowY:"auto",marginTop:8}}>
          {[...match.redEvents,...match.blueEvents]
            .filter(e=>e.round===match.round)
            .sort((a,b)=>b.time-a.time)
            .map((e,i)=>(
              <div key={i} style={styles.eventRow}>
                <span style={{color:match.redEvents.includes(e)?"#f53561":"#35d9f5",fontWeight:700}}>
                  {match.redEvents.includes(e)?"ROUGE":"BLEU"}
                </span>
                <span style={{color:"#ccc"}}>{e.type.replace(/_/g," ")}</span>
                <span style={{color:"#888",marginLeft:"auto"}}>{Math.floor(e.time/60)}:{String(e.time%60).padStart(2,"0")}</span>
              </div>
            ))}
          {match.redEvents.filter(e=>e.round===match.round).length===0 &&
           match.blueEvents.filter(e=>e.round===match.round).length===0 &&
            <div style={styles.empty}>Aucun événement ce round</div>}
        </div>
      </div>
    </div>
  );
}

function ScoreColumn({side,color,label,name,score,total,admon,warn,roundsWon,actions,penalties,onEvent,disabled}){
  return(
    <div style={{...styles.scoreCol,borderColor:color+"44"}}>
      <div style={{...styles.scoreLabel,color}}>{label}</div>
      <div style={{...styles.scoreBig,color}}>{score}</div>
      <div style={styles.scoreSubInfo}>
        <span>Total: <b>{total}</b></span>
        <span>⚠️{warn}</span>
        <span>🟡{admon}</span>
      </div>
      <div style={styles.actionGroup}>
        <div style={styles.actionGroupLabel}>POINTS</div>
        {actions.map(a=>(
          <button key={a.type} style={{...styles.scoreBtn,...(disabled?styles.scoreBtnDisabled:{})}}
            onClick={()=>!disabled&&onEvent(a.type)} disabled={disabled}>
            <span>+{a.pts}</span> {a.label}
          </button>
        ))}
      </div>
      <div style={styles.actionGroup}>
        <div style={styles.actionGroupLabel}>PÉNALITÉS</div>
        {penalties.map(a=>(
          <button key={a.type} style={{...styles.penaltyBtn,borderColor:a.color,...(disabled?{opacity:0.4}:{})}}
            onClick={()=>!disabled&&onEvent(a.type)} disabled={disabled}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function WinnerBanner({red,blue}){
  const winner = red>blue?"🔴 ROUGE GAGNE":blue>red?"🔵 BLEU GAGNE":"ÉGALITÉ";
  const color = red>blue?"#f53561":blue>red?"#35d9f5":"#c8f135";
  return(
    <div style={{...styles.winnerBanner,color,borderColor:color}}>
      🏆 {winner}
    </div>
  );
}

// ── RANKINGS ──────────────────────────────────────────────────────────────────
function Rankings({state}){
  const grouped = {};
  state.competitors.forEach(c=>{
    const k = `${c.ageGroup}-${c.gender}-${c.weight}`;
    if(!grouped[k]) grouped[k]={ageGroup:c.ageGroup,gender:c.gender,weight:c.weight,comps:[]};
    grouped[k].comps.push(c);
  });

  return(
    <div>
      {Object.entries(grouped).length===0 && (
        <div style={styles.emptyPanel}>
          <div style={styles.emptyIcon}>📊</div>
          <div>Aucun compétiteur inscrit</div>
        </div>
      )}
      {Object.entries(grouped).map(([key,g])=>(
        <div key={key} style={{...styles.panel,marginBottom:16}}>
          <div style={styles.panelHead}>
            <span style={styles.panelTitle}>
              {AGE_GROUPS.find(a=>a.id===g.ageGroup)?.label} — {g.gender==="M"?"♂":"♀"} — {g.weight}kg
            </span>
            <span style={{fontSize:12,color:"#888"}}>{g.comps.length} compétiteurs</span>
          </div>
          <table style={styles.table}>
            <thead><tr style={styles.thead}>
              {["#","Compétiteur","Équipe","Nationalité","Statut"].map(h=><th key={h} style={styles.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {g.comps.map((c,i)=>(
                <tr key={c.id} style={styles.tr}>
                  <td style={{...styles.td,fontWeight:700,color:i<3?"#c8f135":"#888",fontSize:i<3?18:14}}>{i+1}</td>
                  <td style={styles.td}>
                    <div style={styles.cellComp}>
                      <div style={{...styles.avatarSm,background:avatarColor(c.name)}}>{initials(c.name)}</div>
                      <div style={{fontWeight:600}}>{c.name}</div>
                    </div>
                  </td>
                  <td style={styles.td}>{c.team}</td>
                  <td style={styles.td}>{c.nationality}</td>
                  <td style={styles.td}>
                    <span style={{...styles.badge,...(c.weighed?styles.badgeGreen:c.checked?styles.badgeBlue:styles.badgeGray)}}>
                      {c.weighed?"Pesé":c.checked?"Vérifié":"Inscrit"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── FORMS ─────────────────────────────────────────────────────────────────────
function Forms({state}){
  const printReg = () => {
    const rows = state.competitors.map((c,i)=>
      `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.gender==="M"?"M":"F"}</td><td>${c.birthDate||"—"}</td><td>${c.weight}kg</td><td>${c.ageGroup}</td></tr>`
    ).join("");
    const win = window.open("","_blank");
    win.document.write(`<html><head><title>Feuille d'inscription IWUF</title>
    <style>body{font-family:sans-serif;padding:20px} table{border-collapse:collapse;width:100%} 
    th,td{border:1px solid #333;padding:6px 10px} th{background:#222;color:#fff} h2{margin-bottom:4px}</style></head>
    <body><h2>武术散打比赛报名表 — Wushu Sanda Competition Registration Form</h2>
    <p>Date: ${new Date().toLocaleDateString("fr-FR")}</p>
    <table><thead><tr><th>#</th><th>Nom</th><th>Genre</th><th>Naissance</th><th>Poids</th><th>Catégorie</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`);
    win.print();
  };

  const formsList = [
    {id:"reg",label:"Feuille d'Inscription",icon:"📝",sub:"Appendix 9 — IWUF 2024",action:printReg},
    {id:"schedule",label:"Calendrier des Compétitions",icon:"📅",sub:"Appendix 7 — IWUF 2024",action:()=>alert("Export calendrier")},
    {id:"match",label:"Feuille de Match (Séquence)",icon:"📋",sub:"Appendix 8 — IWUF 2024",action:()=>alert("Export séquences")},
    {id:"record",label:"Tableau de Bord du Recorder",icon:"📊",sub:"Appendix 10 — IWUF 2024",action:()=>alert("Export recorder")},
    {id:"sideline",label:"Fiche Juge de Côté",icon:"⚖️",sub:"Appendix 11 — IWUF 2024",action:()=>alert("Export juge")},
    {id:"rr",label:"Classement Round-Robin",icon:"🔄",sub:"Appendix 2 — IWUF 2024",action:()=>alert("Export round-robin")},
  ];

  return(
    <div>
      <div style={styles.panel}>
        <div style={styles.panelHead}><span style={styles.panelTitle}>Formulaires Officiels IWUF 2024</span></div>
        <div style={styles.panelBody}>
          <div style={styles.formsGrid}>
            {formsList.map(f=>(
              <button key={f.id} style={styles.formCard} onClick={f.action}>
                <div style={styles.formIcon}>{f.icon}</div>
                <div style={styles.formLabel}>{f.label}</div>
                <div style={styles.formSub}>{f.sub}</div>
                <div style={styles.formAction}>Imprimer / Exporter →</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHead}><span style={styles.panelTitle}>Règles de Score — Référence Rapide</span></div>
        <div style={styles.panelBody}>
          <div style={styles.rulesGrid}>
            <div style={styles.ruleCard}>
              <div style={{...styles.rulePts,color:"#c8f135"}}>+2 pts</div>
              <ul style={styles.ruleList}>
                <li>Coup de pied — Tête/Torse</li>
                <li>Adversaire mis au sol</li>
                <li>Adversaire hors plateforme</li>
                <li>Lecture forcée reçue</li>
                <li>Avertissement reçu (adversaire)</li>
              </ul>
            </div>
            <div style={styles.ruleCard}>
              <div style={{...styles.rulePts,color:"#35d9f5"}}>+1 pt</div>
              <ul style={styles.ruleList}>
                <li>Coup de poing — Tête/Torse</li>
                <li>Coup de pied — Cuisse</li>
                <li>Adversaire tombe en 2ème</li>
                <li>Admonition reçue (adversaire)</li>
              </ul>
            </div>
            <div style={styles.ruleCard}>
              <div style={{...styles.rulePts,color:"#f53561"}}>Interdit</div>
              <ul style={styles.ruleList}>
                <li>Tête, coude, genou</li>
                <li>Frapper arrière de la tête</li>
                <li>Frapper la nuque / le bas</li>
                <li>Frapper adversaire à terre</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ADD COMPETITOR MODAL ──────────────────────────────────────────────────────
function AddCompetitorModal({onAdd,onClose}){
  const [form,setForm]=useState({name:"",team:"",nationality:"",birthDate:"",gender:"M",ageGroup:"adult",weight:""});
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const weights = WEIGHT_CATEGORIES[form.ageGroup]||[];
  const valid = form.name&&form.team&&form.weight&&form.ageGroup;

  return(
    <div style={styles.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHead}>
          <span style={styles.modalTitle}>🥋 Inscrire un Compétiteur</span>
          <button style={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nom complet *</label>
              <input style={styles.input} value={form.name} onChange={e=>f("name",e.target.value)} placeholder="Prénom Nom"/>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Équipe / Pays *</label>
              <input style={styles.input} value={form.team} onChange={e=>f("team",e.target.value)} placeholder="Ex: France"/>
            </div>
          </div>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nationalité</label>
              <input style={styles.input} value={form.nationality} onChange={e=>f("nationality",e.target.value)} placeholder="Ex: FRA"/>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Date de naissance</label>
              <input style={styles.input} type="date" value={form.birthDate} onChange={e=>f("birthDate",e.target.value)}/>
            </div>
          </div>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Genre *</label>
              <select style={styles.select} value={form.gender} onChange={e=>f("gender",e.target.value)}>
                <option value="M">♂ Masculin</option>
                <option value="F">♀ Féminin</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Catégorie d'âge *</label>
              <select style={styles.select} value={form.ageGroup} onChange={e=>f("ageGroup",e.target.value)}>
                {AGE_GROUPS.map(a=><option key={a.id} value={a.id}>{a.label} ({a.age} ans)</option>)}
              </select>
            </div>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Catégorie de poids *</label>
            <select style={styles.select} value={form.weight} onChange={e=>f("weight",e.target.value)}>
              <option value="">-- Sélectionner --</option>
              {weights.map(w=><option key={w} value={w}>{w}kg</option>)}
            </select>
          </div>
          {form.weight && (
            <div style={styles.gloveInfo}>
              ⚖️ Poids des gants requis : <b>{GLOVE_WEIGHTS(form.ageGroup,form.weight,form.gender)}g</b>
              &nbsp;—&nbsp;Conforme IWUF 2024
            </div>
          )}
        </div>
        <div style={styles.modalFoot}>
          <button style={styles.btnGhost} onClick={onClose}>Annuler</button>
          <button style={{...styles.btnPrimary,...(!valid?{opacity:0.5}:{})}}
            onClick={()=>valid&&onAdd(form)} disabled={!valid}>
            ✓ Inscrire
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════
const C = {
  bg:"#080b10", surface:"#0e1219", surface2:"#141922", border:"#1e2735",
  accent:"#c8f135", accent2:"#35d9f5", accent3:"#f53561", accent4:"#35f5a0",
  text:"#eef2ff", muted:"#6b7a99",
};

const styles = {
  app:{display:"flex",minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Mono','Courier New',monospace"},
  sidebar:{width:220,minHeight:"100vh",background:C.surface,borderRight:`1px solid ${C.border}`,
    display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",overflowY:"auto"},
  logo:{padding:"20px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10},
  logoMark:{background:C.accent,color:"#000",fontWeight:900,fontSize:20,width:38,height:38,
    borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  logoTitle:{fontWeight:900,fontSize:13,letterSpacing:2,color:C.accent},
  logoSub:{fontSize:10,color:C.muted,letterSpacing:1},
  nav:{padding:"12px 8px",flex:1,display:"flex",flexDirection:"column",gap:2},
  navItem:{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",
    background:"transparent",color:C.muted,cursor:"pointer",fontSize:12.5,fontWeight:500,
    textAlign:"left",transition:"all .15s",fontFamily:"inherit"},
  navActive:{background:`${C.accent}15`,color:C.accent,fontWeight:700},
  navIcon:{fontSize:15,width:18,textAlign:"center"},
  navDot:{width:4,height:4,borderRadius:"50%",background:C.accent,marginLeft:"auto"},
  sidebarFooter:{padding:"12px 16px",borderTop:`1px solid ${C.border}`},
  iwufBadge:{fontSize:10,color:C.muted,textAlign:"center"},
  main:{flex:1,display:"flex",flexDirection:"column",minWidth:0},
  topbar:{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 24px",
    display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10},
  topbarTitle:{fontWeight:700,fontSize:16,color:C.text},
  topbarSub:{fontSize:11,color:C.muted,marginTop:2},
  content:{padding:"20px 24px",flex:1,overflowY:"auto"},
  // KPI
  kpiGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20},
  kpiCard:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px 16px",textAlign:"center"},
  kpiIcon:{fontSize:24,marginBottom:6},
  kpiValue:{fontSize:36,fontWeight:900,letterSpacing:-1,lineHeight:1},
  kpiLabel:{fontSize:11,color:C.muted,marginTop:4,textTransform:"uppercase",letterSpacing:1},
  grid2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16},
  // Panel
  panel:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:16},
  panelHead:{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",
    alignItems:"center",justifyContent:"space-between"},
  panelTitle:{fontWeight:700,fontSize:13,letterSpacing:.5,color:C.text},
  panelBody:{padding:"14px 16px"},
  // List
  listRow:{display:"flex",alignItems:"center",gap:10,padding:"8px 0",
    borderBottom:`1px solid ${C.border}`},
  listName:{fontWeight:600,fontSize:13},
  listSub:{fontSize:11,color:C.muted},
  // Badges
  badge:{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600},
  badgeGreen:{background:"#35f5a015",color:"#35f5a0"},
  badgeBlue:{background:"#35d9f515",color:"#35d9f5"},
  badgeYellow:{background:"#f5c84215",color:"#f5c842"},
  badgeRed:{background:"#f5356115",color:"#f53561"},
  badgeGray:{background:`${C.border}`,color:C.muted},
  // Avatar
  avatar:{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",
    justifyContent:"center",fontSize:12,fontWeight:900,color:"#000",flexShrink:0},
  avatarSm:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",
    justifyContent:"center",fontSize:10,fontWeight:900,color:"#000",flexShrink:0},
  // Table
  table:{width:"100%",borderCollapse:"collapse",fontSize:13},
  thead:{background:C.surface2},
  th:{padding:"9px 12px",textAlign:"left",fontSize:11,color:C.muted,
    textTransform:"uppercase",letterSpacing:1,fontWeight:500,
    borderBottom:`1px solid ${C.border}`},
  tr:{borderBottom:`1px solid ${C.border}`,transition:"background .12s"},
  td:{padding:"10px 12px",verticalAlign:"middle"},
  cellComp:{display:"flex",alignItems:"center",gap:8},
  tag:{background:`${C.accent}20`,color:C.accent,padding:"2px 8px",borderRadius:4,
    fontSize:11,fontWeight:700},
  // Buttons
  btnPrimary:{background:C.accent,color:"#000",border:"none",borderRadius:8,
    padding:"9px 18px",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  btnGhost:{background:"transparent",color:C.text,border:`1px solid ${C.border}`,
    borderRadius:8,padding:"9px 18px",cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  btnSuccess:{background:"#35f5a020",color:"#35f5a0",border:"1px solid #35f5a040",
    borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,fontFamily:"inherit"},
  btnDanger:{background:"#f5356115",color:"#f53561",border:"1px solid #f5356130",
    borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"},
  toggleBtn:{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,
    background:"transparent",color:C.muted,cursor:"pointer",fontSize:14,fontFamily:"inherit"},
  toggleOn:{background:"#35f5a020",color:"#35f5a0",borderColor:"#35f5a040"},
  // Filter
  filterBar:{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"},
  searchInput:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,
    padding:"9px 14px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",flex:1,minWidth:160},
  select:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,
    padding:"9px 14px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",cursor:"pointer"},
  input:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,
    padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  weightInput:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:6,
    padding:"6px 10px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",width:80},
  // Tabs
  tabBar:{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:16},
  tab:{padding:"10px 18px",border:"none",background:"transparent",color:C.muted,
    cursor:"pointer",fontSize:13,borderBottom:"2px solid transparent",fontFamily:"inherit",transition:"all .15s"},
  tabActive:{color:C.accent,borderBottomColor:C.accent},
  tabBadge:{background:`${C.border}`,borderRadius:10,padding:"1px 7px",fontSize:11,marginLeft:5},
  // Weigh-in
  weighStats:{display:"flex",gap:8,fontSize:13,alignItems:"center"},
  // Brackets
  bracketControls:{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"},
  formGroup:{display:"flex",flexDirection:"column",gap:4},
  label:{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:.5},
  bracketWrap:{display:"flex",gap:20,overflowX:"auto",paddingBottom:12},
  bracketRound:{display:"flex",flexDirection:"column",gap:16,minWidth:200},
  roundLabel:{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1.5,
    textAlign:"center",marginBottom:4,padding:"4px 0"},
  matchCard:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,
    padding:"10px",display:"flex",flexDirection:"column",gap:4},
  compSlot:{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",
    borderRadius:7,background:`${C.border}20`,minHeight:36},
  compWinner:{background:`${C.accent}15`,borderLeft:`3px solid ${C.accent}`},
  emptySlot:{padding:"8px",color:C.muted,fontSize:12,textAlign:"center"},
  vsLine:{textAlign:"center",fontSize:10,color:C.muted,letterSpacing:1},
  startBtn:{background:C.accent,color:"#000",border:"none",borderRadius:6,
    padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,marginTop:4,fontFamily:"inherit"},
  // Live Scoring
  liveHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",
    background:C.surface,borderRadius:12,padding:"16px 24px",marginBottom:16,
    border:`1px solid ${C.border}`},
  liveRound:{fontSize:13,color:C.muted,fontWeight:600,letterSpacing:1},
  liveTimer:{fontSize:52,fontWeight:900,letterSpacing:-2,color:C.text,fontVariantNumeric:"tabular-nums"},
  liveStatus:{fontSize:13,fontWeight:700,letterSpacing:1},
  scoreBoard:{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:12,marginBottom:16},
  scoreCol:{background:C.surface,border:"1px solid",borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",gap:8},
  scoreLabel:{fontSize:12,fontWeight:900,letterSpacing:2,textAlign:"center"},
  scoreBig:{fontSize:64,fontWeight:900,textAlign:"center",letterSpacing:-3,lineHeight:1},
  scoreSubInfo:{display:"flex",gap:12,justifyContent:"center",fontSize:12,color:C.muted},
  scoreMid:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,minWidth:100},
  scoreMidRounds:{display:"flex",flexDirection:"column",alignItems:"center"},
  timerBtn:{width:56,height:56,borderRadius:"50%",border:`2px solid ${C.accent}`,background:"transparent",
    color:C.accent,fontSize:22,cursor:"pointer",fontFamily:"inherit"},
  timerBtnPause:{background:`${C.accent3}20`,borderColor:C.accent3,color:C.accent3},
  endRoundBtn:{background:`${C.accent}20`,color:C.accent,border:`1px solid ${C.accent}40`,
    borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"},
  winnerBanner:{border:"2px solid",borderRadius:10,padding:"10px 14px",textAlign:"center",
    fontWeight:900,fontSize:14,letterSpacing:1},
  actionGroup:{display:"flex",flexDirection:"column",gap:4},
  actionGroupLabel:{fontSize:9,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:2},
  scoreBtn:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px",
    color:C.text,cursor:"pointer",fontSize:11,textAlign:"left",fontFamily:"inherit",display:"flex",gap:6,alignItems:"center"},
  scoreBtnDisabled:{opacity:0.4,cursor:"not-allowed"},
  penaltyBtn:{background:"transparent",border:"1px solid",borderRadius:7,padding:"7px 10px",
    cursor:"pointer",fontSize:11,textAlign:"left",fontFamily:"inherit",color:C.text},
  eventLog:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"},
  eventRow:{display:"flex",gap:10,padding:"4px 0",borderBottom:`1px solid ${C.border}`,fontSize:12},
  // Actions
  actionBtn:{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",border:`1px solid ${C.border}`,
    borderRadius:8,background:"transparent",color:C.text,cursor:"pointer",fontSize:13,
    width:"100%",marginBottom:6,fontFamily:"inherit",transition:"all .15s"},
  actionIcon:{fontSize:16,width:22,textAlign:"center"},
  actionArrow:{marginLeft:"auto",color:C.muted},
  // Cat cards
  catGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10},
  catCard:{background:C.surface2,borderRadius:10,padding:"14px",textAlign:"center",
    border:`1px solid ${C.border}`},
  catAge:{fontSize:11,color:C.muted},
  catLabel:{fontWeight:700,fontSize:14,marginTop:2},
  catCount:{fontSize:32,fontWeight:900,color:C.accent,marginTop:6},
  // Forms
  formsGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12},
  formCard:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,
    padding:"16px",cursor:"pointer",textAlign:"left",fontFamily:"inherit"},
  formIcon:{fontSize:24,marginBottom:8},
  formLabel:{fontWeight:700,fontSize:13,color:C.text,marginBottom:2},
  formSub:{fontSize:11,color:C.muted,marginBottom:8},
  formAction:{fontSize:11,color:C.accent},
  rulesGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12},
  ruleCard:{background:C.surface2,borderRadius:10,padding:"14px",border:`1px solid ${C.border}`},
  rulePts:{fontSize:22,fontWeight:900,marginBottom:8},
  ruleList:{margin:0,paddingLeft:16,color:C.muted,fontSize:12,lineHeight:1.7},
  // Modal
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(4px)",
    zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"},
  modal:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,width:520,
    maxHeight:"90vh",overflowY:"auto"},
  modalHead:{padding:"18px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",
    alignItems:"center",justifyContent:"space-between"},
  modalTitle:{fontWeight:700,fontSize:15},
  modalClose:{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer",fontFamily:"inherit"},
  modalBody:{padding:"20px"},
  modalFoot:{padding:"16px 20px",borderTop:`1px solid ${C.border}`,display:"flex",
    justifyContent:"flex-end",gap:10},
  formRow:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12},
  gloveInfo:{background:`${C.accent}10`,border:`1px solid ${C.accent}30`,borderRadius:8,
    padding:"10px 14px",fontSize:12,color:C.accent,marginTop:4},
  // Misc
  empty:{color:C.muted,fontSize:13,textAlign:"center",padding:"20px 0"},
  emptyPanel:{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
    padding:"40px",textAlign:"center",color:C.muted},
  emptyIcon:{fontSize:40,marginBottom:12},
};
