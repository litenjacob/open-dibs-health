// Independent, data-free notifications. Never log relay responses or tokens.
import { pathToFileURL } from 'node:url';
export async function runMonitor({fetchImpl=fetch,env=process.env,log=console.log}={}) {
const origin = 'https://open-dibs.litenjacob.workers.dev';
const repo = env.GITHUB_REPOSITORY;
const token = env.GITHUB_TOKEN;
const relay = env.NOTIFIER_TOKEN;
if (!repo || !token) throw new Error('Monitor configuration missing');
async function api(path, method = 'GET', body) {
  const response = await fetchImpl(`https://api.github.com/repos/${repo}/${path}`, {method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15_000)});
  if (!response.ok) throw new Error(`Notification API rejected (${response.status})`);
  return response.status === 204 ? null : response.json();
}
async function notify(title, open, body, events=[]) {
  const markers=events.map(id=>`<!-- open-dibs-notice:${id} -->`);
  const content=body+'\n\n'+markers.join('\n');
  const all = await api('issues?state=all&per_page=50');
  const issue = all.find(i => i.title === title && !i.pull_request);
  if (!open) {if(issue?.state==='open')await api(`issues/${issue.number}`,'PATCH',{state:'closed'});return;}
  if (!issue) await api('issues','POST',{title,body:content,assignees:['litenjacob']});
  else if (issue.state !== 'open') await api(`issues/${issue.number}`,'PATCH',{state:'open',body:content});
  else if(markers.length){
    const lastPage=Math.max(1,Math.ceil((issue.comments??100)/100));
    const comments=[];
    for(const page of new Set([lastPage,Math.max(1,lastPage-1)]))comments.push(...await api(`issues/${issue.number}/comments?per_page=100&page=${page}`));
    const known=[issue.body??'',...comments.map(c=>c.body??'')].join('\n');
    const missing=markers.filter(marker=>!known.includes(marker));
    if(missing.length)await api(`issues/${issue.number}/comments`,'POST',{body:body+'\n\n'+missing.join('\n')});
  }
}
let healthy=false;
try { const response=await fetchImpl(`${origin}/care-healthz`,{signal:AbortSignal.timeout(10_000)}); healthy=response.ok&&(await response.json()).status==='ok'; } catch { /* Independent Cloudflare-outage detection. */ }
if(env.SIMULATE_HEALTH_FAILURE==='true')healthy=false;
await notify('Open Dibs scheduler needs attention',!healthy,'The independent monitor could not confirm scheduler health. Open the private application and the recovery runbook. No household details are collected here.');
if (relay) {
 const post=async body=>{const response=await fetchImpl(`${origin}/notifier`,{method:'POST',headers:{Authorization:`Bearer ${relay}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error('Notification relay unavailable');return response.json();};
 const pending=await post({action:'claim'});
 const tests=pending.batch.filter(x=>x.test), notices=pending.batch.filter(x=>!x.test);
 const events=items=>items.map(x=>x.eventId).filter(id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id));
 if(tests.length)await notify('Open Dibs notification test',true,'This is the requested notification-channel test. Receiving this GitHub notification confirms only the observed channel; email arrival is checked separately.',events(tests));
 if(notices.length)await notify('Open Dibs queue care needs attention',true,'A queue-care event needs follow-up. Open the private application for the affected person, evidence, deadline and next action. No provider or household details are sent to GitHub.',events(notices));
 else if(!pending.attention)await notify('Open Dibs queue care needs attention',false,'');
 if(pending.batch.length)await post({action:'ack',tokens:pending.batch.map(x=>x.token)});
}
log('Independent health check and notification reconciliation completed.');
return healthy;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(!await runMonitor())process.exitCode=1;}
