import assert from 'node:assert/strict';
import { DEFAULT_STATE, calculateDay, calculateMonth, normalizeState, validateTask } from '../public/calc.js';

const base = normalizeState({ profile: { year: 2026, activationDate: '2026-01-01' } });
const task = (overrides = {}) => ({ id: 't', date: '2026-08-03', content: '测试任务', category: '需求开发', planType: '单人工作', collaborator: '', estimatedHours: 7 + 20 / 60, actualHours: 7 + 20 / 60, completionPct: 100, collaborationPct: 0, innovation: 0, selfScore: 100, reviewerScore: 100, nextPlan: '', blocker: '', breakthrough: '', ...overrides });

let state = normalizeState({ ...base, tasks: [task()] });
let day = calculateDay('2026-08-03', state.tasks, state);
assert.equal(Math.round(day.performance), 100);
assert.equal(day.dailyReward, 0);

state = normalizeState({ ...base, tasks: [task({ estimatedHours: 10, actualHours: 10 })] });
day = calculateDay('2026-08-03', state.tasks, state);
assert.equal(day.performance, 100);
assert.ok(day.dailyReward > 0);

state = normalizeState({ ...base, tasks: [task({ estimatedHours: 5, actualHours: 5, completionPct: 100 })] });
day = calculateDay('2026-08-03', state.tasks, state);
assert.ok(day.performance < 100);
assert.equal(day.dailyReward, 0);

state = normalizeState({ ...base, tasks: [task({ planType: '协同工作', collaborator: '', collaborationPct: 30 })] });
assert.ok(validateTask(state.tasks[0]).some((message) => message.includes('协同工作')));

state = normalizeState({ ...base, tasks: [task({ date: '2026-08-03' })], monthlyReviews: { '2026-08': { collaboration: 100, loyalty: 100, discipline: 100, learning: 100, innovationBonus: 0 } } });
const month = calculateMonth(2026, 8, state);
assert.equal(month.scoredDays, 1);
assert.equal(month.finalPerformance, 100);
assert.equal(month.payoutRatio, 1);

state = normalizeState({ ...base, calendarOverrides: { '2026-08-03': { kind: 'holiday' } }, tasks: [task()] });
day = calculateDay('2026-08-03', state.tasks, state);
assert.equal(day.standardHours, 0);
assert.equal(day.status, '非考核日有工作');

state = normalizeState({ ...base, dailyPlans: { '2026-08-03': { today: [{ id: 'd1', text: '整理需求', done: true }], tomorrow: [{ id: 'd2', text: '开始开发' }] } } });
assert.deepEqual(state.dailyPlans['2026-08-03'].today[0], { id: 'd1', text: '整理需求', done: true });
assert.deepEqual(state.dailyPlans['2026-08-03'].tomorrow[0], { id: 'd2', text: '开始开发', done: false });

state = normalizeState({ ...base, tasks: [task({ order: 20, body: '# 记录', subtasks: [{ id: 's1', text: '拆分页面', done: true }], nextPlan: '继续回归', nextPlanOrder: 10, nextPlanDone: true, sourceDailyItemId: 'daily-1', frozen: true, nextPlanFrozen: true })], dailyPlans: { '2026-08-03': { today: [{ id: 'd1', text: '整理需求', done: false, order: 30, frozen: true }], tomorrow: [] } } });
assert.equal(state.tasks[0].order, 20);
assert.equal(state.tasks[0].nextPlanOrder, 10);
assert.equal(state.tasks[0].nextPlanDone, true);
assert.equal(state.tasks[0].sourceDailyItemId, 'daily-1');
assert.equal(state.tasks[0].body, '# 记录');
assert.deepEqual(state.tasks[0].subtasks, [{ id: 's1', text: '拆分页面', done: true }]);
assert.equal(state.tasks[0].frozen, true);
assert.equal(state.tasks[0].nextPlanFrozen, true);
assert.equal(state.dailyPlans['2026-08-03'].today[0].order, 30);
assert.equal(state.dailyPlans['2026-08-03'].today[0].frozen, true);

console.log('calc tests passed');
