import { initGlobe, highlightCapital, revealCountry, clearCountry, resetDots, nearestCapitals } from './globe';
import { seededShuffle, randomShuffle, todayISO } from './seed';
import { isCorrect } from './match';
import { hasPlayedToday, getPlayRecord, saveResult, clearPlayRecord } from './cookie';
import type { Capital, GeoJSON, Mode, PersistedMode } from './types';

const QUESTIONS = 5;
const TIMER_SECS = 60;
const HARD_VISIBLE_DOTS = 6; // Five not including target city

let capitals: Capital[] = [];
let geojson: GeoJSON;
let queue: Capital[] = [];
let questionIndex = 0;
let score = 0;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let nextQuestionTimer: ReturnType<typeof setTimeout> | null = null;
let secondsLeft = TIMER_SECS;
let answering = false;
let mode: Mode = 'daily';

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

  showModeSelectScreen();
}

function showModeSelectScreen() {
  show('screen-mode-select');
}

function selectMode(selected: Mode) {
  mode = selected;
  if (mode !== 'endless' && hasPlayedToday(mode)) {
    showDoneScreen(mode);
    return;
  }
  startGame();
}

function showDoneScreen(persisted: PersistedMode) {
  show('screen-done');
  const rec = getPlayRecord(persisted);
  const scoreEl = document.getElementById('done-score')!;
  if (rec) scoreEl.textContent = `Your score: ${rec.score} / ${QUESTIONS}`;
}

function visibleSetFor(capital: Capital): Capital[] {
  return mode === 'hard'
    ? nearestCapitals(capital, capitals, HARD_VISIBLE_DOTS)
    : capitals;
}

function startGame() {
  if (mode === 'endless') {
    queue = randomShuffle(capitals);
  } else {
    const seed = mode === 'hard' ? `${todayISO()}:hard` : todayISO();
    queue = seededShuffle(capitals, seed).slice(0, QUESTIONS);
  }
  questionIndex = 0;
  score = 0;

  const gameScreen = document.getElementById('screen-game')!;
  gameScreen.classList.toggle('mode-endless', mode === 'endless');

  show('screen-game');

  const container = document.getElementById('globe-container')!;
  initGlobe(container, mode === 'hard' ? [] : capitals);

  scheduleNextQuestion(800);
}

function scheduleNextQuestion(delay: number) {
  if (nextQuestionTimer) clearTimeout(nextQuestionTimer);
  nextQuestionTimer = setTimeout(() => {
    nextQuestionTimer = null;
    nextQuestion();
  }, delay);
}

function nextQuestion() {
  clearCountry();

  if (mode !== 'endless' && questionIndex >= QUESTIONS) {
    endGame();
    return;
  }

  if (mode === 'endless' && questionIndex >= queue.length) {
    queue = randomShuffle(capitals);
    questionIndex = 0;
  }

  answering = true;
  secondsLeft = TIMER_SECS;
  const capital = queue[questionIndex];
  const visible = visibleSetFor(capital);

  resetDots(visible);
  updateCounter();
  highlightCapital(capital, visible);
  setFeedback('', false);

  const input = document.getElementById('answer-input') as HTMLInputElement;
  const btn = document.getElementById('submit-btn') as HTMLButtonElement;
  input.value = '';
  input.disabled = false;
  btn.disabled = false;
  input.focus();

  if (mode === 'endless') {
    updateTimerBar(1);
  } else {
    updateTimerBar(1);
    startTimer(capital);
  }
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

  if (correct && mode !== 'endless') score++;

  const answer = `${capital.city}, ${capital.country}`;
  const msg = correct
    ? `Correct! ${answer}`
    : timeout
      ? `Time's up! It was ${answer}`
      : `Wrong! It was ${answer}`;

  setFeedback(msg, correct);
  revealCountry(capital.country, correct, geojson);

  questionIndex++;
  scheduleNextQuestion(correct ? 2200 : 3000);
}

function exitToModeSelect() {
  if (timerInterval) clearInterval(timerInterval);
  if (nextQuestionTimer) clearTimeout(nextQuestionTimer);
  timerInterval = null;
  nextQuestionTimer = null;
  answering = false;
  clearCountry();
  setFeedback('', false);
  showModeSelectScreen();
}

let pendingShareText = '';

function endGame() {
  if (mode === 'endless') return;
  saveResult(mode, score);
  show('screen-end');

  document.getElementById('end-score')!.textContent = `${score} / ${QUESTIONS}`;

  const emoji = queue
    .map((_, i) => (i < score ? '🟢' : '🔴'))
    .join('');

  const label = mode === 'hard' ? 'Capital Quiz (Hard)' : 'Capital Quiz';
  pendingShareText = `${label} ${todayISO()}\n${emoji} ${score}/${QUESTIONS}`;
  document.getElementById('share-text')!.textContent = emoji;
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
  const exitBtn = document.getElementById('exit-btn') as HTMLButtonElement;
  const shareBtn = document.getElementById('share-btn') as HTMLButtonElement;
  const modeGrid = document.querySelector<HTMLElement>('.mode-grid')!;

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
  exitBtn.addEventListener('click', exitToModeSelect);

  modeGrid.addEventListener('click', e => {
    const tile = (e.target as HTMLElement).closest<HTMLButtonElement>('.mode-tile');
    if (!tile || tile.disabled) return;
    selectMode(tile.dataset.mode as Mode);
  });

  shareBtn.addEventListener('click', () => {
    if (!pendingShareText) return;
    navigator.clipboard.writeText(pendingShareText).then(() => {
      shareBtn.textContent = 'Copied!';
      setTimeout(() => (shareBtn.textContent = 'Share result'), 2000);
    });
  });

  bootstrap();
});
