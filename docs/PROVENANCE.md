# 派生元

ArchModelの描画・配置基盤は、ローカルのarchmap-mermaidコミット
`a2da4f85f251f58c2eb9bf8c02272d78f2b3fa16`から派生しています。

継承: src/focused、src/icons.ts、src/mermaid.ts（元index.ts）、vendor、Mermaid回帰テスト、第三者帰属。
変更: パッケージ名、ビルド名、サイト、単一HTML出力、CI。
追加: src/model、schema、rules、guidance、templates、prompts、新DSLサンプル、CLI、受入テスト。

Mermaidパーサーは互換モジュールと回帰テスト用に残しています。ArchModelのYAML解析・意味モデル・グラフ射影はMermaid入力を経由せず、継承したSVGレンダラーを直接利用します。

元リポジトリのGit履歴・remoteは引き継ぎません。LICENSEとTHIRD_PARTY_NOTICES.mdを保持します。
