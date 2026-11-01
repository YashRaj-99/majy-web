const COURSE_DAYS = [
  ["Stock Market Fundamentals","02 Nov 2026"],
  ["Candlesticks and Price Action","03 Nov 2026"],
  ["Technical Indicators","04 Nov 2026"],
  ["Trading Strategies","05 Nov 2026"],
  ["Quantitative Trading and Mathematics","06 Nov 2026"],
  ["Algo Trading and Backtesting","07 Nov 2026"],
  ["Risk Management, AI and System Design","08 Nov 2026"]
];
const STORE_KEY = "majy-academy-progress-v1";
function readProgress(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"{}")}catch{return {}}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dayUnlocked(day,today){return today >= `2026-11-${String(day+2).padStart(2,"0")}`;}
async function initAcademy(){
  const list=document.getElementById("lesson-list"); const progress=readProgress();
  try{
    const res=await fetch("/api/academy/lessons"); const data=await res.json();
    if(!res.ok) throw new Error(data.error||"Unable to load lessons");
    const published=new Set((data.lessons||[]).map(x=>x.day_number));
    const completed=Object.keys(progress).filter(k=>progress[k]?.completed).length;
    document.getElementById("progress-label").textContent=`${completed} / 7 complete`;
    document.getElementById("progress-bar").style.width=`${completed/7*100}%`;
    document.getElementById("progress-note").textContent="Progress is stored in this browser. Use the same browser and device to continue.";
    list.innerHTML=COURSE_DAYS.map(([title,date],i)=>{
      const day=i+1, score=progress[day]?.score;
      const isPublished=published.has(day);
      const locked=!isPublished;
      const state=progress[day]?.completed?`Completed · ${score}/3`:isPublished?"Available":"Unlocks at 8:00 AM IST";
      return `<article class="lesson-row ${locked?"locked":""}">
        <div class="day-number">${String(day).padStart(2,"0")}</div>
        <div class="lesson-info"><div class="lesson-date">${date} · DAY ${day}</div><h3>${esc(title)}</h3><p>${state}</p></div>
        ${isPublished?`<a class="row-action" href="/academy/lesson/${day}">${progress[day]?.completed?"Review lesson":"Start lesson"} <span>↗</span></a>`:`<span class="lock-label">LOCKED</span>`}
      </article>`;
    }).join("");
  }catch(e){list.innerHTML=`<p class="error">${esc(e.message)}. Please refresh or try again later.</p>`}
}
if(document.getElementById("lesson-list")) initAcademy();
