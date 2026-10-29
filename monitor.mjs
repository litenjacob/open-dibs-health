// Independent, data-free notifications. Never log relay responses or tokens.
const origin = 'https://open-dibs.litenjacob.workers.dev';
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const relay = process.env.NOTIFIER_TOKEN;
if (!repo || !token) throw new Error('Monitor configuration missing');
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15_000)});
  if (!response.ok) throw new Error(`Notification API rejected (${response.status})`);
  return response.status === 204 ? null : response.json();
}
async function notify(title, open, body) {
  const all = await api('issues?state=all&per_page=50');
  const issue = all.find(i => i.title === title && !i.pull_request);
  if (!open) {if(issue?.state==='open')await api(`issues/${issue.number}`,'PATCH',{state:'closed'});return;}
  if (!issue) await api('issues','POST',{title,body,assignees:['litenjacob']});
  else if (issue.state !== 'open') await api(`issues/${issue.number}`,'PATCH',{state:'open',body});
}
let healthy=false;
try { const response=await fetch(`${origin}/care-healthz`,{signal:AbortSignal.timeout(10_000)}); healthy=response.ok&&(await response.json()).status==='ok'; } catch { /* Independent Cloudflare-outage detection. */ }
if(process.env.SIMULATE_HEALTH_FAILURE==='true')healthy=false;
await notify('Open Dibs scheduler needs attention',!healthy,'The independent monitor could not confirm scheduler health. Open the private application and the recovery runbook. No household details are collected here.');
if (relay) {
 const post=async body=>{const response=await fetch(`${origin}/notifier`,{method:'POST',headers:{Authorization:`Bearer ${relay}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error('Notification relay unavailable');return response.json();};
 const pending=await post({action:'claim'});
 const tests=pending.batch.filter(x=>x.test), notices=pending.batch.filter(x=>!x.test);
 if(tests.length)await notify('Open Dibs notification test',true,'This is the requested notification-channel test. Receiving this GitHub notification confirms only the observed channel; email arrival is checked separately.');
 await notify('Open Dibs queue care needs attention',pending.attention||notices.length>0,'A queue-care event needs follow-up. Open the private application for the affected person, evidence, deadline and next action. No provider or household details are sent to GitHub.');
 if(pending.batch.length)await post({action:'ack',tokens:pending.batch.map(x=>x.token)});
}
console.log('Independent health check and notification reconciliation completed.');
if(!healthy)process.exitCode=1;
