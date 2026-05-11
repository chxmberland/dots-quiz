import { initGlobe, highlightCapital, revealCountry, clearCountry, resetDots } from './globe';
import { seededShuffle, todayISO } from './seed';
import { isCorrect } from './match';
import { hasPlayedToday, getPlayRecord, saveResult, clearPlayRecord } from './cookie';
import type { Capital, GeoJSON } from './types';

const QUESTIONS = 3;
const TIMER_SECS = 300;

let capitals: Capital[] = [];
let geojson: GeoJSON;
let queue: Capital[] = [];
let questionIndex = 0;
let score = 0;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let secondsLeft = TIMER_SECS;
let answering = false;

async function bootstrap() {
  if (new URLSearchParams(location.search).has('reset')) {
    clearPlayRecord();
    history.replaceState(null, '', location.pathname);
  }

  const [capsRes, geoRes] = await Promise.all([
    fetch('/data/capitals.json'),
    fetch('/data/countries.geojson'),
  ]);
  capitals = await capsRes.json();
  geojson = await geoRes.json();

  if (hasPlayedToday()) {
    showDoneScreen();
    return;
  }

  showStartScreen();
}

function showStartScreen() {
  show('screen-start');
  const btn = document.getElementById('start-btn')!;
  btn.addEventListener('click', startGame, { once: true });
}

function showDoneScreen() {
  show('screen-done');
  const rec = getPlayRecord();
  const scoreEl = document.getElementById('done-score')!;
  if (rec) scoreEl.textContent = `Your score: ${rec.score} / ${QUESTIONS}`;
}

function startGame() {
  queue = seededShuffle(capitals, todayISO()).slice(0, QUESTIONS);
  questionIndex = 0;
  score = 0;

  show('screen-game');

  const container = document.getElementById('globe-container')!;
  initGlobe(container, capitals);

  setTimeout(() => nextQuestion(), 800);
}

function nextQuestion() {
  clearCountry();
  resetDots(capitals);

  if (questionIndex >= QUESTIONS) {
    endGame();
    return;
  }

  answering = true;
  secondsLeft = TIMER_SECS;
  const capital = queue[questionIndex];

  updateCounter();
  highlightCapital(capital, capitals);
  setFeedback('', false);

  const input = document.getElementById('answer-input') as HTMLInputElement;
  const btn = document.getElementById('submit-btn') as HTMLButtonElement;
  input.value = '';
  input.disabled = false;
  btn.disabled = false;
  input.focus();

  updateTimerBar(1);
  startTimer(capital);
}

function startTimer(capital: Capital) {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    secondsLeft--;
    updateTimerBar(secondsLeft / TIMER_SECS);

    if (secondsLeft <= 0) {
      clearInterval(timerInterval!);
      resolveQuestion(capital, false, true);
    }
  }, 1000);
}

function resolveQuestion(capital: Capital, correct: boolean, timeout = false) {
  if (!answering) return;
  answering = false;

  if (timerInterval) clearInterval(timerInterval);

  const input = document.getElementById('answer-input') as HTMLInputElement;
  const btn = document.getElementById('submit-btn') as HTMLButtonElement;
  input.disabled = true;
  btn.disabled = true;

  if (correct) score++;

  const msg = correct
    ? `Correct! ${capital.city}`
    : timeout
      ? `Time's up! It was ${capital.city}`
      : `Wrong! It was ${capital.city}`;

  setFeedback(msg, correct);
  revealCountry(capital.country, correct, geojson);

  questionIndex++;
  setTimeout(() => nextQuestion(), correct ? 2200 : 3000);
}

function endGame() {
  saveResult(score);
  show('screen-end');

  document.getElementById('end-score')!.textContent = `${score} / ${QUESTIONS}`;

  const emoji = queue
    .map((_, i) => (i < score ? '🟢' : '🔴'))
    .join('');

  const shareText = `Capital Quiz ${todayISO()}\n${emoji} ${score}/${QUESTIONS}`;
  document.getElementById('share-text')!.textContent = emoji;

  document.getElementById('share-btn')!.addEventListener('click', () => {
    navigator.clipboard.writeText(shareText).then(() => {
      const btn = document.getElementById('share-btn')!;
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Share result'), 2000);
    });
  });
}

function updateCounter() {
  document.getElementById('question-counter')!.textContent =
    `Question ${questionIndex + 1} of ${QUESTIONS}`;
}

function updateTimerBar(fraction: number) {
  const bar = document.getElementById('timer-bar')!;
  bar.style.width = `${Math.max(0, fraction * 100)}%`;
  bar.classList.toggle('urgent', fraction <= 0.33);
}

function setFeedback(msg: string, correct: boolean) {
  const el = document.getElementById('feedback-overlay')!;
  el.textContent = msg;
  el.className = msg
    ? `visible ${correct ? 'correct' : 'wrong'}`
    : '';
}

function show(id: string) {
  document.querySelectorAll<HTMLElement>('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)!.classList.add('active');
}

// Wire up submit
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('answer-input') as HTMLInputElement;
  const btn = document.getElementById('submit-btn') as HTMLButtonElement;

  const submit = () => {
    if (!answering) return;
    const capital = queue[questionIndex];
    const correct = isCorrect(input.value, capital.city);
    resolveQuestion(capital, correct);
  };

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });

  bootstrap();
});
