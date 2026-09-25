let DATA=null, mode='no', episode='E01', second=0;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pretty=x=>JSON.stringify(x,null,2);
const color=v=>{
  if(!v)return'gray';
  if(v.startsWith('DARK_GREEN'))return'green';
  if(v.startsWith('LIGHT_GREEN'))return'lightgreen';
  if(v.startsWith('YELLOW'))return'yellow';
  if(v.startsWith('RED'))return'red';
  return'gray';
};
const modeLabel=k=>DATA.mode_labels[k];
const currentCase=()=>DATA.cases.find(c=>c.episode_id===episode&&c.source_time_s===second);

function setup(){
  const eps=[...new Set(DATA.cases.map(c=>c.episode_id))];
  $('#episode').innerHTML=eps.map(e=>'<option>'+e+'</option>').join('');
  $('#limits').innerHTML=DATA.limitations.map(x=>'<span class="pill">'+esc(x)+'</span>').join('');
  document.querySelectorAll('.mode-tabs button').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('.mode-tabs button').forEach(x=>x.classList.toggle('active',x===b));render();});
  $('#episode').onchange=e=>{episode=e.target.value;second=0;$('#time').value=0;render();};
  $('#time').oninput=e=>{second=+e.target.value;render();};
  $('#prev').onclick=()=>{second=Math.max(0,second-1);$('#time').value=second;render();};
  $('#next').onclick=()=>{second=Math.min(29,second+1);$('#time').value=second;render();};
  renderSummary(); render();
}

function renderSummary(){
  const s=DATA.summary;
  const vc=m=>{const x=(s.modes.find(z=>z.mode===m)||{}).verdict_counts||{};return 'G '+(x.DARK_GREEN_PREFERRED||0)+' · LG '+(x.LIGHT_GREEN_SAFE_HOLD_PROGRESS_DEBT||0)+' · Y '+(x.YELLOW_QUESTION_QUALITY_DEGRADED||0)+' · R '+((x.RED_CONTRACT_OR_SAFETY_ERROR||0)+(x.RED_SEMANTIC_MISMATCH||0)+(x.RED_SCHEMA_OR_EXECUTION||0));};
  const cards=[
    ['FR model',s.fr_model],['Vision model',s.vision_model],
    ['No Vision',vc('fixed-no-vision')],['Real Vision · fixed',vc('fixed-real-vision-teacher-schedule')],
    ['Real Vision · self-history',vc('self-history-real-vision-open-loop')],
    ['Teacher Vision calls',s.teacher_vision_calls],['Self-history Vision calls',s.self_history_vision_calls],
    ['Vision median',s.vision_latency_actual_mini_pc_ms?s.vision_latency_actual_mini_pc_ms.median+' ms':'—']
  ];
  $('#summary').innerHTML=cards.map(x=>'<div class="metric"><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>').join('');
}
function visionHtml(c,k){
  if(k==='no') return '<div class="vision-call"><b>No Vision channel.</b> latest_visual_answer and visual_qa_history are intentionally empty.</div>';
  const calls=k==='vision'?c.vision_calls.fixed:c.vision_calls.self;
  const input=c.modes[k].input, latest=input.latest_visual_answer;
  let html='';
  if(calls.length) for(const v of calls){
    html+='<div class="vision-call"><div class="q">Call @ t='+esc(v.question_time_s)+'s · '+esc(v.question)+'</div>'+
      '<div class="a">'+esc(v.answer||v.raw_output||'No valid answer')+'</div>'+
      '<div class="timing">source '+esc(v.source_time_s)+'s · available '+Number(v.available_time_s).toFixed(2)+'s · measured '+esc(v.wall_ms)+' ms</div></div>';
  }
  if(!calls.length) html+='<div class="vision-call">No Vision call starts on this frame.</div>';
  if(latest) html+='<div class="vision-call"><b>Latest answer visible to FR now</b><div class="a">'+esc(latest.answer)+'</div><div class="timing">frame '+esc(latest.frame_alignment)+' · navigation usable '+esc(latest.navigation_usable)+' · source age '+esc(latest.source_frame_age_s)+'s</div></div>';
  else html+='<div class="vision-call"><b>No completed Vision answer visible to FR at this second.</b></div>';
  if(k==='self'&&c.vision_calls.ignored_self.length) html+='<div class="vision-call"><b>Question suppressed while Vision pending</b><div class="a">'+esc(c.vision_calls.ignored_self.map(x=>x.question).join(' | '))+'</div></div>';
  return html;
}

function compareHtml(c){
  const keys=['no','vision','self'];
  return '<table><thead><tr><th>Mode</th><th>FR output</th><th>Verdict</th><th>Latest Vision</th><th>Request SHA</th></tr></thead><tbody>'+
    keys.map(k=>{const m=c.modes[k],o=m.output||{},e=m.evaluation,lv=m.input.latest_visual_answer;
      return '<tr><td class="mode-name">'+esc(modeLabel(k))+'</td><td><b>'+esc(o.direction)+'</b> '+esc(o.intensity??'')+
      '<br>'+esc(o.visual_question||'no question')+'</td><td><span class="badge '+color(e.verdict)+'">'+esc(e.verdict)+'</span></td>'+
      '<td>'+esc(lv?lv.answer:'—')+'</td><td><code>'+esc(m.request_sha256.slice(0,12))+'…</code></td></tr>';}).join('')+
    '</tbody></table>';
}
function renderTimeline(){
  const rows=DATA.cases.filter(c=>c.episode_id===episode);
  $('#timeline').innerHTML=rows.map(c=>{const e=c.modes[mode].evaluation.verdict;return '<button title="'+esc(c.id+' '+e)+'" class="tick '+color(e)+(c.source_time_s===second?' sel':'')+'" data-t="'+c.source_time_s+'"></button>';}).join('');
  document.querySelectorAll('.tick').forEach(b=>b.onclick=()=>{second=+b.dataset.t;$('#time').value=second;render();});
}
function render(){
  const c=currentCase(); if(!c)return;
  const m=c.modes[mode], out=m.output||{}, ev=m.evaluation;
  $('#timeLabel').textContent=second+'s'; $('#caseId').textContent=c.id+' · '+modeLabel(mode);
  $('#frame').src=c.image; $('#mission').textContent=c.mission;
  $('#verdict').className='badge '+color(ev.verdict); $('#verdict').textContent=ev.verdict;
  $('#decision').innerHTML='<div class="kv"><b>Direction</b><span>'+esc(out.direction)+'</span><b>Intensity</b><span>'+esc(out.intensity??'null')+
    '</span><b>Visual question</b><span>'+esc(out.visual_question||'—')+'</span><b>Latency</b><span>'+esc(m.wall_ms)+' ms</span>'+
    '<b>Request SHA-256</b><code>'+esc(m.request_sha256)+'</code></div><div class="reason">'+esc(out.reason||'')+'</div>';
  $('#vision').innerHTML=visionHtml(c,mode);
  $('#evaluation').innerHTML='<div class="kv"><b>Verdict</b><span>'+esc(ev.verdict)+'</span><b>Question quality</b><span>'+esc(ev.question_quality)+'</span><b>Reason codes</b><span>'+esc((ev.codes||[]).join(', '))+'</span><b>Supported directions</b><span>'+esc((ev.supported||[]).join(', ')||'none')+'</span></div>';
  $('#compare').innerHTML=compareHtml(c); $('#input').textContent=pretty(m.input);
  $('#geometry').textContent=pretty({geometry:c.geometry,commands:c.commands,posture:c.posture});
  $('#reference').textContent=pretty({current_frame_reference:c.current_frame_reference,expected:c.expected,training_eligibility:c.training_eligibility,semantic_v15_reference_output:c.semantic_v15_reference_output});
  $('#raw').textContent=m.raw_output; renderTimeline();
}
fetch('s42-three-mode-review.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(d=>{DATA=d;setup();}).catch(e=>{document.body.innerHTML='<pre>Dashboard load failed: '+esc(e)+'</pre>';});
