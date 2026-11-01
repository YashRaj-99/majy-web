const STORE_KEY="majy-academy-progress-v1";
const day=Number(location.pathname.match(/lesson\/([1-7])/)?.[1]);
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function getProgress(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"{}")}catch{return {}}}
function saveProgress(v){localStorage.setItem(STORE_KEY,JSON.stringify(v))}
let quizQuestions=[];
function renderLesson(l){
 const c=l.content;
 document.title=`Day ${day}: ${l.title} | MAJY Academy`;
 document.getElementById("lesson-content").innerHTML=`
  <div class="lesson-hero"><div class="eyebrow">DAY ${String(day).padStart(2,"0")} · ${new Date(l.publish_date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div><h1>${esc(l.title)}</h1><p>${esc(l.subtitle)}</p></div>
  <section class="content-card"><div class="section-kicker">LEARNING OBJECTIVES</div><ul class="objective-list">${c.objectives.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>
  ${c.sections.map((s,i)=>`<section class="content-card"><div class="section-kicker">CONCEPT ${String(i+1).padStart(2,"0")}</div><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></section>`).join("")}
  <section class="highlight-card"><div class="section-kicker">REMEMBER THIS ANALOGY</div><p>${esc(c.analogy)}</p></section>
  <section class="content-card"><div class="section-kicker">MEMORY TRICK</div><p>${c.mnemonic}</p></section>
  <section class="content-card"><div class="section-kicker">INDIAN MARKET EXAMPLE</div><p>${esc(c.example)}</p></section>
  <section class="content-card"><div class="section-kicker">QUICK REVISION</div><ul class="objective-list">${c.takeaways.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>
  <div class="quiz-intro"><div class="section-kicker">CHECK YOUR UNDERSTANDING</div><h2>Quick knowledge check</h2><p>Answer all three questions. You’ll see your score and an explanation for every answer.</p></div>`;
}
function renderQuiz(){
 const area=document.getElementById("quiz-area"); area.hidden=false;
 area.innerHTML=`<form id="quiz-form">${quizQuestions.map((q,i)=>`<fieldset class="question"><legend><span>QUESTION ${i+1}</span>${esc(q.question)}</legend><div class="answers">${q.options.map((o,j)=>`<label class="answer"><input type="radio" name="${q.id}" value="${j}" required><span>${esc(o)}</span></label>`).join("")}</div></fieldset>`).join("")}<button class="primary-button" type="submit">Submit answers</button></form><div id="quiz-result"></div>`;
 document.getElementById("quiz-form").addEventListener("submit",submitQuiz);
}
async function submitQuiz(e){
 e.preventDefault();
 const formElement = e.currentTarget;
 const form = new FormData(formElement);
 e.preventDefault(); const form=new FormData(e.currentTarget);
 const answers=quizQuestions.map(q=>({id:q.id,answer:Number(form.get(q.id))}));
 const button=formElement.querySelector("button"); button.disabled=true; button.textContent="Checking…";
 try{
  const res=await fetch(`/api/academy/quiz/${day}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({answers})});
  const data=await res.json(); if(!res.ok) throw new Error(data.error||"Could not score quiz");
  const progress=getProgress(); progress[day]={completed:true,score:data.score,total:data.total,percentage:data.percentage,completedAt:new Date().toISOString()}; saveProgress(progress);
  document.getElementById("quiz-result").innerHTML=`<div class="result-card"><div class="section-kicker">YOUR SCORE</div><div class="score-big">${data.score}<small> / ${data.total}</small></div><h3>${data.percentage>=80?"Excellent work":data.percentage>=60?"Good effort":"Keep practising"}</h3><p>${data.percentage}% correct · Your result is saved in this browser.</p></div>
  ${data.results.map((r,i)=>`<div class="answer-review ${r.correct?"correct":"incorrect"}"><strong>${r.correct?"Correct":"Review"} · Q${i+1}</strong><p>${esc(r.explanation)}</p>${!r.correct?`<small>Correct answer: ${esc(quizQuestions[i].options[r.correctAnswer])}</small>`:""}</div>`).join("")}
  <a class="primary-button inline-button" href="/academy/">Return to course dashboard</a>`;
  formElement.querySelectorAll("input").forEach(x=>x.disabled=true);
 }catch(err){document.getElementById("quiz-result").innerHTML=`<p class="error">${esc(err.message)}</p>`;button.disabled=false;button.textContent="Try again"}
}
async function init(){
 if(!day){location.replace("/academy/");return}
 try{
  const [lr,qr]=await Promise.all([fetch(`/api/academy/lesson/${day}`),fetch(`/api/academy/quiz/${day}`)]);
  const ld=await lr.json(); if(!lr.ok) throw new Error(ld.error||"Lesson unavailable");
  const qd=await qr.json(); if(!qr.ok) throw new Error(qd.error||"Quiz unavailable");
  renderLesson(ld.lesson); quizQuestions=qd.questions; renderQuiz();
 }catch(e){document.getElementById("lesson-content").innerHTML=`<div class="content-card"><h2>Lesson not available yet</h2><p>${esc(e.message)}</p><a class="back-link" href="/academy/">Return to course home</a></div>`}
}
init();
