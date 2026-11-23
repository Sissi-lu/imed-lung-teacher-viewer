# LUNG LAB 肺部影像实验室

本地游戏风格演示界面。真实CT切片、现有分割叠加、Word结构化报告、Excel原始影像报告。支持独立SAM2服务提供单帧交互分割，报告生成模型尚未接入。

运行 `server.py` 后打开 http://127.0.0.1:8765 。请勿直接双击 index.html，浏览器读取本地数据需要HTTP服务。

首次准备数据：用装有 numpy、python-docx、openpyxl 的 Python 执行 `prepare.py`。生成数据仅在本机保存。`server.py` 与 `remote_server.py` 使用同一套登录和账号保存服务。

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

应用／创新按所选帧全部病灶并集计算 Dice，达到 **0.50** 才能填写报告。标注占25分（Dice×25），报告占75分。应用／创新的影像视窗仅显示用户在标注帧绘制的轮廓或SAM结果，GT仅用于评分，不参与影像叠加；切换其他帧时不显示该分割。“分割叠加”控制用户结果的显隐，“返回标注帧”返回用户选定的切片。病例整体无有效GT时允许练习、不计标注分，报告按100分计。有GT但选择了无病灶帧时需重新选帧。SAM置信度不作为Dice。

登录后按账号、病例及难度在服务器保存草稿与评分，支持换浏览器继续；旧匿名草稿不自动导入。每次标注提交在独立目录保存匿名会话、点／轮廓、模型信息、Dice、原图与mask，不覆盖先前记录。工具栏提供本次档案ZIP下载，最终作业JSON包含草稿标注与提交编号。重新编辑会使完成状态和报告评价失效。影像视窗顶部的“重新开始分割”可清空当前难度的定位记录、轮廓、提示点和分割结果，重新选帧练习；不重新下载CT，保留报告草稿及已提交档案。

### 服务部署

主服务环境安装 `requirements.txt`。SAM使用独立conda环境，安装PyTorch 2.5.1、torchvision 0.20.1以及 `requirements-sam.txt`；保留参考SAM项目及其 `external/sam2` 源码。通过 `--sam-source`、`--checkpoint`、`--device` 指定源码、权重和GPU；本功能仅运行推理。

```bash
bash /data_new/moyancheng/code/imed-lung-teacher-viewer/scripts/start_practice_services.sh sam     # 独立启动SAM，127.0.0.1:8766
bash /data_new/moyancheng/code/imed-lung-teacher-viewer/scripts/start_practice_services.sh viewer  # 启动阅片服务，0.0.0.0:8765
# 亦可使用 all；已有同名screen会保留，重启前先停止对应screen。
screen -S imed-lung-sam-8766 -X quit
screen -S imed-lung-viewer-8765 -X quit
```

SAM 默认使用以下绝对路径，可从任意工作目录调用上述启动脚本：

- Python：`/data_new/moyancheng/envs/imed-lung-sam-api/bin/python`
- API 入口：`/data_new/moyancheng/code/imed-lung-teacher-viewer/sam_api.py`
- SAM 源码：`/data_new/moyancheng/code/agent/SAM/segment-anything`
- checkpoint：`/data_new/moyancheng/code/agent/SAM/segment-anything/web_ui/checkpoints/lung_sam2_hiera_l.pt`

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

阅片视窗左上角显示虚构姓名和SIM病例ID，以及对应Excel报告H列的年龄、D列的性别；缺失字段显示“未提供”。右上角显示图像尺寸、切片、窗宽窗位和体素间距。信息锚定在实际图像范围内（排除黑色填充），缩放、平移、窗口尺寸变化时重新定位。本地导入无关联报告时不套用上一病例的人口学信息。


## 账号与管理员游玩记录

首次使用在登录页注册普通用户。管理员通过服务器命令创建，密码交互输入，不存在默认管理员密码：

```bash
/data_new/moyancheng/envs/imed-lung-teacher-viewer/bin/python account_store.py --username teacher --user-data-root /path/to/account-data
```

主服务必须指向同一目录：`remote_server.py --user-data-root /path/to/account-data`；启动脚本对应环境变量为 `USER_DATA_ROOT`。该目录保存 SQLite、账号会话和上传影像，应设置为运行账号可写并纳入备份，不放入静态资源目录。已有仓库继续使用现有独立 conda 环境，无需新环境。

每次进入病例创建独立记录，恢复该账号最新草稿；主页和后台不计游玩时长。修改约500毫秒后自动保存，每15秒同步时长；异常关闭可能丢失最近一个同步周期。影像基础学习也保存到账号。未登录、其他普通用户均不能访问个人上传、进度、提交和 SAM 会话。多窗口版本冲突会停止覆盖并提示重新载入。

管理员主页及工作台提供「用户游玩记录」。详情复用游戏界面，允许查看报告、重新调整分割和试算评分；顶部「返回游玩记录」会丢弃所有临时调整，原用户作业、分数及归档不变。SAM 不可用时仍可查看记录及手工编辑，创新模式重新分割需启动独立 SAM 服务。

病例选择框可上传 `.nii` 或 `.nii.gz`，最大512 MiB、三维最多1.8亿体素，解压最大1.5 GiB。上传后可在病例搜索框按文件名找到并继续练习；三种难度均可使用，没有GT时不计分割分，报告按无参考病例规则评分。仅本人和管理员可读取导入影像。

正式部署推荐由 HTTPS 反向代理提供访问，主服务增加 `--secure-cookie`。内网 HTTP 调试不加该参数。独立 SAM 端口应仅允许主服务访问，外部客户端统一通过主服务的鉴权代理调用。

新增验证：`python -m unittest discover -s tests -p '*test.py'`。真实账号浏览器集成需先在独立数据目录和端口启动服务，再运行：

```bash
PRACTICE_BASE_URL=http://127.0.0.1:18765 ACCOUNT_TEST_STATE=/tmp/imed-auth-validation/state node tests/account_browser.cjs
```

该测试会在指定测试目录创建随机测试账号和小型合成影像，请勿指向线上目录。原有 `npm run test:browser` 使用模拟账号接口检查既有界面；新集成测试使用真实登录、上传、保存与管理员回看接口，SAM仍使用独立测试或既有模型验证流程。
