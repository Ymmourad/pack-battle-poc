"use strict";
/* ============================================================
   COURTYARD PACK BATTLES — Skin.Club-style battles engine
   Lobby (simulated live battles) → Battle room (join, rip, settle)
   Economy: virtual bankroll · Provably Fair: seed + nonce per round
   ============================================================ */

/* ============================================================
   DATA & CONFIG
   ============================================================ */
const POKE_ART = id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const CATEGORIES = {
  pokemon:{ label:"Pokémon", packClass:"pack-pokemon", ambient:"ambient-pokemon",
    chars:[
      {n:"Charizard",art:POKE_ART(6)},{n:"Pikachu",art:POKE_ART(25)},{n:"Mew",art:POKE_ART(151)},
      {n:"Eevee",art:POKE_ART(133)},{n:"Gengar",art:POKE_ART(94)},{n:"Lugia",art:POKE_ART(249)},
      {n:"Rayquaza",art:POKE_ART(244)},{n:"Umbreon",art:POKE_ART(197)},{n:"Alakazam",art:POKE_ART(65)},
      {n:"Snorlax",art:POKE_ART(143)},{n:"Gardevoir",art:POKE_ART(282)},{n:"Tyranitar",art:POKE_ART(248)},
      {n:"Ho-Oh",art:POKE_ART(245)},{n:"Suicune",art:POKE_ART(243)},{n:"Crobat",art:POKE_ART(199)},{n:"Scizor",art:POKE_ART(212)}
    ], sets:["Base Set","Shining Cards","151","Evolutions","Prismatic","Obsidian Flames","Surging Powers"] },
  onepiece:{ label:"One Piece", packClass:"pack-onepiece", ambient:"ambient-onepiece",
    chars:["Luffy","Zoro","Nami","Sanji","Ace","Shanks","Law","Garp","Blackbeard","Kaido","Big Mom","Yamato","Koala","Stussy"],
    sets:["Romance","Pone Saga","Wano","Marineford","Grand Line","Skypia","Fish-Man Island"] },
  sports:{ label:"Sports", packClass:"pack-sports", ambient:"ambient-sports",
    chars:["LeBron James","Luka Dončić","Shohei Ohtani","Tom Brady","Cristiano Ronaldo","Kylian Mbappé","Nikola Jokić","Giannis Antetokounmpo","Aaron Rodgers","Kevin Durant"],
    sets:["Selects","Prizm","National Treasures","Optics","Immaculate","Topps Chrome"] }
};

const RARITIES = [
  {key:"common",label:"Common",min:1,max:20,c:"#9ca3af"},
  {key:"uncommon",label:"Uncommon",min:10,max:60,c:"#38bdf8"},
  {key:"rare",label:"Rare",min:40,max:150,c:"#a78bfa"},
  {key:"epic",label:"Epic",min:100,max:400,c:"#fbbf24"},
  {key:"chase",label:"Chase",min:300,max:2500,c:"#f472b6"}
];
const WEIGHTS = { normal:[.55,.25,.13,.06,.01], slab:[.15,.30,.30,.17,.08] };
const CARDS_PER_PACK = { normal:5, slab:3 };
const PACK_PRICES = { normal:290, slab:640 };

const MODE_INFO = {
  default:{ label:"Default", desc:"Everyone opens the same packs each round. The highest total value takes ALL cards from that round." },
  crazy:{ label:"Crazy", desc:"A random heat multiplier (0.5×–3×) is rolled each round and applies to every pull. Highest total still takes everything." },
  sharing:{ label:"Sharing", desc:"Lower risk: the round's total card value is split evenly between all players who opened." }
};

const BOT_NAMES = ["HoloHunter","PSA10OrNothing","ChaseSeeker","MintCondition","ToploaderTom","GradeGoblin",
  "PrizmPete","ShinyStash","CardFlipper","TieDieDana","SlabGod","WaxPackWizard","FoilFinder","BoxBreaker",
  "RareDropRay","UltraUmbra","SealedSquad","MintyFresh","HoloHoarder","PackLord","GeminiGrade","TomyuCardz"];
const BOT_COLORS = ["#fb7185","#a78bfa","#fbbf24","#34d399","#60a5fa","#f472b6"];

/* ============================================================
   RNG & PROVABLY FAIR
   ============================================================ */
function hashInt(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function hashHex(str){
  const a=(hashInt(str)>>>0).toString(16).padStart(8,"0");
  const b=(hashInt(str+"·verify")>>>0).toString(16).padStart(8,"0");
  return (a+b).slice(0,16);
}
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^a>>>15,1|a); t=(t+Math.imul(t^t>>>7,61|t))^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function pick(arr,rng){ const r=rng?rng():Math.random(); return arr[Math.floor(r*arr.length)%arr.length]; }

/* ============================================================
   CARD GENERATION (seeded when rng provided)
   ============================================================ */
let REAL_EXTRA=[];
const REAL_CARDS={
  common:[{n:"Weedle",img:"xy5/1"},{n:"Bulbasaur",img:"det1/1"},{n:"Tangela",img:"xy11/1"},{n:"Snivy",img:"bw1/1"},{n:"Surskit",img:"bw10/1"},{n:"Caterpie",img:"mcd19/1"}],
  uncommon:[{n:"Metapod",img:"xy2/2"},{n:"Kakuna",img:"xy5/2"},{n:"Cherrim",img:"ru1/2"},{n:"Alolan Exeggutor",img:"mcd19/2"}],
  rare:[{n:"Bastiodon",img:"pop6/1"},{n:"Lucario",img:"pop6/2"},{n:"Ludicolo",img:"det1/2"},{n:"Blastoise",img:"pl1/2"},{n:"Altaria",img:"hgss4/2"},{n:"Articuno",img:"base3/2"}],
  epic:[{n:"Aggron",img:"hgss4/1"},{n:"Ampharos",img:"pl1/1"},{n:"Dratini",img:"dv1/1"},{n:"Aerodactyl",img:"ex12/1"},{n:"Alakazam",img:"base4/1"},{n:"Arcanine",img:"hgss1/1"},{n:"Azumarill",img:"ex7/1"},{n:"Moltres",img:"gym1/1"},{n:"Banette",img:"ex14/1"},{n:"Dialga",img:"dp1/1"},{n:"Clefable",img:"col1/1"},{n:"Blaziken",img:"ex9/1"}],
  chase:[{n:"Mew",img:"si1/1"},{n:"Venusaur",img:"ru1/1"},{n:"Celebi & Venusaur-GX",img:"sm9/1"},{n:"Venusaur & Snivy-GX",img:"sm12/1"},{n:"Absol G",img:"pl3/1"}]
};
function pickRealCard(tier,rng){
  const pool=REAL_CARDS[tier];
  if((rng?rng():Math.random())<0.7 && pool.length) return pool[Math.floor((rng?rng():Math.random())*pool.length)];
  if(REAL_EXTRA.length) return REAL_EXTRA[Math.floor((rng?rng():Math.random())*REAL_EXTRA.length)];
  return pool.length?pool[Math.floor((rng?rng():Math.random())*pool.length)]:null;
}
function loadRealCards(){
  try{ const cached=JSON.parse(localStorage.getItem("pb_realcards_v1")||"[]"); if(Array.isArray(cached)&&cached.length) REAL_EXTRA=cached.filter(x=>x&&x.n&&x.img); }catch(e){}
  fetch("https://api.pokemontcg.io/v2/cards?limit=60").then(r=>r.ok?r.json():null).then(d=>{
    if(!d||!d.data) return;
    const list=d.data.filter(c=>c.supertype && c.supertype!=="Trainer" && c.images && c.images.small).map(c=>({n:c.name,img:c.set.id+"/"+c.number}));
    REAL_EXTRA=list;
    try{ localStorage.setItem("pb_realcards_v1",JSON.stringify(list)); }catch(e){}
  }).catch(()=>{});
}

function rollRarity(type,rng){
  const w=WEIGHTS[type]; let r=rng?rng():Math.random(), acc=0;
  for(let i=0;i<RARITIES.length;i++){ acc+=w[i]; if(r<acc) return RARITIES[i]; }
  return RARITIES[0];
}

function genCard(catKey,type,rng,mult){
  const cat=CATEGORIES[catKey], rar=rollRarity(type,rng);
  let value=Math.floor(rar.min + Math.pow(rng?rng():Math.random(),0.7)*(rar.max-rar.min));
  value=Math.round(value*(mult||1));
  if(catKey==="pokemon"){
    const real=pickRealCard(rar.key,rng);
    return {name:(real?real.n:"Pokémon Card"), rarity:rar.label, color:rar.c, value, art:(real?"https://images.pokemontcg.io/"+real.img+".png":null), tier:rar.key, catKey, type};
  }
  const char=pick(cat.chars,rng);
  const label=(typeof char==="object")?char.n:char;
  let name=`${label} — ${pick(cat.sets,rng)} #${1+Math.floor((rng?rng():Math.random())*150)}`;
  if(type==="slab") name+=` · PSA ${9+Math.floor((rng?rng():Math.random())*2)}`;
  return {name, rarity:rar.label, color:rar.c, value, art:(typeof char==="object")?char.art:null, tier:rar.key, catKey, type};
}

/* ============================================================
   ECONOMY — virtual bankroll (persisted)
   ============================================================ */
let bankroll=0;
function loadBank(){ try{ const v=parseInt(localStorage.getItem("pb_bankroll_v2"),10); return (v>=0)?v:1000; }catch(e){ return 1000; } }
function saveBank(){ try{ localStorage.setItem("pb_bankroll_v2",String(bankroll)); }catch(e){} }
function setBank(v,animate){
  const delta=v-bankroll; bankroll=Math.max(0,v); saveBank();
  document.querySelectorAll(".bankroll").forEach(el=>{ el.textContent=money(bankroll); });
  if(animate && delta!==0){
    const dir=delta>0?"bump-up":"bump-down";
    document.querySelectorAll(".bankroll-pill").forEach(el=>{ el.classList.remove("bump-up","bump-down"); void el.offsetWidth; el.classList.add(dir); });
  }
}
function recharge(){ setBank(bankroll+1000,true); toast("Recharged +"+money(1000)); }

/* ============================================================
   BATTLE TEMPLATES & LOBBY SIMULATION
   ============================================================ */
let battleSeq=0;
function makeBattle(opts={}){
  const catKey=pick(["pokemon","pokemon","onepiece","sports"],null);
  const entries=[];
  if(Math.random()<0.6){
    const type=Math.random()<0.7?"normal":"slab";
    entries.push({cat:catKey,type,qty:type==="normal"?1+Math.floor(Math.random()*8):1+Math.floor(Math.random()*4)});
  } else {
    entries.push({cat:catKey,type:"normal",qty:1+Math.floor(Math.random()*5)});
    entries.push({cat:catKey,type:"slab",qty:1+Math.floor(Math.random()*2)});
  }
  const playersNeeded=opts.players||pick([2,2,3,3,4],null);
  const rounds=pick([3,3,5],null);
  const mode=opts.mode||pick(["default","default","crazy","sharing"],null);
  const cost=entries.reduce((s,e)=>s+e.qty*PACK_PRICES[e.type],0);
  const b={ id:"b"+(++battleSeq), cat:catKey, entries, playersNeeded, rounds, mode, cost,
    status:Math.random()<0.45?"live":"waiting", round:0, bots:[], viewers:12+Math.floor(Math.random()*300) };
  b.round = b.status==="live" ? 1+Math.floor(Math.random()*(rounds-1)) : 0;
  const maxBots=b.playersNeeded - (Math.random()<0.2?0:1); // ~20% full (no open slot)
  const botCount=Math.floor(Math.random()*(maxBots+1));
  for(let i=0;i<botCount;i++) b.bots.push(makeBot(b.bots.map(x=>x.name)));
  return b;
}
function makeBot(exclude=[]){
  let name;
  for(let i=0;i<24;i++){ name=pick(BOT_NAMES,null); if(!exclude.includes(name)) break; }
  return { name, color:pick(BOT_COLORS,null), crown:Math.random()<0.25, streak:Math.floor(Math.random()*6) };
}
function expandEntries(b){
  const packs=[];
  b.entries.forEach(e=>{ for(let i=0;i<e.qty;i++) packs.push({cat:e.cat,type:e.type}); });
  return packs;
}

const lobby={ battles:[], filters:{mode:"all",players:"all",sort:"high"}, tickIv:null };

function initLobby(){
  for(let i=0;i<14;i++) lobby.battles.push(makeBattle());
  lobby.tickIv=setInterval(lobbyTick,4000);
}
function lobbyTick(){
  const now=new Date();
  lobby.battles.forEach(b=>{
    if(b.status==="live"){
      if(Math.random()<0.5) b.round++;
      if(b.round>b.rounds){ // battle finished → recycle
        Object.assign(b,makeBattle()); return;
      }
    }
    b.viewers=Math.max(3,b.viewers+Math.floor(Math.random()*7)-3);
    // occupancy drift
    const r=Math.random();
    if(r<0.12 && b.bots.length<b.playersNeeded) b.bots.push(makeBot(b.bots.map(x=>x.name)));
    else if(r>0.88 && b.bots.length>0) b.bots.pop();
  });
  while(lobby.battles.length<14) lobby.battles.push(makeBattle());
  updateLobbyStats();
  if(!$("#room").classList.contains("hidden")) return; // room is showing; skip row render
  renderLobby();
}
function updateLobbyStats(){
  $("#statOnline").textContent=(3200+Math.floor(Math.random()*400)).toLocaleString();
  $("#statBattles").textContent=(113458703+lobby.battles.length).toLocaleString();
}

/* ---------- LOBBY RENDER ---------- */
function filterBattles(){
  let list=lobby.battles.filter(b=>{
    if(lobby.filters.mode!=="all" && b.mode!==lobby.filters.mode) return false;
    if(lobby.filters.players!=="all" && b.playersNeeded!==+lobby.filters.players) return false;
    return true;
  });
  list.sort((a,b)=> lobby.filters.sort==="high" ? b.cost-a.cost : lobby.filters.sort==="low" ? a.cost-b.cost : b.playersNeeded-a.playersNeeded);
  return list;
}
function renderLobby(){
  const wrap=$("#brows"); wrap.innerHTML="";
  filterBattles().forEach(b=>{
    const row=document.createElement("div");
    const full=b.bots.length>=b.playersNeeded;
    row.className="brow"+(full?" locked":"")+(b.status==="live"?" live":"");
    // highlight the most valuable entry (slab if present) with the top-case marker
    let hi=b.entries.findIndex(e=>e.type==="slab"); if(hi<0) hi=0;
    const tiles=[]; let budget=5;
    // top case first (highlighted), then remaining entries dimmed behind it
    [hi,...b.entries.map((_,i)=>i).filter(i=>i!==hi)].forEach(i=>{
      const e=b.entries[i]; if(budget<=0) return;
      const shown=Math.min(e.qty,4,budget); budget-=shown;
      for(let k=0;k<shown;k++){
        tiles.push(`<div class="case-tile${i===hi?" top":""}">
          ${i===hi&&k===0?'<span class="tile-caret"></span>':""}
          <img src="assets/pack-${e.type}.png" alt="">
          ${(k===shown-1&&e.qty>shown)?`<span class="qty-badge">×${e.qty}</span>`:""}
          <span class="case-name">${CATEGORIES[e.cat].label} ${e.type==="slab"?"Slab":"Normal"}</span>
        </div>`);
      }
    });
    const avatars=b.bots.slice(0,4).map(bot=>
      `<span class="avatar" style="background:${bot.color}">${bot.name.slice(0,2).toUpperCase()}${bot.crown?'<span class="crown">👑</span>':""}</span>`).join("");
    const empty=b.playersNeeded-b.bots.length;
    const curRound=b.status==="live"?Math.min(b.round+1,b.rounds):b.rounds;
    row.innerHTML=`
      <div class="b-status">
        ${b.status==="live"?'<span class="b-live">Live</span>':'<span class="b-waiting">Waiting</span>'}
        <div class="hex"><span>${curRound}</span></div>
        <span class="hex-cap">Round${b.rounds>1?"s":""}</span>
      </div>
      <div class="b-scenario"><span class="scat">${CATEGORIES[b.cat].label}</span>${tiles.join("")}
        <button class="details-btn" data-id="${b.id}">Details</button></div>
      <div class="b-cost"><span class="amt">$${costFmt(b.cost)}</span><span class="per">per round · ${b.playersNeeded} player${b.playersNeeded>1?"s":""}</span></div>
      <div class="b-players">
        ${b.mode!=="default"?`<span class="mode-tag ${b.mode}">${MODE_INFO[b.mode].label} mode</span>`:`<span class="pfill">${b.bots.length} / ${b.playersNeeded}</span>`}
        <span class="avatars">${avatars}${empty>0?`<span class="avatar empty">+</span>`:""}</span>
      </div>
      <button class="action-btn ${full?"watch":"join"}">${full?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>Watch':'Join'}</button>`;
    row.querySelector(".details-btn").onclick=(e)=>{ e.stopPropagation(); showBattleDetails(b); };
    const ab=row.querySelector(".action-btn");
    if(!full) ab.onclick=(e)=>{ e.stopPropagation(); joinBattle(b); };
    else ab.onclick=(e)=>{ e.stopPropagation(); showBattleDetails(b); };
    row.onclick=()=>showBattleDetails(b);
    wrap.appendChild(row);
  });
}

function showBattleDetails(b){
  $("#detailTitle").textContent=`${CATEGORIES[b.cat].label} ${b.mode==="crazy"?"Crazy":""} Battle`;
  $("#detailBody").innerHTML =
    b.entries.map(e=>`<div class="detail-row"><span>${e.qty}× ${e.type==="slab"?"Slab":"Normal"} packs (${CATEGORIES[e.cat].label})</span><span>${money(e.qty*PACK_PRICES[e.type])}</span></div>`).join("")+
    `<div class="detail-row"><span>Mode</span><span>${MODE_INFO[b.mode].label}</span></div>`+
    `<div class="detail-row"><span>Rounds</span><span>${b.rounds}</span></div>`+
    `<div class="detail-row"><span>Players</span><span>${b.playersNeeded}</span></div>`+
    `<div class="detail-row"><span>Cost per round</span><span>${money(b.cost)}</span></div>`+
    `<div class="mode-desc">${MODE_INFO[b.mode].desc}</div>`;
  $("#detailModal").classList.remove("hidden");
}

/* ============================================================
   BATTLE ROOM
   ============================================================ */
const room={ battle:null, token:0, active:false, auto:true, speed:1,
  seed:"", round:0, mult:1, rng:null, players:[], packList:[], roundCards:{}, pfLog:[], viewerCount:0 };

function joinBattle(b){
  if(b.bots.length>=b.playersNeeded) return;
  if(bankroll<b.cost){ toast("Not enough balance — this battle costs "+money(b.cost)+" per round",true); return; }
  room.token++; const token=room.token;
  room.battle=b; room.seed=hashHex("seed"+Date.now()+battleSeq); room.round=0; room.pfLog=[]; room.mult=1;
  // players: user + bots (top up to needed)
  room.players=[{id:"U",name:"You",isUser:true,color:"#38bdf8"}];
  while(room.players.length<b.playersNeeded) room.players.push({...pickUnusedBot(b)});
  room.packList=expandEntries(b);
  showScreen("room");
  renderRoom();
  $("#rhRound").textContent=`1 of ${b.rounds}`;
  $("#rhCost").textContent=money(b.cost);
  $("#caseStrip").innerHTML=b.entries.map(e=>
    `<span class="chip"><img src="assets/pack-${e.type}.png" alt=""><span class="cname">${CATEGORIES[e.cat].label} ${e.type==="slab"?"Slab":"Normal"}</span><span class="qty">×${e.qty}</span></span>`).join("");
  $("#ambient").className="ambient "+CATEGORIES[b.cat].ambient;
  initViewerCounter();
  initAudio(); resumeAudio(); initAmbientMusic();
  startRound(token);
}
function pickUnusedBot(b){
  const used=room.players.map(p=>p.name);
  const avail=b.bots.filter(x=>!used.includes(x.name));
  const bot=avail.length?pick(avail,null):makeBot(used);
  return {id:"B"+(room.players.length-1),name:bot.name,isUser:false,color:bot.color,crown:bot.crown,streak:0};
}

function renderRoom(){
  const b=room.battle;
  $("#arena").innerHTML="";
  const N=room.players.length;
  $("#arena").className="arena cols-"+(N===2?2:N);
  room.players.forEach(p=>{
    if(p.isUser){
      const col=document.createElement("div");
      col.className="player pa"; col.id="colU";
      col.innerHTML=`<div class="pname"><span><span class="dot" style="background:var(--a)"></span>${p.name}</span></div>
        <div class="pack-stage"><div class="pack" id="packU"></div></div>
        <div class="round-total" id="rtU">$0</div>
        <div class="cum">this round · <span id="cumU">$0</span> total</div>
        <div class="packs-left"><span id="leftU">0</span> packs left to rip</div>
        <div class="hand" id="handU"></div>`;
      $("#arena").appendChild(col);
    } else {
      const col=document.createElement("div");
      col.className="player"; col.id="col"+p.id;
      col.innerHTML=`<div class="pname"><span><span class="dot" style="background:${p.color}"></span>${p.name}${p.crown?' <span class="crown-mini">👑</span>':""}</span><span class="streak-badge" id="streak${p.id}">0</span></div>
        <div class="bot-stage"><div class="bot-pack" id="bp${p.id}"><img src="assets/pack-${room.packList[0].type}.png" alt=""></div><span class="bot-tag" id="btag${p.id}">Pack 1/${room.packList.length}</span></div>
        <div class="round-total" id="rt${p.id}">$0</div>
        <div class="cum">this round · <span id="cum${p.id}">$0</span> total</div>
        <div class="hand" id="hand${p.id}"></div>`;
      $("#arena").appendChild(col);
    }
  });
  if(N===2){
    const vs=document.createElement("div");
    vs.className="vs";
    vs.innerHTML=`<div class="sign">VS</div><div class="score"><span class="a" id="scoreU">0</span><span>–</span><span class="b" id="scoreB0">0</span></div>
      <div class="roundlbl">${b.rounds} rounds · ${MODE_INFO[b.mode].label}</div><div class="leader-tag" id="leaderTag"></div>`;
    $("#arena").insertBefore(vs,$("#col"+room.players[1].id));
  }
  // reset totals
  room.players.forEach(p=>{ p.roundTotal=0; p.cumulative=p.cumulative||0; p.packsRipped=0; p.bestCard=0; p.roundsWon=p.roundsWon||0; });
  $("#handU").innerHTML=""; $("#log").innerHTML="";
  updatePackVisual("U"); setPackTag("U"); updateTotals();
}

/* ---------- ROUND FLOW ---------- */
async function startRound(token){
  room.active=true; room.round++;
  const b=room.battle;
  // can't cover the entry → forfeit battle
  if(bankroll < b.cost){ showForfeit(); return; }
  // fresh seeded stream for this round (PF: seed + nonce)
  room.rng=mulberry32(hashInt(room.seed+":"+room.round));
  // crazy multiplier — rolled from the same stream so it's verifiable
  if(b.mode==="crazy"){ const opts=[0.5,0.75,1,1.25,1.5,2,2.5,3]; room.mult=pick(opts,room.rng); } else room.mult=1;

  // charge entry
  setBank(bankroll-b.cost,true);
  addLogNote(`Round ${room.round} · entry ${money(b.cost)} charged${b.mode==="crazy"?" · 🔥 Crazy ×"+room.mult:""}`);

  $("#rhRound").textContent=`${room.round} of ${b.rounds}`;
  if(room.round>1) showRoundSplash(room.round+(b.mode==="crazy"?` (×${room.mult})`:""));

  // pre-generate all pulls for the round (deterministic order: user, then bots)
  room.players.forEach(p=>{ p.roundTotal=0; p.packsRipped=0; p.bestCard=0; });
  const perPlayer={};
  room.players.forEach(p=>{
    perPlayer[p.id]=room.packList.map(pk=>Array.from({length:CARDS_PER_PACK[pk.type]},()=>genCard(pk.cat,pk.type,room.rng,room.mult)));
  });
  room.roundCards=perPlayer;

  $("#handU").innerHTML="";
  room.players.filter(p=>!p.isUser).forEach(p=>{ $("#hand"+p.id).innerHTML=""; markLatest(p.id,null); });
  setPackTag("U"); updateTotals(); setLeader();

  // bot reveal pacing: spread bot cards over the user's cinematic duration
  const estUserTime=room.packList.length*(1730+CARDS_PER_PACK.normal*320);
  await Promise.all([
    userRipAll(token),
    ...room.players.filter(p=>!p.isUser).map(p=>botReveal(p,token,estUserTime))
  ]);
  if(token!==room.token) return;
  settleRound(token);
}

async function userRipAll(token){
  for(let i=0;i<room.packList.length;i++){
    if(token!==room.token || !room.active) return;
    await ripPack("U",token,i);
  }
}

async function botReveal(p,token,estUserTime){
  const cards=[]; room.roundCards[p.id].forEach(pack=>cards.push(...pack));
  const delay=Math.max(140,estUserTime/cards.length)/room.speed;
  for(let i=0;i<cards.length;i++){
    await sleep(delay); if(token!==room.token) return;
    const card=cards[i];
    p.roundTotal+=card.value; if(card.value>p.bestCard) p.bestCard=card.value;
    addCardRow(p.id,card); markLatest(p.id,$("#hand"+p.id).firstChild);
    $("#btag"+p.id).textContent=`Ripping · Pack ${Math.min(Math.floor(i/cards.length*room.packList.length)+1, room.packList.length)}/${room.packList.length}`;
    updateTotals(); setLeader();
    if(card.tier==="chase"){ flashChase(p.id); addLogNote(`🔥 ${p.name} pulled a Chase!`); }
    else if(card.value>=300) addLog(p.id,card);
  }
  $("#btag"+p.id).textContent=`Done · ${money(p.roundTotal)}`;
}

async function ripPack(pid,token,packIdx){
  const p=room.players.find(x=>x.id===pid);
  const pk=room.packList[packIdx];
  const pack=$("#packU");
  setPackTag("U");
  $("#packU").innerHTML =
    `<div class="pack-img"><img src="assets/pack-${pk.type}.png" alt="Pack"></div>`+
    `<div class="pack-lid"><img src="assets/pack-${pk.type}.png" alt=""><div class="shimmer"></div><div class="sealed-sticker">SEALED</div></div>`+
    `<div class="tag-overlay"><small>Pack ${packIdx+1}/${room.packList.length}</small></div>`;
  updatePackStack("U",packIdx);

  $("#cinematicOverlay").classList.add("active");
  pack.closest(".pack-stage").classList.add("zoomed");
  await sleep(500); if(token!==room.token) return;
  pack.classList.add("pre-rip"); await sleep(400); if(token!==room.token) return;
  pack.classList.remove("pre-rip");
  pack.classList.add("resist"); await sleep(350); if(token!==room.token) return;
  pack.classList.remove("resist");
  pack.classList.add("shake"); await sleep(300); if(token!==room.token) return;
  void pack.offsetWidth;
  pack.classList.remove("shake"); pack.classList.add("split","bursting"); playRip();
  await sleep(180);

  const cards=room.roundCards[pid][packIdx];
  for(let i=0;i<cards.length;i++){
    if(token!==room.token) return;
    const card=cards[i];
    p.roundTotal+=card.value; p.cumulative=p.cumulative||0; if(card.value>p.bestCard) p.bestCard=card.value;
    setHeatGlow("U",card.tier);
    const tierDelay = card.tier==="chase"?600:card.tier==="epic"?450:card.tier==="rare"?350:200;
    await sleep(tierDelay); if(token!==room.token) return;
    addCardRow("U",card); showCardBackFlip($("#handU").firstChild);
    addLog("U",card); updateTotals(); setLeader(); playCard(card.value);
    if(card.value>=500){ triggerEdgeFlash("chase"); } else if(card.value>=300){ triggerEdgeFlash("epic"); }
    if(card.value>=300){ flashChase("U"); playChase(); }
    checkCloser("U",card);
    if(card.tier==="chase"){
      $("#cinematicOverlay").classList.add("deep");
      await showPedestal(card);
      $("#cinematicOverlay").classList.remove("deep");
    }
  }

  pack.closest(".pack-stage").classList.remove("zoomed");
  pack.classList.remove("heat-1","heat-2","heat-3","heat-4");
  $("#cinematicOverlay").classList.remove("active");
  p.packsRipped++;
  pack.classList.remove("split","bursting");
  updatePackStack("U",packIdx);
  $("#leftU").textContent=room.packList.length-p.packsRipped;
  await sleep(260);
}

/* ---------- SETTLEMENT ---------- */
function settleRound(token){
  if(token!==room.token) return;
  const b=room.battle;
  const totals=room.players.map(p=>({id:p.id,name:p.name,total:p.roundTotal,best:p.bestCard}));
  // winner: highest total → biggest single card → coin flip (seeded)
  const sorted=[...totals].sort((x,y)=> y.total-x.total || y.best-x.best);
  let winner=sorted[0];
  if(sorted.length>1 && sorted[1].total===sorted[0].total && sorted[1].best===sorted[0].best){
    winner = room.rng()>0.5?sorted[0]:sorted[1];
  }
  const pool=totals.reduce((s,t)=>s+t.total,0);
  let credit={};
  if(b.mode==="sharing"){
    room.players.forEach(p=>{ credit[p.id]=Math.round(pool/room.players.length); });
  } else {
    credit[winner.id]=pool;
  }
  // apply credits
  room.players.forEach(p=>{ p.cumulative=(p.cumulative||0)+(credit[p.id]||0); });
  const winnerP=room.players.find(x=>x.id===winner.id);
  winnerP.roundsWon=(winnerP.roundsWon||0)+1;
  const userP=room.players[0];
  setBank(bankroll+(credit["U"]||0),true);

  // PF digest for this round
  const digest=hashHex(JSON.stringify(totals));
  room.pfLog.push({round:room.round,nonce:room.round,digest,winner:winner.name});

  playRoundWin();
  updateTotals(); setLeader();
  room.players.filter(p=>!p.isUser).forEach(p=>{ const el=$("#streak"+p.id); if(el) el.textContent=p.roundsWon||0; });
  if($("#scoreU")){ $("#scoreU").textContent=room.players[0].roundsWon||0; $("#scoreB0").textContent=(room.players[1]&&room.players[1].roundsWon)||0; }

  const userWon=winner.id==="U";
  showRoundBanner(userWon, b.mode==="sharing" ? `Sharing split · you take ${money(credit["U"])}` : `${winner.name} takes the round (+${money(pool)})`, winner);
  addLogNote(`🏁 Round ${room.round} → ${winner.name} (${money(winner.total)})${b.mode==="sharing"?" · pool split":" · takes everything"}`);

  setTimeout(()=>{
    if(token!==room.token) return;
    if(room.round>=b.rounds){ finishMatch(); } else { startRound(token); }
  },3400/room.speed);
}

function finishMatch(){
  room.active=false;
  const ranked=[...room.players].sort((a,b)=>(b.cumulative||0)-(a.cumulative||0));
  const userP=room.players[0];
  const place=ranked.findIndex(p=>p.id==="U")+1;
  const userWon=place===1;
  playMatchWin(); if(userWon) triggerCascade("U");
  $("#ovTitle").textContent = userWon ? "🏆 You win the battle!" : `🏁 ${ranked[0].name} wins`;
  $("#ovWho").textContent = userWon ? (room.battle.mode==="sharing" ? "Sharing split · you won it" : "You took everything") : `${place}/${ranked.length} place · best of ${room.battle.rounds}`;
  $("#ovText").innerHTML = ranked.map(p=>`<span style="color:${p.isUser?"var(--green)":p.color};font-weight:700">${p.name}</span> ${money(p.cumulative||0)}`).join(" · ");
  $("#ovTake").textContent=userWon?`You took home ${money(userP.cumulative||0)} (staked ${money(room.battle.cost*room.round)})`:`Staked ${money(room.battle.cost*room.round)} · took home ${money(userP.cumulative||0)}`;
  const btns=$("#ovBtns"); btns.innerHTML="";
  const again=document.createElement("button"); again.className="btn ghost"; again.textContent="Play Again";
  again.onclick=()=>{ $("#overlay").classList.add("hidden"); joinBattle(room.battle); };
  const back=document.createElement("button"); back.className="btn"; back.textContent="Back to Lobby";
  back.onclick=backToLobby;
  btns.appendChild(again); btns.appendChild(back);
  $("#overlay").classList.remove("hidden");
}

function showForfeit(){
  room.active=false;
  $("#ovTitle").textContent="💸 Out of funds";
  $("#ovWho").textContent="You couldn't cover the entry for this round";
  $("#ovText").textContent=`Your bankroll is ${money(bankroll)} and the next round costs ${money(room.battle.cost)}. You forfeit the battle.`;
  $("#ovTake").textContent="";
  const btns=$("#ovBtns"); btns.innerHTML="";
  const back=document.createElement("button"); back.className="btn"; back.textContent="Back to Lobby";
  back.onclick=backToLobby;
  btns.appendChild(back);
  $("#overlay").classList.remove("hidden");
}

function backToLobby(){
  room.token++; room.active=false;
  stopAmbientMusic();
  $("#room").classList.add("hidden"); $("#lobby").classList.remove("hidden");
  $("#overlay").classList.add("hidden");
  renderLobby();
}

/* ============================================================
   CARD ROW / LOG / FEEDBACK (ported, generalized)
   ============================================================ */
function addCardRow(pid,card){
  const hand=$("#hand"+pid); if(!hand) return;
  const row=document.createElement("div");
  row.className="cardrow t-"+((card.tier)||"common")+(card.value>=300?" big":"");
  row.style.setProperty("--c",card.color);
  const initial=card.name[0].toUpperCase();
  const monoBg=`linear-gradient(135deg, ${card.color}33, #0d1225)`;
  const img = card.art ? `<img src="${card.art}" loading="lazy" alt="" onerror="this.remove()">` : `<span class="mono">${initial}</span>`;
  row.innerHTML=
    `<div class="slab-mini">
       <div class="slab-label">${card.rarity} · ${card.type==="slab"?"PSA":"CGC"} ${9+Math.floor(Math.random()*2)}</div>
       <div class="slab-art" style="background:${monoBg}">${img}</div>
     </div>`+
    `<div class="nm">${card.name}<br><span class="rar" style="color:${card.color}">${card.rarity}</span></div>`+
    `<span class="val pop">+${money(card.value)}</span>`;
  hand.prepend(row);
  while(hand.children.length>30) hand.lastChild.remove();
  const val=row.querySelector(".val");
  countUp(val,card.value);
  setTimeout(()=>val.classList.remove("pop"),520/room.speed);
  if(card.tier==="epic"||card.tier==="chase"){
    const colors = card.tier==="chase"?["#fbbf24","#f472b6","#fff","#fde047"]:["#a78bfa","#38bdf8","#fbbf24","#fff"];
    burstParticles(row, card.tier==="chase"?18:10, colors);
  }
  if(card.tier==="chase") punchCol(pid);
}
function markLatest(pid,row){
  document.querySelectorAll(`#hand${pid} .cardrow`).forEach(r=>r.classList.remove("latest"));
  if(row) row.classList.add("latest");
}

function addLog(pid,card){
  const p=room.players.find(x=>x.id===pid); if(!p) return;
  const log=$("#log");
  const row=document.createElement("div");
  row.className="logrow";
  row.innerHTML=`<span class="tagname" style="color:${p.color}">${p.name.slice(0,12)}</span>
    <span class="lnm">${card.name}</span><span class="lval">+${money(card.value)}</span>`;
  log.prepend(row);
  while(log.children.length>300) log.lastChild.remove();
}
function addLogNote(text){
  const log=$("#log");
  const row=document.createElement("div");
  row.className="lognote"; row.textContent=text;
  log.prepend(row);
}

function flashChase(pid){
  const col=$("#col"+pid); if(!col) return;
  col.classList.remove("chaseflash"); void col.offsetWidth; col.classList.add("chaseflash");
}
function updateTotals(){
  room.players.forEach(p=>{
    const rt=$("#rt"+p.id), cum=$("#cum"+(p.id==="U"?"U":p.id));
    if(rt) rt.textContent=money(p.roundTotal||0);
    if(cum) cum.textContent=money(p.cumulative||0);
  });
  $("#leftU").textContent=Math.max(0,room.packList.length-(room.players[0].packsRipped||0));
}
function setLeader(){
  const max=Math.max(...room.players.map(p=>p.roundTotal||0),0);
  room.players.forEach(p=>{
    const col=$("#col"+p.id); if(col) col.classList.toggle("lead",(p.roundTotal||0)===max && max>0);
  });
  const lead=room.players.find(p=>(p.roundTotal||0)===max&&max>0);
  const lt=$("#leaderTag");
  if(lt) lt.textContent = lead?`▲ ${lead.name} leads this round`:"";
}

function checkCloser(pid,card){
  const p=room.players.find(x=>x.id===pid);
  const othersMax=Math.max(...room.players.filter(x=>x.id!==pid).map(x=>x.roundTotal||0),0);
  const before = othersMax >= (p.roundTotal-card.value);
  const after = (p.roundTotal) > othersMax;
  if(before && after && card.value>=100){
    const banner=$("#closerBanner");
    banner.textContent="CLOSER";
    banner.className="closer-banner show";
    setTimeout(()=>{ banner.className="closer-banner"; },1300);
  }
}

/* ============================================================
   PEDESTAL DISPLAY (Chase reveal)
   ============================================================ */
async function showPedestal(card){
  const ov=$("#pedestalOverlay");
  $("#pedSetLabel").textContent = card.catKey==="pokemon" ? "Pokémon TCG" : CATEGORIES[card.catKey].label+" TCG";
  $("#pedGrade").textContent = card.type==="slab" ? "PSA 10" : "CGC 10";
  const artArea=$("#pedArtArea");
  const initial=card.name[0].toUpperCase();
  const monoBg=`linear-gradient(135deg, ${card.color}33, #0d1525)`;
  artArea.innerHTML = card.art ? `<img src="${card.art}" alt="" onerror="this.remove()">` : `<span class="mono">${initial}</span>`;
  artArea.style.background=monoBg;
  $("#pedName").textContent=card.name;
  $("#pedFMV").textContent="FMV "+money(card.value);
  ov.classList.add("active");
  await sleep(2200/room.speed);
  ov.classList.remove("active");
  await sleep(400/room.speed);
}

/* ============================================================
   PACK VISUAL / STACK (ported)
   ============================================================ */
function updatePackVisual(pid){
  const pack=$("#packU"); if(!pack) return;
  const pk=room.packList[0];
  pack.className="pack";
  pack.innerHTML =
    `<div class="pack-img"><img src="assets/pack-${pk.type}.png" alt="Pack"></div>`+
    `<div class="pack-lid"><img src="assets/pack-${pk.type}.png" alt=""><div class="shimmer"></div><div class="sealed-sticker">SEALED</div></div>`+
    `<div class="tag-overlay"><small>Pack 1/${room.packList.length}</small></div>`;
  updatePackStack("U",0);
}
function setHeatGlow(pid,tier){
  const pack=$("#pack"+pid); if(!pack) return;
  pack.classList.remove("heat-1","heat-2","heat-3","heat-4");
  if(tier==="rare") pack.classList.add("heat-1");
  else if(tier==="epic") pack.classList.add("heat-2");
  else if(tier==="chase") pack.classList.add("heat-3");
}
function showCardBackFlip(row){
  const slab=row?row.querySelector(".slab-mini"):null;
  if(!slab) return;
  const back=document.createElement("div");
  back.className="card-back";
  back.textContent = room.packList[0].type==="slab" ? "🏆" : "✦";
  slab.appendChild(back);
  setTimeout(()=>{ back.classList.add("flipped"); setTimeout(()=>back.remove(),400); },200/room.speed);
}
function setPackTag(pid){
  const p=room.players[0];
  const tag=$("#packU .tag-overlay");
  if(tag) tag.innerHTML=`<small>Pack ${Math.min(p.packsRipped+1,room.packList.length)}/${room.packList.length}</small>`;
}
function updatePackStack(pid,packIdx){
  const pack=$("#packU");
  const remaining = room.packList.length-(packIdx+1);
  let stackEl=pack.querySelector(".pack-stack");
  if(!stackEl){ stackEl=document.createElement("div"); stackEl.className="pack-stack"; pack.prepend(stackEl); }
  const img=`assets/pack-${room.packList[packIdx].type}.png`;
  let html="";
  for(let i=0;i<Math.min(remaining,4);i++) html+=`<div class="stack-pack"><img src="${img}" alt=""></div>`;
  stackEl.innerHTML=html;
}

/* ============================================================
   PROVABLY FAIR MODAL
   ============================================================ */
function showPF(){
  $("#pfSeed").textContent=room.seed;
  $("#pfModeNote").textContent=`Battle: ${CATEGORIES[room.battle.cat].label} · ${MODE_INFO[room.battle.mode].label} mode · ${room.battle.rounds} rounds. `+
    (room.battle.mode==="crazy"?"Each round's heat multiplier is rolled from the same seeded stream.":"");
  const rows=room.pfLog.map(r=>`<tr><td>${r.nonce}</td><td class="digest">${r.digest}</td><td>${r.winner}</td></tr>`).join("");
  $("#pfRows").innerHTML=rows||'<tr><td colspan="3" style="color:var(--muted)">No rounds completed yet.</td></tr>';
  $("#pfModal").classList.remove("hidden");
}

/* ============================================================
   SCREENS / TOAST
   ============================================================ */
function showScreen(which){
  $("#lobby").classList.toggle("hidden",which!=="lobby");
  $("#room").classList.toggle("hidden",which!=="room");
  window.scrollTo(0,0);
}
let toastIv=null;
function toast(msg,warn){
  const t=$("#toast"); t.textContent=msg; t.className="toast show"+(warn?" warn":"");
  clearTimeout(toastIv); toastIv=setTimeout(()=>t.className="toast"+(warn?" warn":""),2600);
}

/* ============================================================
   FX — particles, splash, edge flash, cascade, viewers (ported)
   ============================================================ */
function countUp(el,target){
  const dur=900/room.speed; let start=null; el.textContent="+"+money(0);
  function tick(t){ if(start===null)start=t; const p=Math.min(1,(t-start)/dur); el.textContent="+"+money(target*p); if(p<1) requestAnimationFrame(tick); else el.textContent="+"+money(target); }
  requestAnimationFrame(tick);
}
function burstParticles(row,count,colors){
  const r=row.getBoundingClientRect();
  for(let i=0;i<count;i++){
    const s=document.createElement("span"); s.className="particle";
    const sz=3+Math.random()*5; s.style.width=sz+"px"; s.style.height=sz+"px";
    s.style.background=colors[Math.floor(Math.random()*colors.length)];
    s.style.left=(r.left+r.width*(0.2+Math.random()*0.6))+"px";
    s.style.top=(r.top+r.height/2)+"px";
    document.body.appendChild(s);
    const ang=Math.random()*Math.PI*2, dist=30+Math.random()*70;
    const dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist-20;
    s.animate([{transform:"translate(0,0) scale(1)",opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.2)`,opacity:0}],{duration:600+Math.random()*300,easing:"cubic-bezier(.2,.7,.3,1)"}).onfinish=()=>s.remove();
  }
}
function punchCol(pid){
  const col=$("#col"+pid); if(!col)return;
  col.classList.remove("punch"); void col.offsetWidth; col.classList.add("punch");
  setTimeout(()=>col.classList.remove("punch"),320);
}
function triggerEdgeFlash(type){
  const el=$("#edgeFlash");
  el.className="edge-flash";
  void el.offsetWidth;
  el.classList.add("active", type==="chase"?"chase":"epic");
  setTimeout(()=>{ el.className="edge-flash"; },800);
}
function showRoundSplash(text){
  const splash=$("#roundSplash");
  $("#splashText").textContent=text;
  splash.classList.remove("active");
  void splash.offsetWidth;
  splash.classList.add("active");
  setTimeout(()=>{ splash.classList.remove("active"); },1500);
}
function showRoundBanner(userWon,sub,winner){
  const rb=$("#roundBanner");
  $("#rbTitle").textContent = userWon ? `ROUND ${room.round} — YOU WIN` : `ROUND ${room.round} — ${winner.name.toUpperCase()} WINS`;
  $("#rbTitle").className="rb-title "+(userWon?"win":"lose");
  $("#rbSub").textContent=sub;
  rb.classList.add("show");
  setTimeout(()=>rb.classList.remove("show"),3000/room.speed);
}
function initViewerCounter(){
  room.viewerCount=12+Math.floor(Math.random()*400);
  clearInterval(room.viewerIv);
  room.viewerIv=setInterval(()=>{
    if(!room.active){ clearInterval(room.viewerIv); return; }
    room.viewerCount+=Math.floor(Math.random()*5)-1;
    if(room.viewerCount<20) room.viewerCount=20;
    $("#viewerCount").textContent=room.viewerCount+" watching";
  },3000);
}
function initAmbientParticles(){
  const container=$("#ambientParticles");
  if(!container) return;
  for(let i=0;i<25;i++){
    const s=document.createElement("span");
    const size=2+Math.random()*3;
    s.style.width=size+"px"; s.style.height=size+"px";
    s.style.left=Math.random()*100+"%";
    s.style.animationDuration=(8+Math.random()*14)+"s";
    s.style.animationDelay=(Math.random()*12)+"s";
    s.style.opacity=0.1+Math.random()*0.2;
    container.appendChild(s);
  }
}
function triggerCascade(pid){
  const colors=["#fbbf24","#38bdf8","#a78bfa","#f472b6","#3ee08f"];
  for(let i=0;i<15;i++){
    setTimeout(()=>{
      const el=document.createElement("div");
      el.className="cascade-card";
      const w=40+Math.random()*30, h=w*1.4;
      el.style.width=w+"px"; el.style.height=h+"px";
      el.style.left=Math.random()*90+5+"%";
      el.style.background=`linear-gradient(135deg,${pick(colors,null)}33,#0d1225)`;
      el.style.border=`1px solid ${pick(colors,null)}`;
      el.style.animationDuration=(1.5+Math.random()*2)+"s";
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),4000);
    }, i*120);
  }
}
function initPackTilt(){
  const stage=$("#colU");
  if(!stage) return;
  stage.addEventListener("mousemove",e=>{
    const pack=$("#packU");
    if(!pack||pack.classList.contains("split")) return;
    const rect=stage.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width - 0.5;
    const y=(e.clientY-rect.top)/rect.height - 0.5;
    pack.style.transform=`perspective(600px) rotateY(${x*8}deg) rotateX(${-y*8}deg)`;
  });
  stage.addEventListener("mouseleave",()=>{
    const pack=$("#packU");
    if(pack && !pack.classList.contains("split")) pack.style.transform="";
  });
}

/* ============================================================
   AUDIO (Web Audio synth — ported)
   ============================================================ */
let audioCtx=null, masterGain=null, muted=false, noiseBuf=null;
function initAudio(){
  if(audioCtx) return;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return;
  try{
    audioCtx=new AC();
    masterGain=audioCtx.createGain();
    masterGain.gain.value=muted?0:0.5;
    masterGain.connect(audioCtx.destination);
  }catch(e){}
}
function resumeAudio(){ if(audioCtx&&audioCtx.state==="suspended") audioCtx.resume(); }
function getNoise(){
  if(noiseBuf) return noiseBuf;
  const len=Math.floor(audioCtx.sampleRate*0.4);
  noiseBuf=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
  const d=noiseBuf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  return noiseBuf;
}
function playRip(){
  if(!audioCtx||muted) return;
  const t=audioCtx.currentTime;
  const src=audioCtx.createBufferSource(); src.buffer=getNoise();
  const bp=audioCtx.createBiquadFilter(); bp.type="bandpass";
  bp.frequency.setValueAtTime(900,t); bp.frequency.exponentialRampToValueAtTime(2600,t+0.18); bp.Q.value=0.7;
  const g=audioCtx.createGain();
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.5,t+0.04);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.32);
  src.connect(bp); bp.connect(g); g.connect(masterGain);
  src.start(t); src.stop(t+0.4);
}
function playCard(value){
  if(!audioCtx||muted) return;
  const t=audioCtx.currentTime;
  const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
  o.type="triangle";
  const base=480+Math.min(value,300)/300*420;
  o.frequency.setValueAtTime(base,t);
  o.frequency.exponentialRampToValueAtTime(base*1.5,t+0.1);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.26,t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.24);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t+0.3);
}
function playChase(){
  if(!audioCtx||muted) return;
  const t=audioCtx.currentTime;
  [523.25,659.25,783.99,1046.5].forEach((f,i)=>{
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type="sine"; o.frequency.value=f;
    const s=t+i*0.055;
    g.gain.setValueAtTime(0.0001,s);
    g.gain.exponentialRampToValueAtTime(0.3,s+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,s+0.45);
    o.connect(g); g.connect(masterGain);
    o.start(s); o.stop(s+0.5);
  });
}
function playRoundWin(){
  if(!audioCtx||muted) return;
  const t=audioCtx.currentTime;
  [392,523.25].forEach((f,i)=>{
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type="triangle"; o.frequency.value=f;
    const s=t+i*0.09;
    g.gain.setValueAtTime(0.0001,s);
    g.gain.exponentialRampToValueAtTime(0.32,s+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,s+0.5);
    o.connect(g); g.connect(masterGain);
    o.start(s); o.stop(s+0.55);
  });
}
function playMatchWin(){
  if(!audioCtx||muted) return;
  const t=audioCtx.currentTime;
  [523.25,659.25,783.99].forEach((f,i)=>{
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type="sine"; o.frequency.value=f;
    const s=t+i*0.11;
    g.gain.setValueAtTime(0.0001,s);
    g.gain.exponentialRampToValueAtTime(0.34,s+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,s+0.6);
    o.connect(g); g.connect(masterGain);
    o.start(s); o.stop(s+0.7);
  });
}

/* ---------- AMBIENT MUSIC BED ---------- */
let bgAudio=null, bgSourceNode=null;
function initAmbientMusic(){
  if(!audioCtx) return;
  if(!bgAudio){
    bgAudio=new Audio("assets/background-music.mp3");
    bgAudio.loop=true;
    bgAudio.crossOrigin="anonymous";
  }
  if(!bgSourceNode){
    bgSourceNode=audioCtx.createMediaElementSource(bgAudio);
    bgSourceNode.connect(masterGain);
  }
  bgAudio.volume=0.08;
  bgAudio.currentTime=0;
  bgAudio.play().catch(()=>{});
}
function stopAmbientMusic(){ if(bgAudio){ bgAudio.pause(); } }

/* ============================================================
   HELPERS & INIT
   ============================================================ */
const $=s=>document.querySelector(s);
const money=n=>"$"+Math.round(n).toLocaleString();
function costFmt(n){ return n.toLocaleString(); }
function sleep(ms){ return new Promise(r=>setTimeout(r, ms/room.speed)); }

function wireControls(){
  $("#backLobby").onclick=backToLobby;
  $("#pfBtn").onclick=showPF;
  $("#pfClose").onclick=()=>$("#pfModal").classList.add("hidden");
  $("#rechargeBtn").onclick=recharge;
  $("#detailClose").onclick=()=>$("#detailModal").classList.add("hidden");
  $("#autoBtn").onclick=()=>{ room.auto=!room.auto; $("#autoBtn").textContent=room.auto?"⏸ Pause":"▶ Resume"; };
  $("#muteBtn").onclick=()=>{ muted=!muted; if(masterGain) masterGain.gain.value=muted?0:0.5; $("#muteBtn").textContent=muted?"🔇 Muted":"🔊 Sound"; };
  document.querySelectorAll(".speedbar button").forEach(b=>b.onclick=()=>{
    room.speed=+b.dataset.spd;
    document.querySelectorAll(".speedbar button").forEach(x=>x.classList.toggle("active",x===b));
  });
  // lobby filters
  document.querySelectorAll("#modeFilter .fbtn").forEach(b=>b.onclick=()=>{
    lobby.filters.mode=b.dataset.mode;
    document.querySelectorAll("#modeFilter .fbtn").forEach(x=>x.classList.toggle("active",x===b));
    renderLobby();
  });
  document.querySelectorAll("#playersFilter .fbtn").forEach(b=>b.onclick=()=>{
    lobby.filters.players=b.dataset.pl;
    document.querySelectorAll("#playersFilter .fbtn").forEach(x=>x.classList.toggle("active",x===b));
    renderLobby();
  });
  $("#sortSel").onchange=e=>{ lobby.filters.sort=e.target.value; renderLobby(); };
  $("#resetFilters").onclick=()=>{
    lobby.filters={mode:"all",players:"all",sort:"high"};
    document.querySelectorAll("#modeFilter .fbtn").forEach(x=>x.classList.toggle("active",x.dataset.mode==="all"));
    document.querySelectorAll("#playersFilter .fbtn").forEach(x=>x.classList.toggle("active",x.dataset.pl==="all"));
    $("#sortSel").value="high";
    renderLobby();
  };
}

function init(){
  bankroll=loadBank(); setBank(bankroll,false);
  initLobby(); updateLobbyStats(); renderLobby();
  wireControls(); loadRealCards(); initAmbientParticles(); initPackTilt(); initViewerCounter();
}
init();
