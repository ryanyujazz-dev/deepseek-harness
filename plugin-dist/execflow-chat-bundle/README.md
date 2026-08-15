# @ryanyujazz/dsh-execflow-chat

将 DeepSeek Harness 官方"对话"tab 整体替换为 ExecFlow 执行流视图的覆盖 bundle。

## 功能

- 单槽位工具聚合(起草 → 运行 → 聚合头,可展开)
- 起草阶段可见行(Editing / Creating / Planning / Coding / Updating todos)
- Think 双形态(Normal:纯执行流;Think:内联思考+15 行钳制+渐变遮罩+Show more)
- 方向性折叠折角(收起向右、展开向下,图标常驻)
- Inspect 跳转轨迹视图并聚焦对应调用
- 像素级对齐体系(图标轴线垂线、展开内容与标题对齐)

## 用户安装(原版 dsh)

```sh
dsh plugin --profile web add @ryanyujazz/dsh-execflow-chat
```

重启 `dsh web` 生效。卸载:

```sh
dsh plugin --profile web remove @ryanyujazz/dsh-execflow-chat
```

## 发布流程(维护者)

发布物共三个包(版本号三者同步):

1. **`@ryanyujazz/dsh-client-ui-conversation`** — fork 的 `packages/client/ui-conversation`,
   发布前把 package.json 的 `name` 改为该 scope,`repository.directory` 指向你的 fork;
   在仓库根 `pnpm --filter @ryanyujazz/dsh-client-ui-conversation publish`(pnpm 会把
   `workspace:^` 依赖替换为实际版本号)。
2. **`@ryanyujazz/dsh-client-ui-tool`** — 同上,`packages/client/ui-tool`。
3. **本 bundle** — `plugin-dist/execflow-chat-bundle/` 目录,`npm publish`。

三个包的 peerDependencies 声明测试过的 dsh 版本区间,用户 dsh 过新/过旧时
`dsh plugin add` 阶段 pnpm 会警告。

## 维护(跟随上游)

```sh
git fetch upstream && git merge upstream/master
pnpm run build:lib && pnpm run build:web   # 类型错误 = 契约漂移,当场暴露
# 三包同版本号重发
```

## 兼容性边界

- 槽键与官方一致:feedback / deliverables / trajectory 等官方插件全部照常工作
- 官方 chatStore 字段未改:持久化(`dsh.conversation.chat`)与存量会话兼容
- 已验证不依赖任何 fork 内新增的平台模块导出(ui-primitives 保持原版形状)
