# LUNG LAB 肺部影像实验室

本地游戏风格演示界面。真实CT切片、现有分割叠加、Word结构化报告、Excel原始影像报告。没有模型推理功能。

运行 `server.py` 后打开 http://127.0.0.1:8765 。请勿直接双击 index.html，浏览器读取本地数据需要HTTP服务。

首次准备数据：用装有 numpy、python-docx、openpyxl 的 Python 执行 `prepare.py`。生成数据仅在本机保存。`server.py` 只监听本机地址。

病例来源：CT和标签来自 `../30`；结构化报告来自 `../ZX5057258.docx`；原报告来自 `../0512勾画影像检查报告.xlsx` 的 Sheet3 第31行 P/Q列。未使用旧 slot/form 数据。不同来源内容存在差异，界面分别展示，不自动合并。

当前示例为轴位。导入其他 NIfTI-1 三维文件支持原始体素阅片，未执行空间方向标准化，因此不显示方向字母，也不套用30号病例的分割与报告。尚不支持DICOM、三维表面或自动分割。

影像基础学习在服务器模式下通过 `/api/learning/imaging-basics-v3/` 读取题库。将本地运行题库中的 `questions.json`、`images/` 和 `answers/` 同步到 `--data-root` 指定目录下的 `imaging-basics-v3/`。默认位置为 `/data5/zhangzhixuan/Med3DVLM/data/imaging-basics-v3/`。审核记录保存在数据维护端。

使用 `server.py` 本地预览时，学习模块沿用项目内的 `data/imaging-basics-v3/`。题目版本相同时，已有浏览器进度继续保留。

学习题目按完整题库数组顺序生成 `01` 起的展示编号，分组与错题回顾沿用同一映射。原始题号继续用于文件路径、判分和进度保存。`learning-question-map.json` 保存当前14题的展示编号与源题号对照，维护题库顺序时应同步更新该表。
