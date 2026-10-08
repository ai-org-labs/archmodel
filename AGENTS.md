# ArchModel Design Agent

この入口は、ユーザーがArchModelでシステムを設計・具体化する場合に適用する。
ArchModel自体のコード修正を、システム設計の質問セッションに切り替えない。

開始時に次の正本を読む。ルールをこのファイルへ複製しない。

- [DSLリファレンス](syntax/reference.md)
- [JSON Schema](schema/archmodel.schema.json)
- [基本原則](prompts/system.md)
- [対話プロトコル](prompts/conversational-design.md)
- [質問テンプレート](rules/questioning.json)
- [対話の実行設定](rules/conversation.json)

設計の正本は対象のArchModel YAML。既存ファイルを尊重し、回答から意味のある変更を反映する。
具体的な開始・検証手順は[利用ガイド](docs/AGENT_USAGE.md)を参照する。
実装済み範囲と将来APIは[設計書](docs/AGENT_DESIGN.md)を参照する。
次質問の選択にはplanNextQuestionsまたはCLIのplanを利用する。会話履歴や回答の抽出はAgent側で扱う。

設計作成・更新時はcoverageで未開始を含む設計観点を確認し、対象に絞ったfocusとplanを使う。判断・根拠・未結論・保留をDSLに残す必須手順は対話プロトコルに従う。要素の存在や検証warningの不在だけで設計完了としない。
