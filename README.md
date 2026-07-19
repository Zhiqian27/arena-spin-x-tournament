# Arena Spin-X Tournament

面向赛事工作人员的本地实时评分系统，包含控制台、团队积分统计、观赛大屏与排名超越动画。

## 功能

- 四个比赛项目的团队累计计分
- 0–10 整数评分、项目总分与团队总积分排名
- 控制台固定录入顺序及抽签拖拽排序
- 独立观赛大屏、发布后更新与排名超越动画

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

## License

[MIT](LICENSE)
