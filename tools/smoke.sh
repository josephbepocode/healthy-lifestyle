#!/usr/bin/env bash
# Smoke test against `npm run preview` (port 4173). Seeds an old data snapshot plus a blocked food,
# then checks Home, Log food filtering, water, weigh-in, notifications via service worker, and the .ics.
set -e
cd "$(dirname "$0")"
FX=$(cat "${FIXTURE:-/workspace/healthy/tools/old-fixture.json}")  # local test data, not committed
INIT="if(!sessionStorage.seeded){const fx=$FX; for (const k in fx) localStorage.setItem(k, fx[k]); const s=JSON.parse(localStorage['healthy-lifestyle.v1']); s.foods.push({id:'x-tuna',name:'Tuna sandwich',serving:'1',kcal:400,protein:30,carbs:30,fat:10},{id:'x-tilapia',name:'Fried tilapia',serving:'1',kcal:400,protein:30,carbs:0,fat:10},{id:'x-sard',name:'Canned sardines on toast',serving:'1',kcal:350,protein:25,carbs:30,fat:12}); localStorage['healthy-lifestyle.v1']=JSON.stringify(s); sessionStorage.seeded=1}" \
GRANT=1 WAIT=3500 WAIT3=4000 EXPR2="const reg=await navigator.serviceWorker.ready; return {afterReloadHome: !!document.querySelector('.home'), notesNow:(await reg.getNotifications()).map(n=>n.title), notifyStill: JSON.parse(localStorage['healthy-reminders.v1']).notify}" node --experimental-websocket shot.mjs "http://127.0.0.1:4173/healthy-lifestyle/" "${1:--}" 390 844 "
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const btn=(t,root=document)=>[...root.querySelectorAll('button')].find(b=>b.textContent.includes(t));
const out={};
out.home=!!document.querySelector('.home'); out.dock=[...document.querySelectorAll('.simple-dock .nl')].map(x=>x.textContent);
const before=JSON.parse(localStorage['healthy-lifestyle.v1']);
out.oldDataKept=before.foods.some(f=>f.id==='my-food-1') && before.weighIns.length>0;
btn('Log food').click(); await sleep(400);
const names=[...document.querySelectorAll('.food-row b')].map(b=>b.textContent);
out.foodCount=names.length; out.blockedShown=names.filter(n=>/tuna|tilapia|fish|egusi|fufu|eba|amala|pounded|semo/i.test(n)); out.sardinesAllowed=JSON.parse(localStorage['healthy-lifestyle.v1']).foods.some(f=>f.id==='x-sard');
const n0=JSON.parse(localStorage['healthy-lifestyle.v1']).mealLog.length; document.querySelector('.food-row').click(); await sleep(200);
out.mealAdded=JSON.parse(localStorage['healthy-lifestyle.v1']).mealLog.length===n0+1;
document.querySelector('.sheet-head .icon-btn').click(); await sleep(300);
btn('Add a glass').click(); await sleep(200);
out.water=JSON.parse(localStorage['healthy-habits.v1']||'{}').water;
btn('Weigh in').click(); await sleep(300);
const inp=document.querySelector('.field.big input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inp,'71.4'); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(100);
btn('Save',document.querySelector('.sheet')).click(); await sleep(300);
out.weigh=JSON.parse(localStorage['healthy-lifestyle.v1']).weighIns.slice(-1)[0];
out.perm=Notification.permission;
const reg=await navigator.serviceWorker.ready; out.sw=!!reg.active;
btn('Turn on notifications').click(); await sleep(1500);
out.notifyOn=JSON.parse(localStorage['healthy-reminders.v1']).notify;
out.shown=(await reg.getNotifications()).map(n=>n.title);
out.notified=Object.keys(JSON.parse(localStorage['healthy-reminders.v1']).notified);
setTimeout(()=>location.reload(),50);
return out" 2>&1 | grep -v "GL Driver\|GPU"
