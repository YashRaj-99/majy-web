const STORE_KEY = "majy-academy-progress-v1";
const ACCOUNT_STORE_PREFIX = "majy-academy-progress-account-v1:";
let activeProgressKey = STORE_KEY;
const day=Number(location.pathname.match(/lesson\/([1-7])/)?.[1]);
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function formatMnemonic(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<strong><u>$1</u></strong>').replace(/\n/g,"<br>")}
function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(activeProgressKey) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(activeProgressKey, JSON.stringify(progress));
}

async function prepareProgressStorage() {
  try {
    const meResponse = await fetch("/api/academy/auth/me", {
      credentials: "same-origin"
    });

    const meData = await meResponse.json();

    if (!meResponse.ok || !meData.user) {
      activeProgressKey = STORE_KEY;
      return;
    }

    const accountKey =
      ACCOUNT_STORE_PREFIX + encodeURIComponent(meData.user.email.toLowerCase());

    activeProgressKey = accountKey;

    const response = await fetch("/api/academy/auth/progress", {
      credentials: "same-origin"
    });

    if (!response.ok) return;

    const data = await response.json();
    const localProgress = getProgress();

    for (const item of data.progress || []) {
      const dayNumber = item.day_number;
      const existing = localProgress[dayNumber];

      if (
        !existing?.completed ||
        Number(item.score) > Number(existing.score)
      ) {
        localProgress[dayNumber] = {
          completed: Boolean(item.completed),
          score: item.score,
          total: item.total,
          percentage: item.percentage,
          completedAt: item.completed_at
        };
      }
    }

    saveProgress(localProgress);

  } catch (error) {
    console.error("Academy progress sync:", error);
  }
}
let quizQuestions=[];

const diagramStyles = `
.visual-learning{margin:34px 0 28px}.visual-learning>h2{font-size:27px;font-weight:550;margin:7px 0 18px}
.diagram-card{margin:18px 0 22px;background:#fff;border:1px solid #dfe4dc;padding:22px 24px}
.diagram-card figcaption{display:flex;justify-content:space-between;gap:12px;margin-bottom:16px}
.diagram-card figcaption strong{font-size:16px;color:#20372b}.diagram-card figcaption span{font-size:9px;letter-spacing:1.5px;color:#819087}
.diagram-canvas{background:#f7f8f5;border:1px solid #e8ebe5;padding:18px;overflow:hidden}
.diagram-note{font-size:12px!important;color:#68756c!important;line-height:1.55;margin:13px 0 0!important}
.diagram-flow{display:flex;align-items:stretch;justify-content:center;gap:8px}
.diagram-node{flex:1;min-width:0;min-height:88px;padding:12px 9px;background:#fff;border:1px solid #cfd9d0;border-top:3px solid #315c49;display:flex;flex-direction:column;justify-content:center;gap:7px;text-align:center}
.diagram-node strong{font-size:12px;line-height:1.35;color:#294536}.diagram-step{font-size:9px;letter-spacing:1.3px;color:#829087}.diagram-arrow{align-self:center;color:#698174;font-size:21px}
.orderbook{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center}.book-side h3{font-size:13px;margin:0 0 8px;color:#315c49}
.book-side>div{display:flex;justify-content:space-between;gap:8px;padding:8px;margin:5px 0;background:#fff;border:1px solid #e1e7df;font-size:12px}
.book-side.bid b{color:#2f7652}.book-side.ask b{color:#a45c46}.book-side span{font-size:10px;color:#879087}
.spread-label{text-align:center;padding:9px;border:1px dashed #aebcaf;background:#fff}.spread-label small{display:block;font-size:9px;color:#77857a}.spread-label strong{font-size:16px;color:#294536}
.lesson-svg{width:100%;height:auto;max-height:300px;display:block}.lesson-svg text{font-family:Arial,sans-serif;font-size:14px;fill:#405247}.lesson-svg .small{font-size:11px;fill:#78857b}
.wick{stroke:#315c49;stroke-width:5;stroke-linecap:round}.candle-up{fill:#7ca88a;stroke:#315c49;stroke-width:2}.guide{stroke:#9aa99d;stroke-width:1.5;stroke-dasharray:4 4}
.trend-panels{display:grid;grid-template-columns:1fr 1fr;gap:14px}.trend-panels>div{background:#fff;border:1px solid #e4e9e2;padding:10px}.trend-panels h3{font-size:13px;margin:2px 8px;color:#315c49}
.price-line{fill:none;stroke:#397451;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.price-line.down{stroke:#a45c46}
.indicator-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.indicator-cell{padding:13px;background:#fff;border:1px solid #e0e7df}.indicator-cell strong,.indicator-cell span{display:block}.indicator-cell strong{font-size:12px;color:#294536}.indicator-cell span{font-size:12px;color:#68756c;margin-top:4px}
.axis{stroke:#9ba99e;stroke-width:1.5;fill:none}.range-box{fill:#e4eee5;stroke:#72917a;stroke-width:1.5;stroke-dasharray:5 4}.level{stroke:#72917a;stroke-width:1.5;stroke-dasharray:6 4}.stop-line{stroke:#b46b50;stroke-width:2;stroke-dasharray:5 4}
.calc-row{display:flex;align-items:center;justify-content:space-around;gap:10px}.calc-box{flex:1;padding:14px;background:#fff;border:1px solid #e0e7df;text-align:center}.calc-box small{display:block;font-size:9px;letter-spacing:1px;color:#77857a}.calc-box strong{display:block;margin-top:7px;font-size:14px;color:#294536}.calc-box.result{background:#e9f0e9;border-color:#cbd9cc}.calc-symbol{font-size:20px;color:#809084}
.timeline{display:grid;grid-template-columns:5fr 2fr 2fr;gap:7px}.timeline div{padding:18px 8px;text-align:center;background:#fff;border:1px solid #d9e2d9}.timeline .validate{background:#f1f0e6}.timeline .test{background:#e9f0e9}.timeline b,.timeline span{display:block}.timeline b{font-size:12px;color:#294536}.timeline span{font-size:11px;color:#69766d;margin-top:5px}
.risk-layers{display:grid;gap:8px;max-width:600px;margin:auto}.risk-layers div{padding:12px 15px;background:#fff;border:1px solid #dce4dc;display:flex;justify-content:space-between;gap:12px}.risk-layers b{font-size:12px;color:#294536}.risk-layers span{font-size:11px;color:#6d796f;text-align:right}.risk-layers .kill{background:#f7eae5;border-color:#dfb8a8}.risk-layers .kill b{color:#923f2b}
.architecture{max-width:620px;margin:auto;text-align:center}.arch-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.arch-row span{padding:14px 8px;background:#fff;border:1px solid #dce4dc;font-size:12px;font-weight:600;color:#294536}.arch-arrow{font-size:22px;color:#7d9181}.arch-gate{padding:16px;background:#e6efe6;border:2px solid #78947d}.arch-gate b,.arch-gate small{display:block}.arch-gate b{font-size:14px;color:#294536}.arch-gate small{font-size:11px;color:#647469;margin-top:4px}
.mnemonic-card p strong u{text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-color:#315c49}
@media(max-width:700px){.diagram-card{padding:16px 13px}.diagram-card figcaption{flex-direction:column;gap:4px}.diagram-flow{display:grid;grid-template-columns:1fr;gap:5px}.diagram-node{min-height:0;padding:10px 12px;flex-direction:row;justify-content:flex-start;text-align:left;align-items:center}.diagram-arrow{transform:rotate(90deg);justify-self:center;line-height:1}.book-side>div{padding:6px 4px;flex-direction:column;gap:1px}.spread-label{padding:6px 3px}.trend-panels{grid-template-columns:1fr}.indicator-grid{grid-template-columns:1fr}.calc-row{flex-direction:column}.calc-box{width:100%}.calc-symbol{line-height:1}.timeline{grid-template-columns:1fr}.risk-layers div{align-items:flex-start;flex-direction:column;gap:4px}.risk-layers span{text-align:left}}
`;
document.head.insertAdjacentHTML("beforeend",`<style>${diagramStyles}</style>`);

const diagrams={
1:[
["How an order reaches the market","The broker routes the order. The exchange matches compatible buy and sell orders; the exchange is not automatically the counterparty.",`<div class="diagram-flow">${["Investor places order","Broker validates and routes","Exchange order book","Bid and ask are matched","Trade confirmation and clearing"].map((x,i)=>`${i?'<span class="diagram-arrow">→</span>':''}<div class="diagram-node"><span class="diagram-step">STEP ${i+1}</span><strong>${x}</strong></div>`).join("")}</div>`],
["Reading a simple order book","Illustrative prices: spread = best ask ₹500.00 − best bid ₹499.90 = ₹0.10.",`<div class="orderbook"><div class="book-side bid"><h3>Bid · buyers</h3>${["₹499.90","₹499.80","₹499.70"].map(x=>`<div><b>${x}</b><span>Buy order</span></div>`).join("")}</div><div class="spread-label"><small>SPREAD</small><strong>₹0.10</strong></div><div class="book-side ask"><h3>Ask · sellers</h3>${["₹500.00","₹500.10","₹500.20"].map(x=>`<div><b>${x}</b><span>Sell offer</span></div>`).join("")}</div></div>`]
],
2:[
["Anatomy of a bullish candlestick","The body runs from open to close. Wicks extend to the high and low. A candle does not predict the next interval.",`<svg class="lesson-svg" viewBox="0 0 620 290" role="img" aria-label="Bullish candle anatomy"><line x1="300" y1="30" x2="300" y2="255" class="wick"/><rect x="260" y="100" width="80" height="105" rx="3" class="candle-up"/><path d="M340 43 H420 M340 100 H420 M340 205 H420 M340 255 H420 M260 150 H180 M300 75 H180 M300 230 H180" class="guide"/><text x="430" y="48">High</text><text x="430" y="105">Close</text><text x="430" y="210">Open</text><text x="430" y="260">Low</text><text x="25" y="150">Body</text><text x="25" y="75">Upper wick</text><text x="25" y="235">Lower wick</text><text x="300" y="285" text-anchor="middle" class="small">Bullish: Close is above Open</text></svg>`],
["Trend structure: sequence matters","An uptrend commonly forms higher highs and higher lows; a downtrend forms lower highs and lower lows. Structure depends on timeframe.",`<div class="trend-panels"><div><h3>Uptrend</h3><svg class="lesson-svg" viewBox="0 0 400 170" role="img" aria-label="Uptrend higher highs and higher lows"><path d="M20 145 L85 90 L135 118 L210 48 L260 82 L365 18" class="price-line"/><text x="77" y="75">HH</text><text x="127" y="143">HL</text><text x="200" y="32">HH</text><text x="255" y="105">HL</text></svg></div><div><h3>Downtrend</h3><svg class="lesson-svg" viewBox="0 0 400 170" role="img" aria-label="Downtrend lower highs and lower lows"><path d="M20 20 L85 80 L135 55 L210 120 L260 95 L365 155" class="price-line down"/><text x="77" y="100">LL</text><text x="127" y="40">LH</text><text x="200" y="140">LL</text><text x="255" y="78">LH</text></svg></div></div>`]
],
3:[
["Choose an indicator by the question","Different indicators measure different properties. Avoid stacking tools that mostly repeat the same information.",`<div class="indicator-grid">${[["Trend","Moving averages · ADX"],["Momentum","RSI · MACD"],["Session value","VWAP"],["Volatility / range","ATR"],["Participation","Volume"]].map(x=>`<div class="indicator-cell"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join("")}</div>`],
["A disciplined indicator workflow","Indicators are evidence to test alongside price, context, costs and risk—not independent guarantees.",`<div class="diagram-flow">${["Define the market question","Select a suitable measure","Check timeframe and context","Form a testable rule","Validate costs and risk"].map((x,i)=>`${i?'<span class="diagram-arrow">→</span>':''}<div class="diagram-node"><span class="diagram-step">${i+1}</span><strong>${x}</strong></div>`).join("")}</div>`]
],
4:[
["Opening Range Breakout (ORB): schematic","Define the opening range first. A possible trigger is a candle close above its high; filters and stop placement must be specified and tested.",`<svg class="lesson-svg" viewBox="0 0 640 280" role="img" aria-label="Opening range breakout schematic"><path d="M55 35 V235 M55 235 H600" class="axis"/><rect x="95" y="85" width="230" height="95" class="range-box"/><line x1="95" y1="85" x2="580" y2="85" class="level"/><line x1="95" y1="180" x2="580" y2="180" class="level"/><path d="M95 145 L145 120 L190 155 L235 108 L280 138 L330 75 L380 95 L430 50 L485 68 L550 22" class="price-line"/><line x1="330" y1="75" x2="330" y2="220" class="stop-line"/><text x="100" y="73">Range high</text><text x="100" y="200">Range low</text><text x="345" y="45">Close above range</text><text x="345" y="235">Illustrative stop area</text><text x="95" y="265" class="small">9:15</text><text x="300" y="265" class="small">9:30</text><text x="545" y="265" class="small">Later</text></svg>`],
["A strategy is a complete decision process","A testable strategy defines what to trade, entry, invalidation, exit, position size and when to stay out.",`<div class="diagram-flow">${["Universe and timeframe","Entry trigger","Stop and invalidation","Exit and position size","Filters and no-trade rules"].map((x,i)=>`${i?'<span class="diagram-arrow">→</span>':''}<div class="diagram-node"><span class="diagram-step">${i+1}</span><strong>${x}</strong></div>`).join("")}</div>`]
],
5:[
["Position sizing: convert risk into quantity","Illustration: ₹2,00,000 account × 0.25% = ₹500 risk budget. Entry ₹250, stop ₹245, risk/share ₹5; quantity = 100 shares before costs and slippage.",`<div class="calc-row"><div class="calc-box"><small>RISK BUDGET</small><strong>₹2,00,000 × 0.25% = ₹500</strong></div><span class="calc-symbol">÷</span><div class="calc-box"><small>RISK PER SHARE</small><strong>₹250 − ₹245 = ₹5</strong></div><span class="calc-symbol">=</span><div class="calc-box result"><small>QUANTITY</small><strong>₹500 ÷ ₹5 = 100</strong></div></div>`],
["Expectancy combines win rate and payoff","Illustration before costs: 50% × average win ₹600 − 50% × average loss ₹400 = +₹100 expected per trade. Estimates are uncertain.",`<div class="calc-row"><div class="calc-box"><small>WIN CONTRIBUTION</small><strong>50% × ₹600 = ₹300</strong></div><span class="calc-symbol">−</span><div class="calc-box"><small>LOSS CONTRIBUTION</small><strong>50% × ₹400 = ₹200</strong></div><span class="calc-symbol">=</span><div class="calc-box result"><small>EXPECTANCY</small><strong>+₹100 / trade</strong></div></div>`]
],
6:[
["The algorithmic trading pipeline","Risk checks sit between signal generation and order execution. Monitoring should record successful and failed events.",`<div class="diagram-flow">${["Market data","Features and signal","Pre-trade risk checks","Broker order interface","Execution monitoring and logs"].map((x,i)=>`${i?'<span class="diagram-arrow">→</span>':''}<div class="diagram-node"><span class="diagram-step">STAGE ${i+1}</span><strong>${x}</strong></div>`).join("")}</div>`],
["Chronological testing: keep the future unseen","Train and tune on earlier data; evaluate on later unseen data. Walk-forward testing repeats this process through time.",`<div class="timeline"><div><b>TRAIN</b><span>Earlier history</span></div><div class="validate"><b>VALIDATE</b><span>Later tuning check</span></div><div class="test"><b>TEST</b><span>Unseen period</span></div></div><p class="diagram-note">Time moves left → right. Avoid leaking future information into past decisions.</p>`]
],
7:[
["Risk controls around every trade","Hard limits should be enforced by the system. A kill switch stops new orders when critical conditions fail.",`<div class="risk-layers"><div><b>Trade-level limits</b><span>Risk budget · stop · quantity</span></div><div><b>Portfolio limits</b><span>Exposure · concentration · correlation</span></div><div><b>Daily / system limits</b><span>Daily loss · rejects · data failures</span></div><div class="kill"><b>KILL SWITCH</b><span>Stop new orders · reconcile · investigate</span></div></div>`],
["A safer system architecture","Research or AI can propose signals, but independent portfolio risk controls remain a gate before broker execution. Keep credentials server-side.",`<div class="architecture"><div class="arch-row"><span>Research + backtesting</span><span>AI / rules-based signal</span></div><div class="arch-arrow">↓</div><div class="arch-gate"><b>Independent portfolio risk gate</b><small>Limits · permissions · kill switch</small></div><div class="arch-arrow">↓</div><div class="arch-row"><span>Broker execution</span><span>Monitoring + audit logs</span></div><p class="diagram-note">Broker credentials belong in secure server-side storage—not browser JavaScript.</p></div>`]
]
};

function renderDiagrams(){
 return (diagrams[day]||[]).map(d=>`<figure class="diagram-card"><figcaption><strong>${esc(d[0])}</strong><span>LEARNING DIAGRAM</span></figcaption><div class="diagram-canvas">${d[2]}</div><p class="diagram-note">${esc(d[1])}</p></figure>`).join("");
}
function renderLesson(l){
 const c=l.content;
 document.title=`Day ${day}: ${l.title} | MAJY Academy`;
 document.getElementById("lesson-content").innerHTML=`
  <div class="lesson-hero"><div class="eyebrow">DAY ${String(day).padStart(2,"0")} · ${new Date(l.publish_date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div><h1>${esc(l.title)}</h1><p>${esc(l.subtitle)}</p></div>
  <section class="content-card"><div class="section-kicker">LEARNING OBJECTIVES</div><ul class="objective-list">${c.objectives.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>
  <section class="visual-learning"><div class="section-kicker">LEARN VISUALLY</div><h2>Diagrams that explain the concepts</h2>${renderDiagrams()}</section>
  ${c.sections.map((s,i)=>`<section class="content-card"><div class="section-kicker">CONCEPT ${String(i+1).padStart(2,"0")}</div><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></section>`).join("")}
  <section class="highlight-card"><div class="section-kicker">REMEMBER THIS ANALOGY</div><p>${esc(c.analogy)}</p></section>
  <section class="content-card mnemonic-card"><div class="section-kicker">MEMORY TRICK</div><p>${formatMnemonic(c.mnemonic)}</p></section>
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
 const formElement=e.currentTarget;
 const form=new FormData(formElement);
 const answers=quizQuestions.map(q=>({id:q.id,answer:Number(form.get(q.id))}));
 const button=formElement.querySelector("button");
 button.disabled=true;button.textContent="Checking…";
 try{
  const res=await fetch(`/api/academy/quiz/${day}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({answers})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not score quiz");
  const progress=getProgress();progress[day]={completed:true,score:data.score,total:data.total,percentage:data.percentage,completedAt:new Date().toISOString()};saveProgress(progress);
  document.getElementById("quiz-result").innerHTML=`<div class="result-card"><div class="section-kicker">YOUR SCORE</div><div class="score-big">${data.score}<small> / ${data.total}</small></div><h3>${data.percentage>=80?"Excellent work":data.percentage>=60?"Good effort":"Keep practising"}</h3><p>${data.percentage}% correct · Your result is saved in this browser.</p></div>
  ${data.results.map((r,i)=>`<div class="answer-review ${r.correct?"correct":"incorrect"}"><strong>${r.correct?"Correct":"Review"} · Q${i+1}</strong><p>${esc(r.explanation)}</p>${!r.correct?`<small>Correct answer: ${esc(quizQuestions[i].options[r.correctAnswer])}</small>`:""}</div>`).join("")}
  <a class="primary-button inline-button" href="/academy/">Return to course dashboard</a>`;
  formElement.querySelectorAll("input").forEach(x=>x.disabled=true);
 }catch(err){document.getElementById("quiz-result").innerHTML=`<p class="error">${esc(err.message)}</p>`;button.disabled=false;button.textContent="Try again"}
}
async function init(){
 if(!day){location.replace("/academy/");return}

 await prepareProgressStorage();

 try{
  const [lr,qr]=await Promise.all([fetch(`/api/academy/lesson/${day}`),fetch(`/api/academy/quiz/${day}`)]);
  const ld=await lr.json();if(!lr.ok)throw new Error(ld.error||"Lesson unavailable");
  const qd=await qr.json();if(!qr.ok)throw new Error(qd.error||"Quiz unavailable");
  renderLesson(ld.lesson);quizQuestions=qd.questions;renderQuiz();
 }catch(e){document.getElementById("lesson-content").innerHTML=`<div class="content-card"><h2>Lesson not available yet</h2><p>${esc(e.message)}</p><a class="back-link" href="/academy/">Return to course home</a></div>`}
}
init();
