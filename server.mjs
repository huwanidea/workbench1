import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';
import { dateFromExcelSerial, dateToISO, monthKey, monthLabel, calculateMonth, normalizeState } from './public/calc.js';

const root = path.resolve('.');
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 4173);

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
const json = (response, status, payload) => { response.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(payload)); };

function valueAt(sheet, cell) { return sheet.getRange(cell).values?.[0]?.[0] ?? null; }
function text(value) { return value === null || value === undefined ? '' : String(value); }
function dateValue(value) {
  if (value instanceof Date) return dateToISO(value);
  if (typeof value === 'number') return dateFromExcelSerial(value);
  return dateToISO(value);
}
function sheetNamed(workbook, name) {
  const sheet = workbook.worksheets.getItemOrNullObject?.(name) || workbook.worksheets.getItem(name);
  return sheet && !sheet.isNullObject ? sheet : null;
}

async function importWorkbook(bytes) {
  const workbook = await SpreadsheetFile.importXlsx(new Uint8Array(bytes));
  const state = normalizeState({});
  const warnings = [];
  const profileSheet = sheetNamed(workbook, '基础信息');
  if (profileSheet) {
    state.profile.name = text(valueAt(profileSheet, 'B3'));
    state.profile.department = text(valueAt(profileSheet, 'D3'));
    state.profile.position = text(valueAt(profileSheet, 'F3'));
    state.profile.manager = text(valueAt(profileSheet, 'B4'));
    state.profile.year = Number(valueAt(profileSheet, 'D4')) || state.profile.year;
    state.profile.activationDate = dateValue(valueAt(profileSheet, 'F4'));
  } else warnings.push('未找到基础信息工作表');

  const parameterSheet = sheetNamed(workbook, '绩效参数');
  if (parameterSheet) {
    const params = ['standardDayHours', 'baseRewardPerHour', 'expansionFactor', 'overtimeFactor', 'monthlyInnovationMax', 'efficiencyMin', 'efficiencyMax', 'plannedOverageFactor'];
    params.forEach((key, index) => {
      const value = Number(valueAt(parameterSheet, `B${index + 4}`));
      if (Number.isFinite(value)) state.settings[key] = value;
    });
  } else warnings.push('未找到绩效参数工作表，使用默认参数');

  const dropdownSheet = workbook.worksheets.items.find((sheet) => sheet.name === '下拉配置');
  if (dropdownSheet) {
    const categories = (dropdownSheet.getRange('A2:A100').values || []).flat().map((value) => text(value).trim()).filter(Boolean);
    if (categories.length) state.settings.taskCategories = [...new Set(categories)];
  }

  const monthSheets = workbook.worksheets.items.filter((sheet) => /^\d{1,2}月任务明细$/.test(sheet.name));
  const archiveTasksSheet = sheetNamed(workbook, '任务明细');
  const taskSheets = monthSheets.length ? monthSheets.map((sheet) => ({ sheet, start: 7, endColumn: 'R' })) : archiveTasksSheet ? [{ sheet: archiveTasksSheet, start: 2, endColumn: 'T' }] : [];
  if (!taskSheets.length) warnings.push('未找到任务明细工作表');
  const taskColumns = ['date', 'content', 'category', 'planType', 'collaborator', 'estimatedHours', 'actualHours', 'completionPct', 'collaborationPct', 'innovation', 'selfScore', 'reviewerScore', 'nextPlan', 'blocker', 'breakthrough'];
  for (const { sheet, start, endColumn } of taskSheets) {
    const rows = sheet.getRange(`A${start}:${endColumn}${start + 300}`).values || [];
    let imported = 0;
    for (const row of rows) {
      if (!row?.[0] && !row?.[1]) continue;
      const task = { id: crypto.randomUUID() };
      taskColumns.forEach((key, index) => { task[key] = index === 0 ? dateValue(row[index]) : row[index] ?? ''; });
      if (!task.date || !task.content) { warnings.push(`${sheet.name} 有一行缺少日期或工作内容，已跳过`); continue; }
      state.tasks.push(task); imported += 1;
    }
    if (imported === 0) warnings.push(`${sheet.name} 未导入有效任务`);
  }

  const poolSheet = sheetNamed(workbook, '任务池');
  if (poolSheet) {
    const rows = poolSheet.getRange('A2:K300').values || [];
    for (const row of rows) {
      if (!row?.[0] && !row?.[1]) continue;
      state.workItems.push({ id: text(row[0]) || crypto.randomUUID(), title: text(row[1]), description: text(row[2]), category: text(row[3]) || state.settings.taskCategories[0], planType: text(row[4]) || '单人工作', priority: text(row[5]) || '普通', dueDate: dateValue(row[6]), status: text(row[7]) || 'todo', reviewer: text(row[8]), acceptanceStatus: text(row[9]), performanceTaskId: text(row[10]) });
    }
  }
  const plansSheet = sheetNamed(workbook, '计划');
  if (plansSheet) {
    const rows = plansSheet.getRange('A2:G500').values || [];
    for (const row of rows) {
      if (!row?.[0] || !row?.[1]) continue;
      const done = row[6] === true || ['是', '1', 'true'].includes(text(row[6]).toLowerCase());
      const dailyBucket = row[0] === '今日计划' ? 'today' : row[0] === '明日计划' ? 'tomorrow' : '';
      if (dailyBucket) {
        const date = dateValue(row[1]);
        if (!date || !text(row[4])) continue;
        const plan = state.dailyPlans[date] || (state.dailyPlans[date] = { today: [], tomorrow: [] });
        plan[dailyBucket].push({ id: text(row[4]), text: text(row[5]), done });
        continue;
      }
      const kind = row[0] === '周计划' ? 'weekly' : row[0] === '月计划' ? 'monthly' : '';
      if (!kind) continue;
      const plan = state.plans[kind][text(row[1])] || (state.plans[kind][text(row[1])] = { title: text(row[2]), notes: text(row[3]), items: [] });
      if (text(row[4])) plan.items.push({ id: text(row[4]), text: text(row[5]), done });
    }
  }

  const monthlySheet = sheetNamed(workbook, '月度绩效');
  if (monthlySheet) {
    for (let row = 4; row <= 15; row += 1) {
      const label = text(valueAt(monthlySheet, `A${row}`));
      const match = label.match(/(\d{1,2})月/);
      if (!match) continue;
      const key = monthKey(state.profile.year, Number(match[1]));
      state.monthlyReviews[key] = { collaboration: valueAt(monthlySheet, `E${row}`) ?? '', loyalty: valueAt(monthlySheet, `F${row}`) ?? '', discipline: valueAt(monthlySheet, `G${row}`) ?? '', learning: valueAt(monthlySheet, `H${row}`) ?? '', innovationBonus: valueAt(monthlySheet, `L${row}`) ?? '', note: text(valueAt(monthlySheet, `P${row}`)) };
    }
  }
  return { state, warnings, sheets: taskSheets.map(({ sheet }) => sheet.name) };
}

function setCell(range, values) { range.values = [values]; }
async function exportWorkbook(rawState) {
  const state = normalizeState(rawState);
  const workbook = Workbook.create();
  const overview = workbook.worksheets.add('总览');
  const tasksSheet = workbook.worksheets.add('任务明细');
  const daysSheet = workbook.worksheets.add('每日汇总');
  const monthSheet = workbook.worksheets.add('月度绩效');
  const settingsSheet = workbook.worksheets.add('参数设置');
  const poolSheet = workbook.worksheets.add('任务池');
  const plansSheet = workbook.worksheets.add('计划');
  overview.getRange('A1:B7').values = [['绩效考核总览', null], ['姓名', state.profile.name], ['部门', state.profile.department], ['岗位', state.profile.position], ['直属负责人', state.profile.manager], ['考核年度', state.profile.year], ['任务总数', state.tasks.length]];
  overview.getRange('A1:B1').format = { fill: '#172B4D', font: { bold: true, color: '#FFFFFF', fontSize: 16 } };
  tasksSheet.getRange('A1:T1').values = [['日期', '工作内容', '任务分类', '计划类型', '协作人', '预计工时', '实际工时', '交付完成%', '协作完成%', '创新分', '自评分', '负责人评分', '明日计划', '阻塞问题', '重大突破', '任务得分', '综合加权有效工时', '当日绩效加权平均分', '当日奖励分', '校验']];
  const taskRows = state.tasks.map((task) => { const month = calculateMonth(Number(task.date.slice(0, 4)), Number(task.date.slice(5, 7)), state); const day = month.days.find((entry) => entry.date === task.date); const calculated = day?.tasks?.find((entry) => entry.id === task.id) || task; return [task.date, task.content, task.category, task.planType, task.collaborator, task.estimatedHours, task.actualHours, task.completionPct, task.collaborationPct, task.innovation, task.selfScore, task.reviewerScore, task.nextPlan, task.blocker, task.breakthrough, calculated.taskScore ?? '', calculated.weightedEffectiveHours ?? '', day?.performance ?? '', day?.dailyReward ?? '', calculated.validationErrors?.join('；') || '正常']; });
  if (taskRows.length) tasksSheet.getRange(`A2:T${taskRows.length + 1}`).values = taskRows;
  daysSheet.getRange('A1:N1').values = [['日期', '标准工时', '任务数', '计划内有效工时', '拓展有效工时', '加班有效工时', '总有效工时', '绩效换算工时', '当日绩效', '奖励换算工时', '当日奖励', '实际工时', '状态', '校验']];
  const allDays = [];
  for (let month = 1; month <= 12; month += 1) allDays.push(...calculateMonth(state.profile.year, month, state).days);
  daysSheet.getRange(`A2:N${allDays.length + 1}`).values = allDays.map((day) => [day.date, day.standardHours, day.taskCount, day.plannedHours, day.expansionHours, day.overtimeHours, day.totalHours, day.performanceHours, day.performance ?? '', day.rewardHours, day.dailyReward, day.actualHours, day.status, day.validationErrors.join('；')]);
  monthSheet.getRange('A1:O1').values = [['月份', '已填写天数', '平均每日绩效', '月度奖励总分', '协同能力', '忠诚度', '纪律性', '学习力', '综合素养', '日常表现折算', '素养折算', '积极创新加分', '月度最终绩效', '绩效兑现比例', '绩效等级']];
  const monthRows = Array.from({ length: 12 }, (_, index) => calculateMonth(state.profile.year, index + 1, state)).map((month) => [monthLabel(month.key), month.scoredDays, month.averageDailyPerformance ?? '', month.monthlyReward, month.review.collaboration ?? '', month.review.loyalty ?? '', month.review.discipline ?? '', month.review.learning ?? '', month.competencyScore ?? '', month.dailyWeighted ?? '', month.competencyWeighted ?? '', month.innovationBonus, month.finalPerformance ?? '', month.payoutRatio ?? '', month.grade]);
  monthSheet.getRange('A2:O13').values = monthRows;
  settingsSheet.getRange('A1:B11').values = [['参数', '当前值'], ['标准日工时', state.settings.standardDayHours], ['基础奖励分/小时', state.settings.baseRewardPerHour], ['计划内超额奖励系数', state.settings.plannedOverageFactor], ['拓展工作奖励系数', state.settings.expansionFactor], ['加班工作奖励系数', state.settings.overtimeFactor], ['效率系数下限', state.settings.efficiencyMin], ['效率系数上限', state.settings.efficiencyMax], ['月度积极创新加分上限', state.settings.monthlyInnovationMax], ['日常表现权重', state.settings.dailyPerformanceWeight], ['综合素养权重', state.settings.competencyWeight]];
  poolSheet.getRange('A1:K1').values = [['ID', '任务名称', '说明', '工作分类', '计划类型', '优先级', '截止日期', '状态', '验收人', '验收状态', '绩效任务ID']];
  if (state.workItems.length) poolSheet.getRange(`A2:K${state.workItems.length + 1}`).values = state.workItems.map((item) => [item.id, item.title, item.description, item.category, item.planType, item.priority, item.dueDate, item.status, item.reviewer, item.acceptanceStatus, item.performanceTaskId]);
  plansSheet.getRange('A1:G1').values = [['计划类型', '计划周期', '主题', '说明', '事项ID', '计划事项', '已完成']];
  const planRows = [];
  for (const [kind, label] of [['weekly', '周计划'], ['monthly', '月计划']]) for (const [key, plan] of Object.entries(state.plans[kind] || {})) {
    const items = plan.items || [];
    if (!items.length) planRows.push([label, key, plan.title || '', plan.notes || '', '', '', '']);
    for (const item of items) planRows.push([label, key, plan.title || '', plan.notes || '', item.id, item.text, item.done ? '是' : '否']);
  }
  for (const [date, plan] of Object.entries(state.dailyPlans || {})) for (const [bucket, label] of [['today', '今日计划'], ['tomorrow', '明日计划']]) {
    for (const item of plan[bucket] || []) planRows.push([label, date, '', '', item.id, item.text, item.done ? '是' : '否']);
  }
  if (planRows.length) plansSheet.getRange(`A2:G${planRows.length + 1}`).values = planRows;
  for (const sheet of [overview, tasksSheet, daysSheet, monthSheet, settingsSheet, poolSheet, plansSheet]) { sheet.showGridLines = false; sheet.getUsedRange()?.format.autofitColumns(); }
  return await SpreadsheetFile.exportXlsx(workbook);
}

async function serveStatic(request, response) {
  let pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.resolve(publicDir, `.${pathname}`);
  if (!filePath.startsWith(publicDir)) return response.writeHead(403).end();
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' }[ext] || 'application/octet-stream';
    response.writeHead(200, { ...headers, 'Content-Type': contentType }); response.end(data);
  } catch { response.writeHead(404, headers).end('Not found'); }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return response.writeHead(204, headers).end();
  if (request.method === 'POST' && request.url === '/api/import') {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    try { return json(response, 200, await importWorkbook(Buffer.concat(chunks))); } catch (error) { return json(response, 400, { error: String(error?.message || error) }); }
  }
  if (request.method === 'POST' && request.url === '/api/export') {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    try { const blob = await exportWorkbook(JSON.parse(Buffer.concat(chunks).toString('utf8'))); const tempPath = path.join(root, 'work', 'server-export.xlsx'); await blob.save(tempPath); const bytes = await fs.readFile(tempPath); response.writeHead(200, { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="performance-review.xlsx"' }); return response.end(bytes); } catch (error) { return json(response, 400, { error: String(error?.message || error) }); }
  }
  return serveStatic(request, response);
});
server.listen(port, () => console.log(`绩效考核网页已启动: http://localhost:${port}`));
