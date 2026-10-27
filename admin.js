'use strict';
const $=id=>document.getElementById(id);
const linkType=new URLSearchParams(location.hash.replace(/^#/,'')).get('type');
let invitation=new URLSearchParams(location.search).get('setup')==='1'||linkType==='invite'||linkType==='recovery';
let teams=[],clock=null,refreshing=false,authorized=false,pendingDelete=null,watchTeamId=null;
function duration(ms){const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');}
function now(){return clock?clock.time+performance.now()-clock.mono:Date.now();}
function time(s){return s.start?Math.max(0,(s.end||now())-s.start):0;}
function status(s){return s.end?'Abgeschlossen':s.start?'Läuft':'Bereit';}
function sorted(){return teams.slice().sort((a,b)=>{const x=a.state,y=b.state;if(x.end&&y.end)return time(x)+x.penalty-time(y)-y.penalty;return Number(!!y.end)-Number(!!x.end)||Number(!!y.start)-Number(!!x.start)||x.team.localeCompare(y.team,'de');});}
function render(){let place=0;$('teamRows').replaceChildren();const filter=$('filter').value.trim().toLocaleLowerCase('de');for(const t of sorted()){const s=t.state;const rank=s.end?++place:'—';if(!s.team.toLocaleLowerCase('de').includes(filter))continue;const tr=document.createElement('tr');const remaining=90*60000-time(s);const values=[rank,s.team,status(s),s.start?(remaining<0?'−':'')+duration(Math.abs(remaining)):'01:30:00','+'+duration(s.penalty),s.end?duration(time(s)+s.penalty):'—',s.discovered.length+'/6',s.unlocked.length,s.attempts,t.devices];values.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});const td=document.createElement('td'),details=document.createElement('button'),remove=document.createElement('button');if(s.start&&!s.end){const watch=document.createElement('button');watch.textContent='Live-Ansicht';watch.onclick=()=>showWatch(t.id);td.append(watch);}details.textContent='Öffnen';details.onclick=()=>showDetails(t);remove.textContent='Löschen';remove.className='delete-button';remove.onclick=()=>openDelete(t);td.append(details,remove);tr.append(td);$('teamRows').append(tr);}$('summary').textContent=`${teams.length} Teams · ${teams.filter(t=>t.state.start&&!t.state.end).length} laufend · ${teams.filter(t=>t.state.end).length} abgeschlossen`;renderWatch();}
function showDetails(t){const s=t.state;$('teamDetailTitle').textContent=s.team;const rows=['Status: '+status(s),'Gruppe bestätigt: '+(s.groupFound?'Ja':'Nein'),'Ermittlungszeit: '+duration(time(s)),'Strafzeit: '+duration(s.penalty),'Endwertung: '+(s.end?duration(time(s)+s.penalty):'Noch offen'),'','Personen und Notizen:',...s.discovered.map(n=>s.people[n]+': '+(s.notes[n]||'—')),'','Einsatzprotokoll:',...s.events.map(e=>duration(e.at)+' / '+e.message)];$('teamDetailBody').textContent=rows.join('\n');$('teamDetails').showModal();}
function showWatch(id){watchTeamId=id;renderWatch();$('watchDialog').showModal();}
function addWatchCard(parent,title,lines){const card=document.createElement('section');card.className='watch-card';const h=document.createElement('h3');h.textContent=title;card.append(h);for(const line of lines){const p=document.createElement('p');p.textContent=line;card.append(p);}parent.append(card);}
function renderWatch(){if(!watchTeamId)return;const t=teams.find(x=>x.id===watchTeamId);if(!t){$('watchDialog').close();watchTeamId=null;return;}const s=t.state;$('watchTitle').textContent=s.team+' · '+status(s);const body=$('watchBody');body.replaceChildren();const stats=document.createElement('div');stats.className='watch-stats';for(const v of [s.start?(90*60000-time(s)<0?'−':'')+duration(Math.abs(90*60000-time(s))):'01:30:00','Strafen +'+duration(s.penalty),s.discovered.length+'/6 Personen',s.attempts+' Codeversuche']){const span=document.createElement('span');span.textContent=v;stats.append(span);}body.append(stats);const grid=document.createElement('div');grid.className='watch-grid';addWatchCard(grid,'Ermittlungen',['Facebook-Gruppe: '+(s.groupFound?'bestätigt':'noch offen'),...s.discovered.map(n=>(s.people[n]||n)+' — '+(s.notes[n]||'keine Notiz'))]);addWatchCard(grid,'Tipps und Fortschritt',['Freigeschaltete Tipps: '+s.unlocked.length,...s.unlocked.map(k=>k.replace(':',' · Tipp '))]);addWatchCard(grid,'Einsatzprotokoll',s.events.length?s.events.slice(-12).reverse().map(e=>duration(e.at)+' · '+e.message):['Noch keine Aktionen']);body.append(grid);}
$('closeWatch').onclick=()=>$('watchDialog').close();$('watchDialog').onclose=()=>{watchTeamId=null;};
function openDelete(t){pendingDelete=t;$('deleteTeamName').textContent=t.state.team;$('deleteConfirmName').value='';$('deleteMessage').textContent='';$('deleteDialog').showModal();}
$('cancelDelete').onclick=()=>$('deleteDialog').close();
$('deleteDialog').onclose=()=>{pendingDelete=null;};
$('deleteForm').onsubmit=async e=>{e.preventDefault();if(!pendingDelete)return;if($('deleteConfirmName').value.trim()!==pendingDelete.state.team){$('deleteMessage').textContent='Teamname stimmt nicht überein.';return;}const button=e.submitter;button.disabled=true;try{const result=await BB.rpc('bb_admin_delete',{p_team_id:pendingDelete.id});if(!result.deleted)throw new Error('Das Team wurde nicht gefunden.');$('deleteDialog').close();await refresh();}catch(err){$('deleteMessage').textContent=err.message;}finally{button.disabled=false;}};
async function refresh(){if(refreshing)return;refreshing=true;try{const data=await BB.rpc('bb_admin');if(data.error)throw new Error(data.error);teams=data.teams;clock={time:data.serverNow,mono:performance.now()};authorized=true;$('adminLogin').hidden=true;if(invitation){$('passwordSetup').hidden=false;$('dashboard').hidden=true;return;}$('passwordSetup').hidden=true;$('dashboard').hidden=false;startHelpMonitor();$('adminMessage').textContent='';$('updated').textContent='Zuletzt synchronisiert: '+new Date().toLocaleTimeString('de-DE');render();}catch(e){$('adminMessage').textContent=e.message;if(!authorized){$('dashboard').hidden=true;$('adminLogin').hidden=false;}}finally{refreshing=false;}}
$('adminForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const {error}=await BB.getClient().auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw new Error('Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.');await refresh();}catch(e){$('adminMessage').textContent=e.message;}finally{button.disabled=false;}};
$('requestPasswordSetup').onclick=async e=>{const email=$('email');if(!email.reportValidity())return;const button=e.currentTarget;button.disabled=true;try{const {error}=await BB.getClient().auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin+location.pathname+'?setup=1'});if(error)throw error;$('adminMessage').textContent='Ein Link zum Festlegen des Passworts wurde an diese Adresse gesendet. Bitte auch den Spam-Ordner prüfen.';}catch(err){$('adminMessage').textContent='Der Einrichtungslink konnte nicht gesendet werden: '+err.message;}finally{button.disabled=false;}};
$('filter').oninput=render;$('refresh').onclick=refresh;$('closeDetails').onclick=()=>$('teamDetails').close();$('signOut').onclick=async()=>{await BB.getClient().auth.signOut();location.reload();};
function csvCell(v){const text=String(v??'');return '"'+(/^[\s]*[=+@\-\t\r]/.test(text)?"'":'')+text.replace(/"/g,'""')+'"';}
$('exportCsv').onclick=()=>{let rank=0;const rows=[['Platz','Team','Status','Ermittlungszeit','Strafzeit','Endwertung','Gruppe bestätigt','Personen','Tipps','Codeversuche','Zugeordnete Geräte'],...sorted().map(t=>{const s=t.state;return [s.end?++rank:'',s.team,status(s),duration(time(s)),duration(s.penalty),s.end?duration(time(s)+s.penalty):'',s.groupFound?'Ja':'Nein',s.discovered.length,s.unlocked.length,s.attempts,t.devices];})];const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='BLACKBOX-Auswertung.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
setInterval(()=>{if(authorized&&!document.hidden)refresh();},5000);setInterval(()=>{if(authorized)render();},1000);
BB.getClient().auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'&&session){invitation=true;setTimeout(refresh,0);}});
(async()=>{try{const {data}=await BB.getClient().auth.getSession();if(data.session&&!data.session.user.is_anonymous)await refresh();}catch(e){$('adminMessage').textContent=e.message;}})();

$('passwordForm').onsubmit=async e=>{e.preventDefault();if($('newPassword').value!==$('repeatPassword').value){$('adminMessage').textContent='Die Passwörter stimmen nicht überein.';return;}const button=e.submitter;button.disabled=true;try{const {error}=await BB.getClient().auth.updateUser({password:$('newPassword').value});if(error)throw error;$('newPassword').value='';$('repeatPassword').value='';invitation=false;$('passwordSetup').hidden=true;await refresh();}catch(e){$('adminMessage').textContent=e.message;}finally{button.disabled=false;}};

let helpChannel=null,helpLoading=false,helpAgain=false,helpSignature='',helpToastTimer=null;
const seenHelpCalls=new Set(),helpBaseTitle=document.title;
function updateNotificationButton(){
 const b=$('enableHelpNotifications');
 if(!('Notification' in window)){b.disabled=true;b.textContent='Meldungen werden im Dashboard angezeigt';return;}
 b.disabled=Notification.permission==='granted'||Notification.permission==='denied';
 b.textContent=Notification.permission==='granted'?'Browser-Benachrichtigungen aktiv ✓':Notification.permission==='denied'?'Browser-Benachrichtigungen im Browser blockiert':'Browser-Benachrichtigungen aktivieren';
}
$('enableHelpNotifications').onclick=async()=>{
 try{await Notification.requestPermission();}catch(e){$('helpAdminMessage').textContent='Browser-Benachrichtigungen sind hier nicht verfügbar. Hilferufe erscheinen weiterhin im Dashboard.';}
 updateNotificationButton();
};
function notifyHelp(call){
 if(seenHelpCalls.has(call.request_id))return;
 seenHelpCalls.add(call.request_id);
 const message='Team „'+call.team_name+'“ ruft die Spielleitung.';
 $('helpToast').textContent=message;$('helpToast').hidden=false;
 clearTimeout(helpToastTimer);helpToastTimer=setTimeout(()=>{$('helpToast').hidden=true;},12000);
 if('Notification' in window&&Notification.permission==='granted'){
  try{const n=new Notification('BLACKBOX · Hilferuf',{body:message,tag:'help-'+call.request_id});
   n.onclick=()=>{window.focus();$('helpRequests').scrollIntoView({behavior:'smooth'});n.close();};
  }catch(e){/* Dashboard alert remains available when native notifications are unsupported. */}
 }
}
async function refreshHelpCalls(){
 if(!authorized||invitation)return;
 if(helpLoading){helpAgain=true;return;}helpLoading=true;
 try{
  const {data,error}=await BB.getClient().from('bb_help_calls').select('team_id,request_id,team_name,requested_at,resolved_at').is('resolved_at',null).order('requested_at');
  if(error)throw error;
  if(!authorized)return;
  data.forEach(notifyHelp);
  $('helpCount').textContent=String(data.length);
  document.title=data.length?'('+data.length+' Hilferufe) '+helpBaseTitle:helpBaseTitle;
  const signature=JSON.stringify(data);
  if(signature!==helpSignature){
   helpSignature=signature;$('helpCalls').replaceChildren();
   if(!data.length){const p=document.createElement('p');p.className='micro';p.textContent='Keine offenen Hilferufe.';$('helpCalls').append(p);}
   for(const call of data){
    const card=document.createElement('div');card.className='help-card';
    const copy=document.createElement('div'),title=document.createElement('strong'),when=document.createElement('p'),done=document.createElement('button');
    title.textContent='Team: '+call.team_name;
    when.className='micro';when.textContent='Ruft seit '+new Date(call.requested_at).toLocaleTimeString('de-DE');
    copy.append(title,when);done.textContent='Als erledigt markieren';
    done.onclick=async()=>{done.disabled=true;try{await BB.rpc('bb_help',{p_action:'resolve',p_request_id:call.request_id});helpSignature='';await refreshHelpCalls();}catch(e){$('helpAdminMessage').textContent=e.message;done.disabled=false;}};
    card.append(copy,done);$('helpCalls').append(card);
   }
  }
  $('helpAdminMessage').textContent='';
 }catch(e){$('helpAdminMessage').textContent='Hilferufe konnten nicht aktualisiert werden: '+e.message;}
 finally{helpLoading=false;if(helpAgain){helpAgain=false;refreshHelpCalls();}}
}
function startHelpMonitor(){
 if(helpChannel)return;
 updateNotificationButton();
 helpChannel=BB.getClient().channel('admin-help-calls')
  .on('postgres_changes',{event:'*',schema:'public',table:'bb_help_calls'},()=>refreshHelpCalls())
  .subscribe(status=>{
   $('helpConnection').textContent=status==='SUBSCRIBED'?'Live-Benachrichtigungen verbunden. Dashboard geöffnet lassen.':'Verbindung wird geprüft. Hilferufe werden zusätzlich regelmäßig abgerufen.';
   if(status==='SUBSCRIBED')refreshHelpCalls();
  });
 refreshHelpCalls();
}
setInterval(()=>{if(authorized&&!invitation)refreshHelpCalls();},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshHelpCalls();});
BB.getClient().auth.onAuthStateChange((event)=>{
 if(event==='SIGNED_OUT'){
  authorized=false;if(helpChannel)BB.getClient().removeChannel(helpChannel);helpChannel=null;
  $('dashboard').hidden=true;$('helpCalls').replaceChildren();$('helpToast').hidden=true;
  document.title=helpBaseTitle;seenHelpCalls.clear();
 }
});
