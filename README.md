# Arena Spin-X Tournament

面向赛事工作人员的本地实时评分系统，包含控制台、团队积分统计、观赛大屏与排名超越动画。

## 功能

- 四个比赛项目的团队累计计分
- 自由输入评委分数、项目总分与团队总积分排名
- 控制台固定录入顺序及抽签拖拽排序
- 独立观赛大屏、发布后更新与排名超越动画
- 可编辑赛事名称、赛事归档、导入恢复与 GitHub 历史档案

## 本地运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址进入控制台，点击“打开观赛大屏”进入显示页面。

## 测试与构建

```bash
npm test
npm run build
```

## 部署

推送到 GitHub 的 `main` 分支后，GitHub Actions 会自动部署到 GitHub Pages。

> 当前数据使用浏览器本地存储。同一浏览器中的控制台和大屏可以同步；跨设备实时协作需要额外部署后端和数据库。

## 保存历届成绩到 GitHub

1. 比赛结束后，在控制台点击“保存本届成绩”，下载 JSON 档案。
2. 将下载的 JSON 放入 `public/archives/`。
3. 在 `public/archives/index.json` 加入该档案的信息；格式见该目录的 `README.md`。
4. 提交并推送到 `main` 分支。GitHub Pages 部署完成后，所有访问者都能在“赛事归档”区域查看、下载或恢复历届成绩。

“开启下一届”会让工作人员输入新赛事名称，并将当前团队的分数清零；请先完成归档。

## License

[MIT](LICENSE)
