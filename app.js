const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const els = {
  currentDb: $('#currentDb'), currentStat: $('#currentStat'), minStat: $('#minStat'), maxStat: $('#maxStat'), avgStat: $('#avgStat'),
  statusLabel: $('#statusLabel'), livePill: $('#livePill'), needle: $('#needle'), gaugeProgress: $('#gaugeProgress'),
  startBtn: $('#startBtn'), stopBtn: $('#stopBtn'), micStatusText: $('#micStatusText'), micStatusSub: $('#micStatusSub'),
  recordingTime: $('#recordingTime'), sensitivity: $('#sensitivity'), sensitivityLabel: $('#sensitivityLabel'),
  chart: $('#soundChart'), historyBody: $('#historyBody'), dateCard: $('#dateCard')
};

const state = {
  running: false, stream: null, audioContext: null, analyser: null, source: null,
  animationId: null, clockId: null, sampleTimer: null, startTime: 0, elapsedBefore: 0,
  sensitivity: 1, current: 62.8, min: 42.1, max: 88.4, avg: 65.7, readings: [],
  graph: [], graphWindow: 60, history: JSON.parse(localStorage.getItem('dbMeterHistory') || '[]')
};

const smoothWindow = [];
const dbPathLength = 433;

function clamp(n,min,max){return Math.min(max,Math.max(min,n));}
function fmtDb(n){return `${Number(n).toFixed(1)} dB`;}
function classify(db){
  if(db <= 30) return {label:'Quiet', cls:'quiet'};
  if(db <= 70) return {label:'Moderate', cls:'moderate'};
  if(db <= 100) return {label:'Loud', cls:'loud'};
  return {label:'Very Loud', cls:'very-loud'};
}
function formatDuration(ms){
  const sec=Math.floor(ms/1000); const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); const s=sec%60;
  return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
}
function nowTime(){return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});}
function updateDate(){
  const d=new Date();
  els.dateCard.innerHTML=`<div>▣ &nbsp; ${d.toLocaleDateString([], {weekday:'short', day:'2-digit', month:'short', year:'numeric'})}</div><strong>${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong>`;
}
function updateLabel(db){
  const status=classify(db); els.statusLabel.textContent=`● ${status.label}`; els.statusLabel.style.color=`var(--${status.cls === 'very-loud' ? 'red' : status.cls === 'moderate' ? 'yellow' : status.cls === 'loud' ? 'orange' : 'green'})`;
  return status;
}
function updateGauge(db){
  const pct=clamp(db/120,0,1); const angle=-90 + pct*180; // needle sweeps from left-up to right-up
  els.needle.setAttribute('transform',`rotate(${angle} 180 180)`);
  const visible=Math.max(0.02,pct)*dbPathLength;
  els.gaugeProgress.style.strokeDasharray=`${visible} ${dbPathLength}`;
}
function updateStats(){
  els.currentDb.textContent=state.current.toFixed(1); els.currentStat.textContent=fmtDb(state.current);
  els.minStat.textContent=fmtDb(state.min); els.maxStat.textContent=fmtDb(state.max); els.avgStat.textContent=fmtDb(state.avg);
  updateLabel(state.current); updateGauge(state.current);
}
function setReading(db){
  db=clamp(db,0,120); smoothWindow.push(db); if(smoothWindow.length>6) smoothWindow.shift();
  const smoothed=smoothWindow.reduce((a,b)=>a+b,0)/smoothWindow.length;
  state.current=smoothed; state.readings.push(smoothed); state.min=Math.min(state.min,smoothed); state.max=Math.max(state.max,smoothed);
  state.avg=state.readings.reduce((a,b)=>a+b,0)/state.readings.length;
  state.graph.push({t:Date.now(),db:smoothed});
  const cutoff=Date.now()-1800*1000; state.graph=state.graph.filter(p=>p.t>=cutoff);
  updateStats(); drawChart();
}

function drawChart(){
  const canvas=els.chart, rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.floor(rect.width*dpr)); canvas.height=Math.max(1,Math.floor(rect.height*dpr));
  const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=rect.width,h=rect.height; const pad={l:35,r:8,t:12,b:28}; const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  ctx.clearRect(0,0,w,h);
  ctx.font='11px Inter, system-ui, sans-serif'; ctx.fillStyle='#9ab3ce'; ctx.textBaseline='middle';
  [0,20,40,60,80,100,120].forEach(v=>{const y=pad.t+ch-(v/120)*ch;ctx.strokeStyle='rgba(47,82,117,.42)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(v,7,y);});
  for(let i=0;i<5;i++){const x=pad.l+(cw*i/4);ctx.strokeStyle='rgba(47,82,117,.24)';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,pad.t+ch);ctx.stroke();}
  ctx.fillText('dB',7,10);
  const start=Date.now()-state.graphWindow*1000; const pts=state.graph.filter(p=>p.t>=start);
  if(pts.length<2) return;
  const xy=pts.map(p=>({x:pad.l+((p.t-start)/(state.graphWindow*1000))*cw,y:pad.t+ch-(clamp(p.db,0,120)/120)*ch}));
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch); grad.addColorStop(0,'rgba(45,134,255,.35)');grad.addColorStop(1,'rgba(45,134,255,.02)');
  ctx.beginPath();xy.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(xy.at(-1).x,pad.t+ch);ctx.lineTo(xy[0].x,pad.t+ch);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();xy.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#438eff';ctx.lineWidth=2.5;ctx.shadowBlur=8;ctx.shadowColor='rgba(67,142,255,.35)';ctx.stroke();ctx.shadowBlur=0;
  const last=xy.at(-1);ctx.beginPath();ctx.arc(last.x,last.y,5,0,Math.PI*2);ctx.fillStyle='#4c98ff';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#dbeaff';ctx.stroke();
  ctx.fillStyle='#8da7c2';ctx.textAlign='left';ctx.fillText(timeLabel(start),pad.l,h-9);ctx.textAlign='center';ctx.fillText(timeLabel(start+state.graphWindow*500),pad.l+cw*.5,h-9);ctx.textAlign='right';ctx.fillText(timeLabel(Date.now()),w-pad.r,h-9);ctx.textAlign='left';
}
function timeLabel(ms){return new Date(ms).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}).replace(':00','');}

function renderHistory(){
  els.historyBody.innerHTML='';
  state.history.slice(0,8).forEach((row,index)=>{
    const status=classify(row.current);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${row.time}</td><td>${row.current.toFixed(1)}</td><td>${row.min.toFixed(1)}</td><td>${row.max.toFixed(1)}</td><td>${row.avg.toFixed(1)}</td><td>${row.duration}</td><td><span class="status-tag ${status.cls}">${status.label}</span></td><td><button class="delete-btn" data-index="${index}" title="Delete">▢</button></td>`;
    els.historyBody.appendChild(tr);
  });
  $$('.delete-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const i=Number(btn.dataset.index); state.history.splice(i,1); localStorage.setItem('dbMeterHistory',JSON.stringify(state.history)); renderHistory();
  }));
}
function saveMeasurement(){
  if(!state.readings.length) return;
  state.history.unshift({time:nowTime(),current:state.current,min:state.min,max:state.max,avg:state.avg,duration:formatDuration(Date.now()-state.startTime),timestamp:Date.now()});
  state.history=state.history.slice(0,25); localStorage.setItem('dbMeterHistory',JSON.stringify(state.history)); renderHistory();
}

function setSensitivity(v){
  state.sensitivity=Number(v); els.sensitivity.value=state.sensitivity;
  const map=state.sensitivity<.9?'Low':state.sensitivity>1.1?'High':'Medium'; els.sensitivityLabel.textContent=map;
}
function resetSession(){state.readings=[];state.min=120;state.max=0;state.avg=0; smoothWindow.length=0;state.graph=[];}

function rmsToDb(rms){
  // Browser microphone samples are normalized amplitude, not calibrated dB SPL.
  // This offset makes the UI useful as an estimate; it is not a standards-grade SPL conversion.
  const calibratedOffset=86;
  const raw=20*Math.log10(Math.max(rms,0.00001))+calibratedOffset;
  return clamp((raw*state.sensitivity)+((1-state.sensitivity)*60),20,120);
}

function readMicrophone(){
  if(!state.analyser) return;
  const buffer=new Float32Array(state.analyser.fftSize); state.analyser.getFloatTimeDomainData(buffer);
  let sum=0; for(const x of buffer) sum+=x*x; const rms=Math.sqrt(sum/buffer.length);
  setReading(rmsToDb(rms));
  if(state.running) state.animationId=requestAnimationFrame(readMicrophone);
}

async function startMeter(){
  try{
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is not supported by this browser.');
    if(state.running) return;
    state.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    state.audioContext=new (window.AudioContext||window.webkitAudioContext)();
    state.analyser=state.audioContext.createAnalyser(); state.analyser.fftSize=2048; state.analyser.smoothingTimeConstant=.65;
    state.source=state.audioContext.createMediaStreamSource(state.stream); state.source.connect(state.analyser);
    resetSession(); state.startTime=Date.now(); state.running=true;
    els.startBtn.disabled=true; els.stopBtn.disabled=false; els.livePill.textContent='LIVE';
    els.micStatusText.textContent='Microphone is active'; els.micStatusText.style.color='var(--green)'; els.micStatusSub.textContent='Live sound measurements are running.';
    tickRecording(); readMicrophone();
  }catch(err){
    els.micStatusText.textContent='Microphone unavailable'; els.micStatusText.style.color='var(--red)'; els.micStatusSub.textContent=err.message||'Permission was denied.';
    alert('Could not start the microphone. Allow microphone access and open this page from localhost or HTTPS.');
  }
}
function stopMeter(){
  if(!state.running) return;
  state.running=false; cancelAnimationFrame(state.animationId); clearInterval(state.clockId);
  if(state.stream) state.stream.getTracks().forEach(t=>t.stop());
  if(state.audioContext) state.audioContext.close(); state.audioContext=null; state.analyser=null; state.source=null; state.stream=null;
  els.startBtn.disabled=false; els.stopBtn.disabled=true; els.livePill.textContent='IDLE';
  els.micStatusText.textContent='Microphone is ready'; els.micStatusText.style.color='var(--green)'; els.micStatusSub.textContent='Measurement saved to local history.';
  saveMeasurement();
}
function tickRecording(){
  clearInterval(state.clockId); state.clockId=setInterval(()=>{if(state.running)els.recordingTime.textContent=formatDuration(Date.now()-state.startTime);},250);
}

els.startBtn.addEventListener('click',startMeter); els.stopBtn.addEventListener('click',stopMeter);
els.sensitivity.addEventListener('input',e=>setSensitivity(e.target.value));
$$('.preset').forEach(btn=>btn.addEventListener('click',()=>setSensitivity(btn.dataset.value)));
$$('.range-btn').forEach(btn=>btn.addEventListener('click',()=>{ $$('.range-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); state.graphWindow=Number(btn.dataset.range); drawChart(); }));
$('#viewAllBtn').addEventListener('click',()=>$('#history').scrollIntoView({behavior:'smooth',block:'start'}));
$('#themeBtn').addEventListener('click',()=>document.body.classList.toggle('light'));
$('#learnBtn').addEventListener('click',()=>$('#learnModal').classList.remove('hidden'));
$('#closeModal').addEventListener('click',()=>$('#learnModal').classList.add('hidden')); $('#closeModal2').addEventListener('click',()=>$('#learnModal').classList.add('hidden'));
$('#learnModal').addEventListener('click',e=>{if(e.target.id==='learnModal')e.currentTarget.classList.add('hidden')});
window.addEventListener('resize',drawChart);
$$('.nav-item').forEach(a=>a.addEventListener('click',()=>{$$('.nav-item').forEach(x=>x.classList.remove('active'));a.classList.add('active')}));

setSensitivity(1); updateDate(); setInterval(updateDate,1000); updateStats(); renderHistory();
// Demo motion before the user activates the microphone, so the interface never looks empty.
let demoPhase=0; setInterval(()=>{if(!state.running){demoPhase+=.25;state.current=62.8+Math.sin(demoPhase)*5+Math.sin(demoPhase*.33)*2;state.min=42.1;state.max=88.4;state.avg=65.7;updateStats();}},700);
