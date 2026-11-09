(() => {
  'use strict';

  const icons = {
    book: '<path d="M12 6c-3-2-7-2-10-1v15c3-1 7-1 10 1m0-15c3-2 7-2 10-1v15c-3-1-7-1-10 1V6Z"/>',
    noise: '<path d="M3 8h3m3-4v3m5-2h3m3 4v3M4 15v3m5-7h3m2 6h3m3 2v2M8 21h2"/>',
    nodule: '<circle cx="12" cy="12" r="7" stroke-dasharray="2 4"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
    bubble: '<circle cx="10" cy="13" r="7"/><circle cx="18" cy="5" r="3"/><path d="M6 12c0-2 1-3 3-3"/>',
    other: '<rect x="3" y="3" width="6" height="6" rx="2"/><rect x="15" y="3" width="6" height="6" rx="2"/><rect x="3" y="15" width="6" height="6" rx="2"/><path d="M18 15v6m-3-3h6"/>',
    image: '<rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8" cy="8" r="2"/><path d="m3 17 6-6 4 4 3-3 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  };
  const icon = (name, cls = '') => `<svg class="lb-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.image}</svg>`;
  const tools = window.learningBankTools;
  let imageRoot = 'data/imaging-basics-v3/';
  const topics = [
    { id: 'normal', title: '肺 CT 内常见结构', subtitle: '肺血管、支气管、肺实质与心脏', previewId: 'N13', color: 'mint', icon: 'book' },
    { id: 'lesion', title: '病灶识别', subtitle: '实性、磨玻璃、部分实性与含气空腔', previewId: 'L14', color: 'peach', icon: 'nodule' },
    { id: 'quality', title: '图像质量', subtitle: '肺内噪声、重影伪影与显示窗', previewId: 'Q14', color: 'blue', icon: 'image' },
  ];
  const html = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  let bank, loading, loadError = '', storageKey;
  let saved = { answers: {}, viewed: [], optionOrder: {} };
  let storageAvailable = true;
  let page = 'overview', topicId = 'normal', queue = [], position = 0;
  let exampleIndex = 0;
  let selected = null, showAnswer = false, previousScroll = 0, companionHidden = true;
  const app = document.querySelector('.app');
  const companion = document.querySelector('#companion');
  const root = document.createElement('section');
  root.id = 'imagingLearning';
  root.className = 'lb-root';
  root.hidden = true;
  root.setAttribute('aria-label', '影像基础学习');
  document.body.append(root);

  const entry = document.createElement('button');
  entry.type = 'button';
  entry.className = 'lb-entry';
  entry.setAttribute('aria-label', '影像基础学习');
  entry.title = '影像基础学习';
  entry.innerHTML = `${icon('book')}<span><strong>影像基础学习</strong><small>先学一点，再探索</small></span><span aria-hidden="true">↗</span>`;
  document.querySelector('.mission .panel-heading').after(entry);
  const mobileEntry = entry.cloneNode(true);
  mobileEntry.className = 'lb-mobile-entry';
  document.querySelector('.intro').after(mobileEntry);

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }

  async function loadBank() {
    if (bank) return;
    if (loading) return loading;
    loadError = '';
    loading = (async () => {
      try {
        await window.resultProvider.ready;
        imageRoot = window.resultProvider.mode === 'server'
          ? '/api/learning/imaging-basics-v3/' : 'data/imaging-basics-v3/';
        const response = await fetch(imageRoot + 'questions.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('题库暂时无法读取，请检查题库数据与服务配置后重试。');
        const nextBank = tools.validate(await response.json());
        if (topics.some(topic => !nextBank.questions.some(question => question.group === topic.id))) {
          throw new Error('题库缺少学习主题，请检查本地题库文件。');
        }
        storageKey = 'lung-lab-imaging-basics:' + nextBank.version;
        let stored;
        try { stored = JSON.parse(localStorage.getItem(storageKey)); } catch { /* Use a fresh attempt. */ }
        saved = tools.hydrate(nextBank, stored);
        bank = nextBank;
        queue = [...bank.questions];
        persist();
      } catch (error) {
        loadError = error.message || '题库载入失败，请重试。';
      } finally {
        loading = null;
      }
    })();
    return loading;
  }

  async function openLearning() {
    previousScroll = window.scrollY;
    companionHidden = companion.hidden;
    companion.hidden = true;
    app.hidden = true;
    root.hidden = false;
    page = 'overview';
    const pending = loadBank();
    render();
    await pending;
    if (!root.hidden) render();
  }
  entry.onclick = mobileEntry.onclick = openLearning;

  function returnToWork() {
    root.querySelector('dialog[open]')?.close();
    root.hidden = true;
    app.hidden = false;
    companion.hidden = companionHidden;
    window.scrollTo(0, previousScroll);
    (entry.getClientRects().length ? entry : mobileEntry).focus({ preventScroll: true });
  }

  function groupQuestions(id) {
    return bank.questions.filter(question => question.group === id);
  }

  function orderedOptions(question) {
    return saved.optionOrder[question.id].map(id => question.options.find(option => option.id === id));
  }

  function optionText(question, id) {
    return question.options.find(option => option.id === id)?.text || '尚未作答';
  }

  // Each exported panel is mapped back to its source physical aspect ratio.
  // This restores the display geometry without generating or changing CT content.
  function studyImage(question, answer = false, compact = false) {
    const path = imageRoot + (answer ? question.answerImage : question.image);
    const labels = question.panelLabels || (question.comparison ? ['左图', '右图'] : ['定位图', '局部放大']);
    const panels = question.panels.map((panel, index) => {
      const [left, top, right, bottom] = panel.bounds;
      const width = right - left, height = bottom - top;
      const imageStyle = `width:${question.imageSize[0] / width * 100}%;height:${question.imageSize[1] / height * 100}%;left:${-left / width * 100}%;top:${-top / height * 100}%`;
      return `<figure class="lb-source-panel">
        <figcaption>${html(labels[index])}</figcaption>
        <div class="lb-panel-crop" style="aspect-ratio:${panel.aspect}">
          <img src="${html(path)}" alt="${html(question.id)} ${html(labels[index])}${answer ? '答案图' : '题图'}" style="${imageStyle}" decoding="async">
          <span class="lb-image-error" hidden>图像载入失败，请刷新重试。</span>
        </div>
      </figure>`;
    }).join('');
    return `<div class="lb-source-image ${compact ? 'lb-source-compact' : ''} ${question.panels.length === 1 ? 'lb-source-single' : ''}">${panels}${question.imagePlaceholder ? '<span class="lb-placeholder-label">占位图片 · 待替换</span>' : ''}</div>`;
  }

  function imageNote(question, answer) {
    if (question.imageNote) return html(question.imageNote);
    const note = question.comparison ? '左右图为同一区域的不同显示窗' : '蓝色箭头用于定位';
    return note + (answer ? ' · 黄色框为教学区域' : '');
  }

  function imageCredit(question) {
    const credit = question.citation;
    if (!credit) return '';
    return `<details class="lb-credit"><summary>图片来源与许可</summary><p>${html(credit.author)}</p><p><a href="${html(credit.source)}" target="_blank" rel="noopener noreferrer">原始来源 ↗</a> · <a href="${html(credit.licenseUrl)}" target="_blank" rel="noopener noreferrer">${html(credit.license)}</a></p><p>${html(credit.changes)}</p></details>`;
  }

  function overview() {
    const result = tools.summarize(bank.questions, saved.answers);
    const startLabel = result.answered === result.total ? '查看练习小结' : result.answered ? '继续练习' : '开始看图练习';
    return `<div class="lb-overview-top">
      <div class="lb-hero">
        <h1 tabindex="-1">看懂细节，<br>从这里开始<span>。</span></h1>
        <p>认识不同的影像表现，练习观察与判断。<br>为下一次影像探索，做好准备。</p>
        <div class="lb-hero-actions"><button class="lb-button" data-action="practice">${startLabel} ${icon('arrow')}</button><span>${topics.length} 个主题 · ${result.total} 道练习</span></div>
        <div class="lb-hero-art" aria-hidden="true"><div class="lb-orbit"></div><div class="lb-art-frame">${icon('book')}</div><span class="lb-art-star">✦</span></div>
      </div>
      <aside class="lb-progress-card">
        <h2>你的学习足迹</h2>
        <div class="lb-ring" style="--progress:${result.answered / result.total * 100}%"><div><strong>${result.answered}<small> / ${result.total}</small></strong><span>已提交练习</span></div></div>
        <div class="lb-progress-caption"><span>知识卡片已浏览</span><b>${saved.viewed.length} / ${topics.length}</b></div>
        <p>${storageAvailable ? '进度保存在当前浏览器' : '本次进度保留在当前页面'}</p>
      </aside>
    </div>
    <div class="lb-section-title"><h2>先认识，再判断</h2></div>
    <div class="lb-topic-grid lb-bank-topics">${topics.map((topic, index) => {
      const questions = groupQuestions(topic.id);
      const progress = tools.summarize(questions, saved.answers);
      return `<button class="lb-topic lb-${topic.color}" data-action="topic" data-topic="${topic.id}">
        <div class="lb-topic-top"><span class="lb-topic-symbol">${icon(topic.icon)}</span><span class="lb-topic-number">0${index + 1}</span></div>
        ${studyImage(questions.find(question => question.id === topic.previewId) || questions[0], false, true)}
        <h3>${topic.title}</h3><p>${topic.subtitle}</p>
        <div class="lb-topic-foot"><span>${progress.answered} / ${questions.length} 题已完成</span><span aria-hidden="true">↗</span></div>
      </button>`;
    }).join('')}</div>`;
  }

  function detail() {
    const topic = topics.find(item => item.id === topicId);
    const questions = groupQuestions(topicId);
    const example = questions[exampleIndex] || questions[0];
    return `<button class="lb-text-button" data-action="overview">← 全部学习主题</button>
      <div class="lb-section-title"><div><h1 tabindex="-1">${topic.title}</h1><p>${topic.subtitle}</p></div></div>
      <div class="lb-detail-grid">
        <div class="lb-image-panel">
          <label class="lb-example-picker">学习示例<select id="learningExamplePicker" aria-label="选择学习示例">${questions.map((question, index) => `<option value="${index}" ${question.id === example.id ? 'selected' : ''}>${html(question.id)} · ${html(question.objective)}</option>`).join('')}</select></label>
          <div class="lb-image-header"><span>示例讲解 · ${example.id}</span><button class="lb-text-button" data-action="zoom">⤢ 放大查看</button></div>
          ${studyImage(example, true)}
          <div class="lb-image-footer"><span>${imageNote(example, true)}</span></div>${imageCredit(example)}
        </div>
        <div class="lb-detail-copy">
          <div class="lb-topic-symbol lb-${topic.color}">${icon(topic.icon)}</div>
          <h2>${html(example.objective)}</h2>
          <div class="lb-knowledge-row"><div><h3>观察提示</h3><p>${html(example.explanation)}</p></div></div>
          <button class="lb-button" data-action="topic-practice">进入本组练习 · ${questions.length} 题 ${icon('arrow')}</button>
        </div>
      </div>`;
  }

  function practice() {
    const question = queue[position];
    const answer = saved.answers[question.id];
    selected = answer || null;
    const options = orderedOptions(question);
    const referenceIndex = options.findIndex(option => option.id === question.answer);
    const matches = answer === question.answer;
    const progress = tools.summarize(queue, saved.answers);
    return `<div class="lb-section-title"><div><h1 tabindex="-1">看图练习</h1><p>${topics.find(topic => topic.id === question.group).title}</p></div><button class="lb-text-button" data-action="overview">返回学习概览 ↗</button></div>
      <div class="lb-quiz-progress"><span>第 <b>${position + 1}</b> / ${queue.length} 题</span><div role="progressbar" aria-label="练习进度" aria-valuemin="0" aria-valuemax="${queue.length}" aria-valuenow="${progress.answered}"><i style="width:${progress.answered / queue.length * 100}%"></i></div><span>${progress.answered} 题已提交</span></div>
      <div class="lb-quiz-grid">
        <div class="lb-image-panel">
          <div class="lb-image-header"><span>${question.id} · ${question.imagePlaceholder ? '占位图' : showAnswer ? '答案图' : '题图'}</span><button class="lb-text-button" data-action="zoom">⤢ 放大查看</button></div>
          ${answer ? `<div class="lb-image-tabs"><button data-action="question-image" aria-pressed="${!showAnswer}">查看题图</button><button data-action="answer-image" aria-pressed="${showAnswer}">查看答案图</button></div>` : ''}
          ${studyImage(question, Boolean(answer) && showAnswer)}
          <div class="lb-image-footer"><span>${imageNote(question, showAnswer)}</span>${question.imagePlaceholder ? '' : '<span>图像左侧为患者右侧</span>'}</div>${imageCredit(question)}
        </div>
        <div class="lb-question-panel">
          <h2 id="lbQuestionTitle">${html(question.prompt)}</h2>
          <fieldset class="lb-options" aria-labelledby="lbQuestionTitle" ${answer || question.imagePlaceholder ? 'disabled' : ''}>
            <legend class="lb-sr-only">请选择一个答案</legend>
            ${options.map((option, index) => `<label class="lb-option ${answer === option.id ? 'is-selected' : ''} ${answer && option.id === question.answer ? 'is-reference' : ''}">
              <input type="radio" name="lb-answer" value="${html(option.id)}" ${answer === option.id ? 'checked' : ''}>
              <span class="lb-option-letter">${'ABCD'[index]}</span><span>${html(option.text)}</span><span class="lb-option-dot"></span>
            </label>`).join('')}
          </fieldset>
          ${question.imagePlaceholder ? `<div class="lb-feedback" role="status"><span>${icon('image')}</span><div><strong>图片待补充</strong><p>当前图片用于版式预览，补充对应影像后开放作答。</p></div></div><button class="lb-button" data-action="next">${position === queue.length - 1 ? '查看练习小结' : '下一题'} ${icon('arrow')}</button>` : answer ? `<div class="lb-feedback ${matches ? 'lb-matched' : 'lb-needs-review'}" role="status"><span>${matches ? icon('check') : '↻'}</span><div>
            <strong>${matches ? '回答正确' : '再观察一次'}</strong>
            <p>你的选择为 ${html(optionText(question, answer))}。<br>正确答案为 ${'ABCD'[referenceIndex]} · ${html(optionText(question, question.answer))}。</p>
            <p>${html(question.explanation)}</p>
          </div></div>
          <div class="lb-question-actions"><button class="lb-text-button" data-action="reanswer">重新作答</button><button class="lb-button" data-action="next">${position === queue.length - 1 ? '查看练习小结' : '下一题'} ${icon('arrow')}</button></div>`
            : `<button class="lb-button lb-submit" data-action="submit" disabled>提交答案 ${icon('arrow')}</button>`}
        </div>
      </div>
      <div class="lb-question-bottom"><button class="lb-text-button" data-action="previous" ${position === 0 ? 'disabled' : ''}>← 上一题</button><button class="lb-text-button" data-action="overview">保存进度，稍后继续 ↗</button></div>`;
  }

  function summary() {
    const result = tools.summarize(queue, saved.answers);
    return `<div class="lb-summary">
      <div class="lb-summary-icon">${icon('check')}</div><h1 tabindex="-1">练习小结</h1>
      <div class="lb-summary-stats">
        <div><strong>${result.answered}<small> / ${result.total}</small></strong><span>本组已提交</span></div>
        <div><strong>${result.correct}<small> / ${result.answered}</small></strong><span>答对题目</span></div>
        <div><strong>${result.wrong.length}</strong><span>待回顾题目</span></div>
      </div>
      <div class="lb-summary-actions">
        <button class="lb-button lb-outline" data-action="review-wrong" ${result.wrong.length ? '' : 'disabled'}>回顾待复习题</button>
        <button class="lb-button lb-outline" data-action="restart">重做本组</button>
        <button class="lb-button" data-action="work">返回影像工作台 ${icon('arrow')}</button>
      </div>
    </div>
    <div class="lb-section-title"><h2>回顾作答</h2><button class="lb-text-button" data-action="overview">回到学习概览 ↗</button></div>
    <div class="lb-review-grid">${queue.map((question, index) => {
      const answer = saved.answers[question.id];
      const status = question.imagePlaceholder ? '图片待补充' : answer ? answer === question.answer ? '回答正确' : '待回顾' : '尚未作答';
      return `<button class="lb-review-card" data-action="review-question" data-index="${index}"><span class="lb-review-number">${question.id}</span><div><strong>${html(question.objective)}</strong><small>${status}</small></div><span>↗</span></button>`;
    }).join('')}</div>`;
  }

  function render() {
    const step = page === 'practice' ? 1 : page === 'summary' ? 2 : 0;
    const skinOptions = document.querySelector('#skinPicker')?.innerHTML;
    let content;
    if (!bank) {
      content = `<div class="lb-summary"><h1 tabindex="-1">${loadError ? '题库暂时无法打开' : '正在载入题库'}</h1><p>${html(loadError || '请稍候…')}</p>${loadError ? '<button class="lb-button" data-action="retry">重新载入</button>' : ''}</div>`;
    } else {
      content = page === 'overview' ? overview() : page === 'detail' ? detail() : page === 'practice' ? practice() : summary();
    }
    const current = bank && (page === 'practice' ? queue[position] : groupQuestions(topicId)[exampleIndex] || groupQuestions(topicId)[0]);
    root.innerHTML = `<div class="lb-shell">
      <div class="lb-topbar">
        <button class="lb-back" data-action="work">← <span>返回影像工作台</span></button><span class="lb-topbar-title">${icon('book')} 影像基础学习</span>
        <div class="lb-topbar-actions">${skinOptions ? `<label class="skin-picker lb-skin-picker">🎨 <select id="learningSkinPicker" aria-label="学习界面皮肤">${skinOptions}</select></label>` : ''}</div>
      </div>
      <div class="lb-body">
        <nav class="lb-breadcrumb" aria-label="学习导航"><button data-action="overview">学习中心</button><span>/</span><span>${page === 'detail' ? topics.find(topic => topic.id === topicId).title : ['学习概览', '看图练习', '练习小结'][step]}</span></nav>
        <div class="lb-stage-nav" aria-label="学习流程">${['基础认知', '看图练习', '练习小结'].map((label, index) => `<button data-action="${['overview', 'practice', 'summary'][index]}" ${step === index ? 'aria-current="step"' : ''} ${bank ? '' : 'disabled'}><span>${String(index + 1).padStart(2, '0')}</span>${label}</button>`).join('')}</div>
        ${content}
        <div class="lb-footer"><span>◈ LUNG LAB <span>/</span> 影像基础学习</span></div>
      </div>
    </div>
    ${current ? `<dialog class="lb-zoom-dialog" aria-label="教学图像预览"><div class="lb-image-header"><strong>${current.id} · ${current.imagePlaceholder ? '占位图' : page === 'detail' || showAnswer ? '答案图' : '题图'}</strong><button class="lb-text-button" data-action="close-zoom" autofocus>关闭 ✕</button></div>${studyImage(current, page === 'detail' || showAnswer)}</dialog>` : ''}`;
    const picker = root.querySelector('#learningSkinPicker');
    if (picker) picker.value = document.body.dataset.skin;
    window.scrollTo(0, 0);
    root.querySelector('h1')?.focus({ preventScroll: true });
  }

  function startPractice(group) {
    queue = group ? groupQuestions(group) : [...bank.questions];
    const next = queue.findIndex(question => !saved.answers[question.id]);
    position = next < 0 ? 0 : next;
    page = next < 0 ? 'summary' : 'practice';
    showAnswer = false;
  }

  root.addEventListener('error', event => {
    if (event.target.tagName !== 'IMG') return;
    event.target.hidden = true;
    const fallback = event.target.parentElement.querySelector('.lb-image-error');
    if (fallback) fallback.hidden = false;
  }, true);

  root.addEventListener('change', event => {
    if (event.target.id === 'learningSkinPicker') {
      setSkin(event.target.value);
      return;
    }
    if (event.target.id === 'learningExamplePicker') {
      exampleIndex = Number(event.target.value);
      render();
      return;
    }
    if (event.target.name !== 'lb-answer') return;
    selected = event.target.value;
    root.querySelectorAll('.lb-option').forEach(label => label.classList.toggle('is-selected', label.querySelector('input').checked));
    root.querySelector('[data-action="submit"]').disabled = false;
  });

  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'work') { returnToWork(); return; }
    if (action === 'retry') {
      const pending = loadBank();
      render();
      await pending;
      if (!root.hidden) render();
      return;
    }
    if (!bank) return;
    switch (action) {
      case 'overview': page = 'overview'; break;
      case 'topic':
        topicId = button.dataset.topic;
        exampleIndex = 0;
        page = 'detail';
        if (!saved.viewed.includes(topicId)) { saved.viewed.push(topicId); persist(); }
        break;
      case 'topic-practice': startPractice(topicId); break;
      case 'practice': startPractice(); break;
      case 'summary':
        if (!queue.length) queue = [...bank.questions];
        page = 'summary';
        break;
      case 'submit': {
        const question = queue[position];
        if (question.imagePlaceholder || !question.options.some(option => option.id === selected)) return;
        saved.answers[question.id] = selected;
        showAnswer = true;
        persist();
        break;
      }
      case 'next':
        if (position < queue.length - 1) position++;
        else page = 'summary';
        showAnswer = Boolean(saved.answers[queue[position].id]);
        break;
      case 'previous':
        position = Math.max(0, position - 1);
        showAnswer = Boolean(saved.answers[queue[position].id]);
        break;
      case 'reanswer':
        delete saved.answers[queue[position].id];
        showAnswer = false;
        persist();
        break;
      case 'restart':
        queue.forEach(question => {
          delete saved.answers[question.id];
          delete saved.optionOrder[question.id];
        });
        saved = tools.hydrate(bank, saved);
        persist();
        position = 0;
        showAnswer = false;
        page = 'practice';
        break;
      case 'review-wrong': {
        const wrong = tools.summarize(queue, saved.answers).wrong;
        queue = queue.filter(question => wrong.includes(question.id));
        position = 0;
        page = 'practice';
        showAnswer = true;
        break;
      }
      case 'review-question':
        position = Number(button.dataset.index);
        page = 'practice';
        showAnswer = Boolean(saved.answers[queue[position].id]);
        break;
      case 'question-image': showAnswer = false; break;
      case 'answer-image': showAnswer = true; break;
      case 'zoom': root.querySelector('dialog').showModal(); return;
      case 'close-zoom': root.querySelector('dialog').close(); return;
      default: return;
    }
    render();
  });
})();
