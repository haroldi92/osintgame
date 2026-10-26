'use strict';
const rows=document.getElementById('rankingRows');
const message=document.getElementById('rankingMessage');
function duration(ms){const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');}
let loading=false;
async function refreshRankings(){
  if(loading)return;
  loading=true;
  try{
    const results=await BB.rpc('bb_rankings');
    rows.replaceChildren();
    for(const result of results){
      const tr=document.createElement('tr');
      const team=document.createElement('td');team.textContent=result.team;
      const time=document.createElement('td');time.textContent=duration(result.timeMs);
      tr.append(team,time);rows.append(tr);
    }
    message.textContent=results.length?'':'Noch keine abgeschlossenen Teams.';
    message.hidden=results.length>0;
  }catch(error){message.hidden=false;message.textContent='Ranking aktuell nicht erreichbar. Bitte später erneut versuchen.';}
  finally{loading=false;}
}
refreshRankings();
setInterval(()=>{if(!document.hidden)refreshRankings();},30000);
