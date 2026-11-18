# LUNG LAB 肺部影像实验室

本地游戏风格演示界面。真实CT切片、现有分割叠加、Word结构化报告、Excel原始影像报告。支持独立SAM2服务提供单帧交互分割，报告生成模型尚未接入。

运行 `server.py` 后打开 http://127.0.0.1:8765 。请勿直接双击 index.html，浏览器读取本地数据需要HTTP服务。

首次准备数据：用装有 numpy、python-docx、openpyxl 的 Python 执行 `prepare.py`。生成数据仅在本机保存。`server.py` 只监听本机地址。

病例来源：CT和标签来自 `../30`；结构化报告来自 `../ZX5057258.docx`；原报告来自 `../0512勾画影像检查报告.xlsx` 的 Sheet3 第31行 P/Q列。未使用旧 slot/form 数据。不同来源内容存在差异，界面分别展示，不自动合并。

当前示例为轴位。导入其他 NIfTI-1 三维文件支持原始体素阅片，未执行空间方向标准化，因此不显示方向字母，也不套用30号病例的分割与报告。尚不支持DICOM、三维表面或自动分割。

影像基础学习在服务器模式下通过 `/api/learning/imaging-basics-v3/` 读取题库。将本地运行题库中的 `questions.json`、`images/` 和 `answers/` 同步到 `--data-root` 指定目录下的 `imaging-basics-v3/`。默认位置为 `/data5/zhangzhixuan/Med3DVLM/data/imaging-basics-v3/`。审核记录保存在数据维护端。

使用 `server.py` 本地预览时，学习模块沿用项目内的 `data/imaging-basics-v3/`。题目版本相同时，已有浏览器进度继续保留。

学习题目按完整题库数组顺序生成 `01` 起的展示编号，分组与错题回顾沿用同一映射。原始题号继续用于文件路径、判分和进度保存。`learning-question-map.json` 保存当前14题的展示编号与源题号对照，维护题库顺序时应同步更新该表。

## 三种阅片练习

选择病例时选择 **学习／应用／创新**。训练流程为阅片练习、报告填写、评估与复盘、导出训练结果。

- 学习：点击结节，沿用尝试次数扣分和十次后提示规则。
- 应用：选定一帧，逐点绘制轮廓；点击起点或 Enter 闭合，Escape 取消未闭合轮廓；可拖动顶点、右键删除顶点，新增多个病灶。
- 创新：选定一帧，每个病灶至少提供一个前景点和一个背景点，自动调用 SAM2。支持拖动点、右键删除点、撤销、新增／切换病灶及重试分割。

应用／创新按所选帧全部病灶并集计算 Dice，达到 **0.50** 才能填写报告。标注占25分（Dice×25），报告占75分。达标前隐藏参考叠加；病例整体无有效GT时允许练习、不计标注分，报告按100分计。有GT但选择了无病灶帧时需重新选帧。SAM置信度不作为Dice。

浏览器会话中按病例及难度保存草稿，旧草稿属于学习模式。每次标注提交在独立目录保存匿名会话、点／轮廓、模型信息、Dice、原图与mask，不覆盖先前记录。工具栏提供本次档案ZIP下载，最终作业JSON包含草稿标注与提交编号。重新编辑会使完成状态和报告评价失效。

### 服务部署

主服务环境安装 `requirements.txt`。SAM使用独立conda环境，安装PyTorch 2.5.1、torchvision 0.20.1以及 `requirements-sam.txt`；保留参考SAM项目及其 `external/sam2` 源码。通过 `--sam-source`、`--checkpoint`、`--device` 指定源码、权重和GPU；本功能仅运行推理。

```bash
bash scripts/start_practice_services.sh sam     # 独立启动SAM，127.0.0.1:8766
bash scripts/start_practice_services.sh viewer  # 启动阅片服务，0.0.0.0:8765
# 亦可使用 all；已有同名screen会保留，重启前先停止对应screen。
screen -S imed-lung-sam-8766 -X quit
screen -S imed-lung-viewer-8765 -X quit
```

启动脚本支持 `SAM_PYTHON`、`SAM_SOURCE`、`SAM_CHECKPOINT`、`SAM_DEVICE`、`VIEWER_PYTHON`、`DATA_ROOT`、`PRACTICE_OUTPUT_ROOT` 和 `PRACTICE_LOG_ROOT`。每次启动创建新日志目录；留档默认写入仓库外的 `experiments/imed-lung-teacher-viewer/practice_records`。

主服务通过 `/api/sam/` 转发健康检查和分割请求，SAM停止不影响学习及手工标注。SAM会话空闲30分钟后过期，最多缓存4个，过期后可重试重建；每次预测发送当前完整点集。`POST /api/practice/submissions` 由主服务评分并落盘，`GET /api/practice/submissions/{id}/download` 下载档案。

```bash
python -m unittest discover -s tests -p '*test.py'
node tests/localization.test.cjs
node tests/teaching.test.cjs
node tests/measurement.test.cjs
node tests/learning.test.cjs
npm install
npx playwright install chromium
npm run test:browser
# 已有Chromium时可指定CHROMIUM_PATH，服务地址可指定PRACTICE_BASE_URL。
```

浏览器回归使用模拟病例与SAM响应检查交互；真实模型需单独验证 `/api/sam/health` 及真实切片前背景点预测。

已在70服务器验证：三种模式浏览器回归通过；30号病例第157原始切片的真实SAM2两轮点提示、主服务评分、ZIP下载及会话释放通过（该次Dice约0.871）。该验证使用参考标签选取测试点，用于检查接口与坐标链路。
