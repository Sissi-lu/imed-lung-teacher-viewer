# 70服务器部署

访问：http://172.18.36.70:9070/

应用账号：luxiaoxi。应用目录：`/home/luxiaoxi/apps/lung-lab`。

只读数据根目录：`/data5/zhangzhixuan/Med3DVLM/data`。

病例关联：Pulm数字目录名对应Excel Sheet3的L列序号；M列检查号对应`10月6日新一批报告/检查号.docx`；P/Q列分别为影像所见和诊断意见。不使用旧slot/form报告。当前目录索引332个有CT的病例，330个有Excel影像所见，25个匹配到Word。缺失报告显示缺失，不套用其他病例。

使用Python现有numpy和标准库，无需GPU。使用现有标签，尚未接入模型。只允许UI静态资源与特定病例API，不提供数据目录浏览和任意路径读取。服务当前无登录，能访问9070端口的内网用户可读取病例影像和报告。

服务采用用户级systemd，已启用linger，退出SSH后持续运行，开机启动，异常退出重启。

```bash
systemctl --user status lung-lab.service
systemctl --user restart lung-lab.service
systemctl --user stop lung-lab.service
journalctl --user -u lung-lab.service -n 50 --no-pager
```

配置：`~/.config/systemd/user/lung-lab.service`，默认端口9070。数据根目录通过启动参数`--data-root`配置。Excel映射在服务启动时读取；更新Excel后重启服务。CT/标签按需加载，启动页不预下载CT。标签要求单层三维unsigned char NRRD且与CT空间网格匹配；不支持的格式提示未叠加。通用病例未做显示方向标准化，因此不显示未经验证的方向字母。

新病例的Word字段按源表格显示，不从CT估算填写。三维、多层分割格式、在线模型与高并发优化属于后续功能。

已验证：服务器端30/6/216三个病例的CT与mask解压长度、报告关联；从客户端访问HTTP接口成功。浏览器启动页可读到服务器病例入口，部署后浏览器自动交互反复超时，尚未完成服务器网页中病例切换的端到端视觉验证。
