(() => {
  'use strict';
  const TOTAL = 100, ROUND_MS = 7 * 60 * 1000, STORAGE_KEY = 'starterAbacusSprint.v1';
  const $ = id => document.getElementById(id);
  const screens = ['home-screen', 'play-screen', 'results-screen', 'review-screen'];
  let questions = [], current = 0, submitted = 0, correct = 0, responses = [];
  let running = false, accepting = false, startTime = 0, timerId = 0, lastResult = null;

  const randomInt = (min, max, rng = Math.random) => Math.floor(rng() * (max - min + 1)) + min;
  const shuffle = (items, rng = Math.random) => {
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  };
  const hasCancellation = ops => ops.some((v, i) => ops.slice(i + 1).includes(-v));
  function validateQuestion(q) {
    if (!q || !Array.isArray(q.operands) || q.operands.length !== 4) return false;
    if (!q.operands.every(Number.isInteger) || !q.operands.every(v => v !== 0 && Math.abs(v) <= 9) || q.operands[0] < 1) return false;
    let sum = 0;
    for (const value of q.operands) { sum += value; if (sum < 0) return false; }
    return q.answer === sum && sum >= 0;
  }
  function makeCandidate(targetNegatives, requireCancellation, rng) {
    for (let tries = 0; tries < 300; tries++) {
      const first = randomInt(1, 9, rng), ops = [first];
      if (requireCancellation) {
        const cancel = randomInt(1, first, rng);
        ops.push(-cancel, cancel);
        const total = ops.reduce((a, b) => a + b, 0);
        const canNeg = total > 0 && targetNegatives >= 2;
        ops.push(canNeg ? -randomInt(1, Math.min(9, total), rng) : randomInt(1, 9, rng));
        shuffle(ops.slice(1), rng); // intentional no-op avoided below by explicit reorder
        const tail = shuffle(ops.splice(1), rng); ops.push(...tail);
      } else {
        for (let pos = 1; pos < 4; pos++) {
          const total = ops.reduce((a, b) => a + b, 0), negs = ops.filter(v => v < 0).length;
          const remaining = 4 - pos;
          const mustNeg = targetNegatives - negs >= remaining;
          const useNeg = total > 0 && (mustNeg || (negs < targetNegatives && rng() < .55));
          ops.push(useNeg ? -randomInt(1, Math.min(9, total), rng) : randomInt(1, 9, rng));
        }
      }
      const q = { operands: ops, answer: ops.reduce((a, b) => a + b, 0) };
      if (validateQuestion(q) && (!requireCancellation || hasCancellation(ops))) return q;
    }
    throw new Error('Unable to create a valid question');
  }
  function generatePracticeSet(rng = Math.random) {
    const set = [], seen = new Set();
    for (let i = 0; i < TOTAL; i++) {
      const requireCancellation = i < 24;
      const targetNegatives = i % 10 < 3 ? 1 : i % 10 < 8 ? 2 : 3;
      let q, key, attempts = 0;
      do { q = makeCandidate(targetNegatives, requireCancellation, rng); key = q.operands.join(','); attempts++; } while (seen.has(key) && attempts < 1000);
      if (seen.has(key)) throw new Error('Unable to avoid duplicate question');
      seen.add(key); set.push(q);
    }
    return shuffle(set, rng);
  }
  function validateSet(set) {
    if (!Array.isArray(set) || set.length !== TOTAL) return { valid: false, reason: 'Set length' };
    const keys = new Set(); let cancellations = 0;
    for (const q of set) {
      if (!validateQuestion(q)) return { valid: false, reason: 'Invalid question' };
      const key = q.operands.join(','); if (keys.has(key)) return { valid: false, reason: 'Duplicate' }; keys.add(key);
      if (hasCancellation(q.operands)) cancellations++;
    }
    return { valid: cancellations >= 20, reason: cancellations >= 20 ? '' : 'Too few cancellations', cancellations };
  }
  function showScreen(id) { screens.forEach(s => $(s).hidden = s !== id); window.scrollTo(0, 0); }
  function formatOperand(v) { return v > 0 ? String(v) : `−${Math.abs(v)}`; }
  function renderQuestion() {
    if (!running || current >= TOTAL) return;
    const q = questions[current];
    $('operands').replaceChildren(...q.operands.map((v, i) => { const span = document.createElement('span'); span.textContent = formatOperand(v, i); return span; }));
    $('operands').setAttribute('aria-label', q.operands.map((v, i) => i === 0 ? String(v) : v > 0 ? `plus ${v}` : `minus ${Math.abs(v)}`).join(', '));
    $('question-count').textContent = `${current + 1} of ${TOTAL}`;
    $('answer-input').value = ''; $('answer-input').disabled = false; accepting = true;
    requestAnimationFrame(() => $('answer-input').focus({ preventScroll: true }));
  }
  function updateStats() {
    $('submitted-count').textContent = submitted; $('correct-count').textContent = correct;
    $('progress-fill').style.width = `${submitted}%`;
    document.querySelector('.progress-track').setAttribute('aria-valuenow', submitted);
  }
  function submitAnswer(raw) {
    if (!running || !accepting || current >= TOTAL || !/^\d+$/.test(raw)) return false;
    accepting = false;
    const answer = Number(raw), q = questions[current], isCorrect = answer === q.answer;
    responses.push({ index: current, operands: [...q.operands], answer, correctAnswer: q.answer, correct: isCorrect });
    submitted++; if (isCorrect) correct++; current++; updateStats();
    if (current >= TOTAL) finishRound('completed'); else renderQuestion();
    return true;
  }
  function tick(now = performance.now()) {
    if (!running) return;
    const elapsed = Math.max(0, now - startTime), remaining = Math.max(0, ROUND_MS - elapsed);
    const totalSeconds = Math.ceil(remaining / 1000), mins = Math.floor(totalSeconds / 60), secs = totalSeconds % 60;
    $('timer').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    $('timer-wrap').classList.toggle('notice', remaining <= 60000); $('timer-wrap').classList.toggle('urgent', remaining <= 10000);
    if (remaining <= 0) finishRound('time'); else timerId = requestAnimationFrame(tick);
  }
  function startRound(prebuilt) {
    cancelAnimationFrame(timerId); questions = prebuilt || generatePracticeSet();
    const validation = validateSet(questions); if (!validation.valid) throw new Error(`Question set failed validation: ${validation.reason}`);
    current = submitted = correct = 0; responses = []; running = true; accepting = false;
    showScreen('play-screen'); updateStats(); $('timer').textContent = '07:00'; renderQuestion();
    startTime = performance.now(); timerId = requestAnimationFrame(tick);
  }
  function loadProgress() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { bestCorrect: 0, bestAccuracy: 0, mostSubmitted: 0, recent: [] }; } catch { return { bestCorrect: 0, bestAccuracy: 0, mostSubmitted: 0, recent: [] }; } }
  function saveResult(result) {
    const data = loadProgress(); data.bestCorrect = Math.max(data.bestCorrect || 0, result.correct); data.mostSubmitted = Math.max(data.mostSubmitted || 0, result.submitted);
    if (result.submitted >= 10) data.bestAccuracy = Math.max(data.bestAccuracy || 0, result.accuracy);
    data.recent = [result, ...(data.recent || [])].slice(0, 10); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return data;
  }
  function finishRound(reason, now = performance.now()) {
    if (!running) return false;
    running = false; accepting = false; cancelAnimationFrame(timerId); $('answer-input').disabled = true;
    const timeUsedMs = Math.min(ROUND_MS, Math.max(0, now - startTime));
    const result = { date: new Date().toISOString(), reason, submitted, correct, incorrect: submitted - correct, unanswered: TOTAL - submitted, accuracy: submitted ? Math.round(correct / submitted * 1000) / 10 : 0, timeUsedMs, averageSeconds: submitted ? timeUsedMs / 1000 / submitted : 0, responses: responses.map(r => ({ ...r })) };
    lastResult = result; const progress = saveResult(result); renderResults(result, progress); showScreen('results-screen'); return true;
  }
  function formatDuration(ms) { const sec = Math.round(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
  function renderResults(r, progress) {
    $('results-title').textContent = r.correct >= 80 ? 'Amazing focus!' : r.correct >= 50 ? 'Strong sprint!' : r.submitted ? 'Great practice!' : 'Ready for another try?';
    $('combined-result').textContent = `${r.correct} correct out of ${r.submitted} attempted`;
    $('encouragement').textContent = r.accuracy >= 90 ? 'Wonderful accuracy—your careful practice shows!' : r.accuracy >= 70 ? 'Nice work—keep building speed while staying careful.' : r.submitted ? 'Every round helps your number skills grow.' : 'Take a breath, then start when you feel ready.';
    const stats = [['Questions submitted',r.submitted],['Correct answers',r.correct],['Incorrect answers',r.incorrect],['Unanswered',r.unanswered],['Accuracy',`${r.accuracy}%`],['Time used',formatDuration(r.timeUsedMs)],['Average speed',r.submitted?`${r.averageSeconds.toFixed(1)} sec`:'—'],['Round ended',r.reason==='time'?'Time finished':'100 completed']];
    $('result-grid').replaceChildren(...stats.map(([label,value])=>{const d=document.createElement('div');d.className='result-tile';d.innerHTML=`<strong>${value}</strong><span>${label}</span>`;return d;}));
    $('best-score').textContent = `${progress.bestCorrect} correct`;
    $('review-button').disabled = r.incorrect === 0;
  }
  function renderReview() {
    if (!lastResult) return;
    const mistakes = lastResult.responses.filter(r => !r.correct); $('review-summary').textContent = mistakes.length ? `${mistakes.length} answered question${mistakes.length===1?'':'s'} to revisit. ${lastResult.unanswered} unanswered question${lastResult.unanswered===1?'':'s'} not shown.` : 'No answered mistakes in this round.';
    $('review-list').replaceChildren(...mistakes.map(r=>{const card=document.createElement('article');card.className='mistake-card';const expr=r.operands.map((v,i)=>formatOperand(v,i)).join('  ');card.innerHTML=`<h3>Question ${r.index+1}</h3><div class="mistake-expression">${expr}</div><p>Your answer: <span class="wrong">${r.answer}</span></p><p>Correct answer: <span class="right">${r.correctAnswer}</span></p>`;return card;})); showScreen('review-screen');
  }
  function renderSaved() { const p=loadProgress(), has=(p.recent||[]).length>0; $('saved-summary').hidden=!has; $('clear-results').hidden=!has; if(has)$('saved-summary').innerHTML=`<span>Best score: <strong>${p.bestCorrect}</strong></span><span>Best accuracy (10+ attempts): <strong>${p.bestAccuracy}%</strong></span><span>Most submitted: <strong>${p.mostSubmitted}</strong></span><span>Rounds saved: <strong>${p.recent.length}</strong></span>`; }
  $('answer-input').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  $('answer-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitAnswer(e.currentTarget.value); } });
  $('answer-form').addEventListener('submit', e => { e.preventDefault(); submitAnswer($('answer-input').value); });
  $('start-button').addEventListener('click', () => { const name=$('child-name').value.trim(); if(name)localStorage.setItem(`${STORAGE_KEY}.name`,name); else localStorage.removeItem(`${STORAGE_KEY}.name`); startRound(); });
  $('again-button').addEventListener('click',()=>startRound()); $('home-button').addEventListener('click',()=>{showScreen('home-screen');renderSaved();}); $('review-button').addEventListener('click',renderReview); $('review-back').addEventListener('click',()=>showScreen('results-screen'));
  $('clear-results').addEventListener('click',()=>$('clear-dialog').showModal()); $('confirm-clear').addEventListener('click',()=>{localStorage.removeItem(STORAGE_KEY);setTimeout(renderSaved);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&running)tick(performance.now());});
  $('child-name').value=localStorage.getItem(`${STORAGE_KEY}.name`)||''; renderSaved();
  window.AbacusSprintTest = { generatePracticeSet, validateQuestion, validateSet, hasCancellation, startRound, submitAnswer, finishRound, getState:()=>({questions,current,submitted,correct,responses,running,accepting,startTime}), constants:{TOTAL,ROUND_MS,STORAGE_KEY} };
})();
