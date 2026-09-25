const gradeNames={dark_green:"Dark green",light_green:"Light green",yellow:"Yellow",red:"Red"};
const fmt=n=>n==null?"—":new Intl.NumberFormat("en",{maximumFractionDigits:0}).format(n);
const ms=n=>n==null?"—":`${fmt(n)} ms`;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pretty=value=>JSON.stringify(value??{},null,2);
let labData=null;
const combinedCache={};
const pct=n=>n==null?"—":`${(n*100).toFixed(1)}%`;

function tableMarkup(rows){
  return `<div class="table-wrap"><table><thead><tr><th>Model / config</th><th>Cases</th><th class="dark_green">Dark green</th><th class="light_green">Light green</th><th class="yellow">Yellow</th><th class="red">Red</th><th>Median</th><th>p95</th><th>Valid</th></tr></thead><tbody>${rows.map(row=>{
    const complete=row.status==="COMPLETE";
    return `<tr><td><button class="row-link" data-row="${esc(row.id)}"><strong>${esc(row.model)}</strong><span>${esc(row.config)}</span><small>${esc(row.benchmark)}</small></button></td><td>${row.cases}</td>${complete?`<td class="score dark_green">${row.verdict_counts.dark_green}</td><td class="score light_green">${row.verdict_counts.light_green}</td><td class="score yellow">${row.verdict_counts.yellow}</td><td class="score red">${row.verdict_counts.red}</td>`:`<td colspan="4" class="plain-status">${esc(row.status)}</td>`}<td>${ms(row.median_ms)}</td><td>${ms(row.p95_ms)}</td><td>${row.valid}/${row.cases}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderTables(){
  const mounts={audio:"#table-audio",vision:"#table-vision",vision_decision:"#table-vision-decision",reasoning:"#table-reasoning"};
  Object.entries(mounts).forEach(([group,selector])=>document.querySelector(selector).innerHTML=tableMarkup(labData.tables[group]));
  document.querySelectorAll(".row-link").forEach(button=>button.addEventListener("click",()=>{location.hash=`row=${encodeURIComponent(button.dataset.row)}`}));
  document.querySelector("#release-hash").textContent=`data ${(labData.lineage.latest_review_sha256||labData.lineage.s32_full_review_sha256).slice(0,12)}…`;
  const past=labData.past_runs[0];
  const pastButton=document.querySelector("#past-run-link");
  pastButton.hidden=!past;
  if(past)pastButton.onclick=()=>{location.hash=`past=${encodeURIComponent(past.id)}`};
  renderCombinedTable();
}

function renderCombinedTable(){
  const rows=labData.combined_loop_runs||[];
  document.querySelector("#table-combined-loop").innerHTML=`<div class="table-wrap compact-table"><table><thead><tr><th>Run</th><th>Scenarios</th><th>Local green</th><th>Visual queries</th><th>Direction changes</th><th>Duration</th><th>Overall</th></tr></thead><tbody>${rows.map(row=>`<tr><td><button class="combined-run-link" data-combined="${esc(row.id)}"><strong>${esc(row.label)}</strong><small>${esc(row.date)}</small></button></td><td>${row.scenario_count}</td><td>${row.local_green}/${row.local_items} · ${pct(row.local_green_rate)}</td><td>${row.visual_query_count}</td><td>${row.direction_changes}</td><td>${row.source_duration_s}s</td><td>${Object.entries(row.overall_counts).filter(([,count])=>count).map(([verdict,count])=>`${gradeNames[verdict]} ${count}`).join(" · ")}</td></tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll(".combined-run-link").forEach(button=>button.onclick=()=>{location.hash=`combined=${encodeURIComponent(button.dataset.combined)}`});
}

function findRow(id){
  for(const rows of Object.values(labData.tables)){const row=rows.find(item=>item.id===id);if(row)return row}
  return null;
}

function renderRecord(row,record){
  const media=document.querySelector("#media-panel");
  media.innerHTML=record.media_type==="image"
    ? `<img src="${esc(record.media)}" alt="${esc(record.case_id)} frozen frame"><small>${esc(record.case_id)} · ${esc(record.media_sha256)}</small>`
    : `<audio controls preload="metadata" src="${esc(record.media)}"></audio><small>${esc(record.case_id)} · ${esc(record.media_sha256)}</small>`;
  document.querySelector("#detail-verdict").innerHTML=`<span class="grade ${esc(record.verdict)}">${gradeNames[record.verdict]}</span><p>${esc(record.grading_reason)}</p>`;
  document.querySelector("#detail-latency").textContent=ms(record.latency_ms);
  document.querySelector("#detail-status").textContent=`${record.status} · ${record.valid?"valid":"invalid/incomplete"}`;
  document.querySelector("#detail-input").textContent=pretty(record.exact_input);
  document.querySelector("#detail-output").textContent=typeof record.raw_response==="string"?record.raw_response:pretty(record.raw_response);
  document.querySelector("#detail-technical").textContent=pretty({row:row.technical,case:record.technical,verified_reference:record.verified_reference,decision_reference:record.decision_reference});
}

function showDetail(rowId){
  const row=findRow(rowId),records=labData.detail[rowId];
  if(!row||!records?.length){location.hash="";return}
  document.querySelector("#main-view").hidden=true;
  document.querySelector("#past-view").hidden=true;
  document.querySelector("#combined-view").hidden=true;
  document.querySelector("#scenario-view").hidden=true;
  document.querySelector("#detail-view").hidden=false;
  document.querySelector("#detail-model").textContent=row.model;
  document.querySelector("#detail-config").textContent=`${row.config} · ${row.benchmark}`;
  const selector=document.querySelector("#case-selector");
  selector.innerHTML=records.map((record,index)=>`<option value="${index}">${esc(record.case_id)}</option>`).join("");
  selector.onchange=()=>renderRecord(row,records[Number(selector.value)]);
  renderRecord(row,records[0]);
  document.title=`${row.model} · Model Lab`;
  window.scrollTo({top:0,behavior:"instant"});
}

function showPast(id){
  const run=labData.past_runs.find(item=>item.id===id);
  if(!run){location.hash="";return}
  const data=run.data;
  document.querySelector("#main-view").hidden=true;
  document.querySelector("#detail-view").hidden=true;
  document.querySelector("#combined-view").hidden=true;
  document.querySelector("#scenario-view").hidden=true;
  document.querySelector("#past-view").hidden=false;
  document.querySelector("#past-title").textContent=`${run.date} · ${run.id}`;
  const events=data.audio.events||[];
  const actions=Object.entries(data.action_distribution||{}).map(([episode,counts])=>`${episode}: ${Object.entries(counts).map(([action,count])=>`${action} ${count}`).join(", ")}`).join(" · ");
  document.querySelector("#past-content").innerHTML=`<dl class="facts past-facts"><dt>Episodes</dt><dd>${data.episodes.join(", ")}</dd><dt>Audio calls</dt><dd>${data.audio.call_count}</dd><dt>Exact / equivalent</dt><dd>${data.audio.exact_or_equivalent_count}/${data.audio.call_count}</dd><dt>Median</dt><dd>${ms(data.audio.latency_ms.median)}</dd><dt>Range</dt><dd>${ms(data.audio.latency_ms.min)}–${ms(data.audio.latency_ms.max)}</dd><dt>Actions</dt><dd>${esc(actions)}</dd></dl><div class="table-wrap"><table><thead><tr><th>Episode / event</th><th>Expected</th><th>Actual</th><th>Latency</th><th>Before next FR</th></tr></thead><tbody>${events.map(event=>`<tr><td>${esc(event.episode_id)} · ${esc(event.event_id)}</td><td>${esc(event.expected)}</td><td>${esc(event.actual)}</td><td>${ms(event.latency_ms)}</td><td>${event.arrived_before_next_fr_dispatch==null?"terminal":event.arrived_before_next_fr_dispatch?"yes":"no"}</td></tr>`).join("")}</tbody></table></div><details><summary>Evidence identity</summary><pre>${esc(pretty(data.evidence))}</pre></details>`;
  document.title=`S30 · Model Lab`;
  window.scrollTo({top:0,behavior:"instant"});
}

function showCombined(id){
  const run=(labData.combined_loop_runs||[]).find(item=>item.id===id);
  if(!run){location.hash="";return}
  document.querySelector("#main-view").hidden=true;
  document.querySelector("#detail-view").hidden=true;
  document.querySelector("#past-view").hidden=true;
  document.querySelector("#scenario-view").hidden=true;
  document.querySelector("#combined-view").hidden=false;
  document.querySelector("#combined-title").textContent=`${run.label} · ${run.date}`;
  document.querySelector("#combined-scenarios").innerHTML=`<div class="table-wrap compact-table"><table><thead><tr><th>Scenario / mission</th><th>Local green</th><th>Visual queries</th><th>Useful</th><th>Direction changes</th><th>Duration</th><th>Overall verdict</th></tr></thead><tbody>${run.scenarios.map(row=>`<tr><td><button class="scenario-link" data-run="${esc(run.id)}" data-episode="${esc(row.episode_id)}"><strong>${esc(row.episode_id)}</strong><span>${esc(row.mission)}</span></button></td><td>${row.local_green}/${row.local_items} · ${pct(row.local_green_rate)}</td><td>${row.visual_query_count}</td><td>${row.useful_queries} full · ${row.partially_useful_queries} partial</td><td>${row.direction_changes}</td><td>${row.source_duration_s}s source · ${row.wall_duration_s.toFixed(1)}s wall</td><td class="verdict-cell ${esc(row.overall_verdict)}">${esc(gradeNames[row.overall_verdict])}</td></tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll(".scenario-link").forEach(button=>button.onclick=()=>{location.hash=`scenario=${encodeURIComponent(button.dataset.run)}:${encodeURIComponent(button.dataset.episode)}`});
  document.title=`S35 · Model Lab`;
  window.scrollTo({top:0,behavior:"instant"});
}

async function loadCombined(run){
  if(!combinedCache[run.id]){
    const response=await fetch(run.detail_file);
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    combinedCache[run.id]=await response.json();
  }
  return combinedCache[run.id];
}

function eventSummary(event){
  if(event.kind==="audio_mission")return `${event.exact_output.audio.transcript} · ${event.exact_output.command_state.intent||"unparsed"}`;
  if(event.kind==="fr_question")return event.exact_output.visual_question;
  if(event.kind==="vision_answer")return `${event.exact_output.parsed.answer} · ${event.exact_output.parsed.certainty}`;
  if(event.kind==="fr_decision")return `${event.exact_output.parsed.direction}${event.exact_output.parsed.intensity?` / ${event.exact_output.parsed.intensity}`:""} · ${event.exact_output.parsed.reason}`;
  return event.title;
}

async function showScenario(runId,episodeId){
  const run=(labData.combined_loop_runs||[]).find(item=>item.id===runId);
  if(!run){location.hash="";return}
  const data=await loadCombined(run);
  const scenario=data.scenario_details.find(item=>item.episode_id===episodeId);
  if(!scenario){location.hash=`combined=${encodeURIComponent(runId)}`;return}
  document.querySelector("#main-view").hidden=true;
  document.querySelector("#detail-view").hidden=true;
  document.querySelector("#past-view").hidden=true;
  document.querySelector("#combined-view").hidden=true;
  document.querySelector("#scenario-view").hidden=false;
  document.querySelector("#scenario-title").textContent=`${run.label} · ${scenario.episode_id}`;
  document.querySelector("#scenario-mission").textContent=scenario.mission;
  const s=scenario.summary;
  document.querySelector("#scenario-summary").innerHTML=`<dl class="facts scenario-facts"><dt>Local green</dt><dd>${s.local_green}/${s.local_items} · ${pct(s.local_green_rate)}</dd><dt>Visual queries</dt><dd>${s.visual_query_count} · ${s.useful_queries} useful · ${s.partially_useful_queries} partial</dd><dt>Direction changes</dt><dd>${s.direction_changes}</dd><dt>Duration</dt><dd>${s.source_duration_s}s source · ${s.wall_duration_s.toFixed(1)}s wall</dd><dt>Overall</dt><dd><span class="grade ${esc(s.overall_verdict)}">${esc(gradeNames[s.overall_verdict])}</span> ${esc(s.overall_rationale)}</dd></dl>`;
  document.querySelector("#scenario-timeline").innerHTML=scenario.events.map(event=>`<article class="timeline-event"><header><h3>${esc(event.title)}</h3><span class="event-meta">t=${event.source_time_s}s${event.latency_ms==null?"":` · ${ms(event.latency_ms)}`}</span></header>${event.verdict?`<span class="grade ${esc(event.verdict)}">${esc(gradeNames[event.verdict])}</span>`:""}${event.media?`<img class="timeline-frame" src="${esc(event.media)}" alt="${esc(event.event_id)} frame">`:""}<p>${esc(eventSummary(event))}</p>${event.rationale?`<p>${esc(event.rationale)}</p>`:""}<details><summary>Exact input / output</summary><pre>${esc(pretty({event_id:event.event_id,causal_parent_event_id:event.causal_parent_event_id,input:event.exact_input,output:event.exact_output}))}</pre></details></article>`).join("");
  document.title=`${scenario.episode_id} · ${run.label} · Model Lab`;
  window.scrollTo({top:0,behavior:"instant"});
}

async function route(){
  const raw=location.hash.slice(1);
  const [kind,value]=raw.split("=",2);
  if(kind==="row"&&value){showDetail(decodeURIComponent(value));return}
  if(kind==="past"&&value){showPast(decodeURIComponent(value));return}
  if(kind==="combined"&&value){showCombined(decodeURIComponent(value));return}
  if(kind==="scenario"&&value){const parts=value.split(":",2);await showScenario(decodeURIComponent(parts[0]),decodeURIComponent(parts[1]));return}
  document.querySelector("#main-view").hidden=false;
  document.querySelector("#detail-view").hidden=true;
  document.querySelector("#past-view").hidden=true;
  document.querySelector("#combined-view").hidden=true;
  document.querySelector("#scenario-view").hidden=true;
  document.title="Edge AI Training · Model Lab";
}

document.querySelector("#back-button").onclick=()=>{location.hash=""};
document.querySelector("#past-back-button").onclick=()=>{location.hash=""};
document.querySelector("#combined-back-button").onclick=()=>{location.hash=""};
document.querySelector("#scenario-back-button").onclick=()=>{const raw=location.hash.slice(1).split("=",2)[1]||"";const run=decodeURIComponent(raw.split(":",1)[0]);location.hash=`combined=${encodeURIComponent(run)}`};
window.addEventListener("hashchange",route);
fetch("model-lab-data-pre-s43.json").then(response=>{if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()}).then(data=>{labData=data;renderTables();route()}).catch(error=>{document.body.innerHTML=`<p class="load-error">Could not load Model Lab data: ${esc(error.message)}</p>`});
