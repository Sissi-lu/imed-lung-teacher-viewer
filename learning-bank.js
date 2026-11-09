/* Question validation and progress rules shared by the local learning UI. */
const learningBankTools = (() => {
  function validate(bank) {
    if (!bank || typeof bank.version !== 'string' || !Array.isArray(bank.questions) || !bank.questions.length) {
      throw new Error('题库内容不完整，请检查本地题库文件。');
    }
    const ids = new Set();
    for (const question of bank.questions) {
      const options = question.options;
      if (!/^[NLQ]\d{2}$/.test(question.id) || ids.has(question.id)
        || !['normal', 'lesion', 'quality'].includes(question.group)
        || typeof question.prompt !== 'string' || !question.prompt.trim()
        || typeof question.explanation !== 'string'
        || !Array.isArray(options) || options.length !== 4
        || new Set(options.map(option => option.id)).size !== 4
        || options.some(option => typeof option.id !== 'string' || typeof option.text !== 'string' || !option.text.trim())
        || !options.some(option => option.id === question.answer)) {
        throw new Error('题目内容无效，请检查题号 ' + (question.id || '未知') + '。');
      }
      ids.add(question.id);
      if (question.image !== `images/${question.id}.png` || question.answerImage !== `answers/${question.id}.png`
        || !Array.isArray(question.imageSize) || question.imageSize.length !== 2
        || question.imageSize.some(size => !Number.isFinite(size) || size <= 0)
        || !Array.isArray(question.panels) || ![1, 2].includes(question.panels.length)) {
        throw new Error('题目图像配置无效，请检查题号 ' + question.id + '。');
      }
      for (const panel of question.panels) {
        const bounds = panel.bounds;
        if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some(value => !Number.isFinite(value))
          || bounds[0] < 0 || bounds[1] < 0 || bounds[2] > question.imageSize[0] || bounds[3] > question.imageSize[1]
          || bounds[2] <= bounds[0] || bounds[3] <= bounds[1] || !Number.isFinite(panel.aspect) || panel.aspect <= 0) {
          throw new Error('图像比例配置无效，请检查题号 ' + question.id + '。');
        }
      }
    }
    return bank;
  }

  function shuffled(ids) {
    const result = [...ids];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function createDisplayNumbers(questions) {
    return Object.fromEntries(questions.map((question, index) => [
      question.id, String(index + 1).padStart(2, '0'),
    ]));
  }

  function hydrate(bank, stored) {
    const saved = { answers: {}, viewed: [], optionOrder: {} };
    for (const question of bank.questions) {
      const ids = question.options.map(option => option.id);
      const answer = stored?.answers?.[question.id];
      if (!question.imagePlaceholder && ids.includes(answer)) saved.answers[question.id] = answer;
      const order = stored?.optionOrder?.[question.id];
      const validOrder = Array.isArray(order) && order.length === ids.length
        && new Set(order).size === ids.length && order.every(id => ids.includes(id));
      saved.optionOrder[question.id] = validOrder ? [...order] : shuffled(ids);
    }
    const viewed = Array.isArray(stored?.viewed) ? stored.viewed : [];
    saved.viewed = ['normal', 'lesion', 'quality'].filter(id => viewed.includes(id));
    return saved;
  }

  function summarize(questions, answers) {
    const submitted = questions.filter(question => !question.imagePlaceholder
      && question.options.some(option => option.id === answers[question.id]));
    const correct = submitted.filter(question => answers[question.id] === question.answer).length;
    const wrong = submitted.filter(question => answers[question.id] !== question.answer).map(question => question.id);
    return { total: questions.length, answered: submitted.length, correct, wrong };
  }

  return { validate, hydrate, summarize, createDisplayNumbers };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = learningBankTools;
else window.learningBankTools = learningBankTools;
