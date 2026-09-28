import type { SideHustleDefinition } from "@/features/side-hustles/types";

export type SideHustleScenarioKnowledge = {
  key: string;
  fieldKey: string;
  category: "medium" | "experience" | "objective" | "production" | "sales" | "risk";
  label: string;
  guidance: readonly string[];
  deliverables: readonly string[];
  cautions: readonly string[];
};

type ScenarioCompileResult = {
  promptBlock: string;
  applied: string[];
};

function scenarioRule(
  fieldKey: string,
  category: SideHustleScenarioKnowledge["category"],
  label: string,
  guidance: readonly string[],
  deliverables: readonly string[] = [],
  cautions: readonly string[] = [],
): SideHustleScenarioKnowledge {
  return { key: fieldKey, fieldKey, category, label, guidance, deliverables, cautions };
}

const R = scenarioRule;

export const SIDE_HUSTLE_SCENARIO_KNOWLEDGE: Readonly<Record<string, readonly SideHustleScenarioKnowledge[]>> = {
  "content-sales": [
    R("platform", "medium", "販売媒体", ["{{value}}の閲覧・購入導線に合わせ、見出し、無料範囲、CTA、補足説明の置き方を調整する"], ["媒体向け公開チェック"]),
    R("product_type", "production", "商品形態", ["{{value}}として購入後に使える完成物を先に定義し、章数より成果物の実用性を優先する"], ["完成物一覧", "章ごとの成果物"]),
    R("buyer_stage", "experience", "購入者経験", ["{{value}}に合わせ、前提知識、用語説明、手順の粒度、応用例の量を変える"], ["レベル別つまずき対策"]),
    R("value_type", "objective", "購入後価値", ["{{value}}を購入後の到達点として、各章がその到達点へどう寄与するかを明確にする"], ["到達状態チェック"]),
    R("free_paid_boundary", "sales", "無料・有料境界", ["{{value}}の境界を守り、無料部分だけでも判断材料を残し、有料部分では実行可能性を高める"], ["無料/有料の役割表"]),
    R("proof_material", "risk", "根拠素材", ["{{value}}だけを根拠として扱い、入力されていない実績・体験・販売結果は補完しない"], ["根拠利用一覧"], ["根拠の種類を本文内で混同しない"]),
  ],
  "sns-management": [
    R("platform", "medium", "SNS媒体", ["{{value}}の閲覧単位と投稿形式に合わせ、文章量・視覚情報・CTAの置き方を変える"], ["媒体別投稿型"]),
    R("account_stage", "experience", "運用段階", ["{{value}}の段階に応じて、新規なら土台作り、継続中なら改善、再開なら復帰導線を優先する"], ["段階別優先順位"]),
    R("objective", "objective", "集客目的", ["{{value}}を最優先KPIに置き、投稿の柱・プロフィール・CTAを同じ目的へそろえる"], ["目的別CTA設計"]),
    R("content_style", "production", "投稿制作形式", ["{{value}}を中心に、継続制作できるテンプレートと再利用単位へ分解する"], ["投稿テンプレート"]),
    R("posting_cycle", "production", "投稿頻度", ["{{value}}で無理なく続けられる制作バッチとネタ在庫量を設計する"], ["週間制作計画"]),
    R("conversion_path", "sales", "最終導線", ["{{value}}までの遷移を短くし、投稿ごとのCTAを一度に1つへ絞る"], ["導線マップ"], ["成果保証ではなく次の行動を明確にする"]),
  ],
  "youtube-video": [
    R("format", "medium", "動画媒体・尺", ["{{value}}の尺と視聴文脈に合わせ、冒頭速度、情報密度、CTAタイミングを変える"], ["尺別構成"]),
    R("channel_stage", "experience", "チャンネル段階", ["{{value}}では既存視聴者前提を置きすぎず、段階に合う企画の役割を定義する"], ["段階別企画方針"]),
    R("video_goal", "objective", "動画目的", ["{{value}}を1本の主目的として、タイトル・冒頭・本編・CTAの約束を一致させる"], ["目的整合チェック"]),
    R("production_style", "production", "制作方式", ["{{value}}で必要な撮影素材、台本粒度、編集工程、差し替え素材を具体化する"], ["撮影素材表", "編集チェック"]),
    R("hook_style", "production", "冒頭フック", ["{{value}}を使いつつ、本編に存在しない結果や煽りを追加しない"], ["冒頭15秒案"], ["タイトル・サムネと内容の不一致を避ける"]),
    R("next_action", "sales", "視聴後CTA", ["{{value}}を唯一の主CTAとして、視聴価値を渡した後に自然に置く"], ["CTA文案"]),
  ],
  "affiliate": [
    R("channel", "medium", "集客媒体", ["{{value}}から来る読者が比較判断しやすい情報量・導線・開示方法へ調整する"], ["媒体別導線"]),
    R("product_type", "production", "紹介カテゴリ", ["{{value}}で購入判断に必要な仕様・費用・制約・向き不向きの比較軸を定義する"], ["カテゴリ別比較軸"]),
    R("reader_stage", "experience", "検討段階", ["{{value}}に合わせ、問題整理・候補発見・比較・最終確認のどこを厚くするか変える"], ["検討段階別不足情報"]),
    R("comparison_style", "objective", "比較方式", ["{{value}}でも全候補に同じ評価軸を適用し、都合のよい比較項目だけを選ばない"], ["公平な比較表"]),
    R("evidence", "risk", "根拠レベル", ["{{value}}の範囲だけで断定し、公式事実・自身の経験・第三者評価を分離する"], ["根拠区分表"], ["未確認価格・在庫・キャンペーン・評価を固定情報にしない"]),
    R("cta", "sales", "広告CTA", ["{{value}}へ誘導する際も、購入を急がせず確認条件を残す"], ["判断支援型CTA"]),
  ],
  "resale": [
    R("marketplace", "medium", "販売先", ["{{value}}の出品項目・購入者期待・配送表示に合わせて説明順を整える"], ["販売先別出品チェック"]),
    R("category", "production", "商品カテゴリ", ["{{value}}で購入者が確認したい状態箇所・付属品・動作項目を優先して記載する"], ["カテゴリ別撮影項目"]),
    R("condition", "risk", "商品状態", ["{{value}}として確認済みの事実だけを書き、不明点は不明と明示する"], ["状態確認表"], ["正規品・動作・購入時期など未確認事項を推測しない"]),
    R("inventory", "sales", "仕入れ形態", ["{{value}}に応じて原価・在庫リスク・再調達性・保管負担を分けて考える"], ["原価確認項目"]),
    R("shipping", "production", "発送方針", ["{{value}}を前提に、梱包、サイズ、破損リスク、発送前確認を具体化する"], ["梱包・発送チェック"]),
    R("goal", "objective", "販売優先事項", ["{{value}}を優先しつつ、状態説明や取引安全を犠牲にしない"], ["優先順位に沿った出品改善"]),
  ],
  "skill-sales": [
    R("platform", "medium", "販売媒体", ["{{value}}の購入前情報・メッセージ導線・納品方法に合うサービス説明へ調整する"], ["媒体別販売ページ項目"]),
    R("service", "production", "提供スキル", ["{{value}}で納品できる具体物、必要入力、作業範囲、対象外を先に定義する"], ["納品物定義"]),
    R("buyer_problem", "experience", "購入者課題", ["{{value}}を解決対象として、購入前に必要な情報と購入後にできることを分ける"], ["課題→成果物対応表"]),
    R("delivery", "production", "納品形態", ["{{value}}に合うファイル構成、確認方法、受け渡し手順を具体化する"], ["納品チェック"]),
    R("revision", "risk", "修正条件", ["{{value}}を曖昧にせず、回数・範囲・追加料金が未確定なら確定事項だけ記載する"], ["修正範囲定義"], ["無制限対応を暗黙に約束しない"]),
    R("positioning", "sales", "サービスの強み", ["{{value}}を、実績の誇張ではなく提供範囲・速度・分かりやすさ・成果物品質など確認可能な価値で表す"], ["訴求軸"]),
  ],
  "digital-product": [
    R("format", "medium", "商品形式", ["{{value}}で購入者が迷わず使える閲覧順・配布単位・更新方法を設計する"], ["形式別構成"]),
    R("buyer_level", "experience", "購入者レベル", ["{{value}}に合わせて前提知識、用語説明、課題難度、応用範囲を調整する"], ["レベル別補足"]),
    R("outcome", "objective", "購入後の完成状態", ["{{value}}を最終成果として、各章・テンプレート・課題を逆算配置する"], ["成果物ロードマップ"]),
    R("scope", "production", "商品ボリューム", ["{{value}}の範囲内で完結させ、量ではなく使い切れる構成を優先する"], ["収録物一覧"]),
    R("sales_channel", "sales", "販売経路", ["{{value}}の販売ページ・決済前説明・配布方法に合わせて購入前情報を整理する"], ["販売導線"]),
    R("support", "risk", "購入後サポート", ["{{value}}の範囲を明示し、期間・回数・返信速度を未入力なら勝手に約束しない"], ["サポート範囲"], ["成果や返信時間を保証しない"]),
  ],
  "crowdsourcing": [
    R("platform", "medium", "案件媒体", ["{{value}}の案件文・応募欄・契約フローに合わせて、応募前確認項目を整理する"], ["媒体別応募チェック"]),
    R("job_type", "production", "案件種別", ["{{value}}で求められる成果物・入力情報・品質確認・納品形式を分解する"], ["作業工程"]),
    R("experience", "experience", "提示可能な経験", ["{{value}}の事実だけで適合理由を書き、経験不足は学習計画や確認質問で補う"], ["事実ベースの適合説明"], ["実績・資格・経験年数を創作しない"]),
    R("deadline", "objective", "納期条件", ["{{value}}に合わせて作業分解、確認日、バッファ、納品前チェックを置く"], ["納期逆算表"]),
    R("proposal_style", "sales", "応募文方針", ["{{value}}のトーンで、案件要件への回答→根拠→進め方→確認事項の順に短くまとめる"], ["応募文"]),
    R("risk", "risk", "契約リスク", ["{{value}}を契約前に確認し、不明点を推測で埋めず質問として残す"], ["契約前質問"]),
  ],
  "outreach": [
    R("target", "experience", "営業対象", ["{{value}}が判断しやすい業務上の価値と用語で提案し、相手の事情を勝手に決めつけない"], ["対象別訴求"]),
    R("relationship", "experience", "関係性", ["{{value}}に応じて自己紹介量・前提説明・連絡理由を調整する"], ["関係性別導入文"]),
    R("offer", "production", "提案内容", ["{{value}}の成果物・範囲・開始条件を具体化し、抽象的な『何でもできます』を避ける"], ["提案要点"]),
    R("channel", "medium", "連絡手段", ["{{value}}の長さ・返信性・マナーに合わせて文量と情報量を調整する"], ["媒体別営業文"]),
    R("ask", "sales", "最初の依頼", ["{{value}}を小さな次の一歩として1つだけ提示し、圧力をかけない"], ["単一CTA"]),
    R("followup", "risk", "フォローアップ", ["{{value}}でも連投・威圧・虚偽の締切を避け、相手が断れる余地を残す"], ["フォローアップ文"], ["返信を保証・強要しない"]),
  ],
  "sidejob-planner": [
    R("time", "production", "利用可能時間", ["{{value}}で継続できる作業量へ候補を絞り、学習・制作・営業の時間を分ける"], ["週間時間配分"]),
    R("budget", "risk", "初期予算", ["{{value}}を上限として、無料検証→小額検証→拡張の順に考える"], ["初期費用比較"], ["高額投資を成功条件にしない"]),
    R("strength", "experience", "得意分野", ["{{value}}を既存資産として活かしつつ、未経験領域に必要な習得項目も明示する"], ["強み活用マップ"]),
    R("sales", "sales", "営業適性", ["{{value}}に合わせ、営業型・プラットフォーム型・コンテンツ型など案件獲得方法を変える"], ["獲得経路比較"]),
    R("creation", "objective", "作りたい成果物", ["{{value}}を継続して作れる副業候補を優先し、収益性だけで選ばない"], ["候補比較"]),
    R("risk", "risk", "重視条件", ["{{value}}を撤退/継続基準に反映し、30日で検証可能な指標に落とす"], ["30日検証計画"], ["収益や成功確率を保証しない"]),
  ],
  "research": [
    R("research_type", "production", "調査タイプ", ["{{value}}に必要な一次情報・比較対象・検証手順を先に定義する"], ["調査設計"]),
    R("decision", "objective", "意思決定", ["{{value}}を決めるために必要な問いだけへ分解し、周辺情報の収集を増やしすぎない"], ["意思決定基準"]),
    R("source_priority", "risk", "情報源優先度", ["{{value}}を優先し、一次情報と解説記事を同列に扱わない"], ["情報源階層"], ["検索スニペットだけで結論を出さない"]),
    R("freshness", "risk", "必要な最新性", ["{{value}}に応じて公開日・更新日・対象期間を必ず記録する"], ["鮮度確認"]),
    R("scope", "production", "比較範囲", ["{{value}}を同一条件で比較できるよう対象・地域・プラン・期間をそろえる"], ["比較条件表"]),
    R("deliverable", "medium", "調査成果物", ["{{value}}で事実・解釈・未確認事項を区別して読み手が再確認できる形にする"], ["最終成果物"]),
  ],
  "workflow-efficiency": [
    R("workflow", "production", "対象業務", ["{{value}}を入力→処理→確認→保存→例外対応へ分解する"], ["業務分解"]),
    R("current_state", "experience", "現在の状態", ["{{value}}を起点に、既存手順を残す部分と変更する部分を分ける"], ["Before/After"]),
    R("automation", "production", "自動化範囲", ["{{value}}ではAIに任せる工程と人が確認する工程を明確に分離する"], ["自動/手動境界"]),
    R("risk", "risk", "誤りの影響", ["{{value}}に応じて承認、二重確認、ログ、ロールバック手順を強くする"], ["安全チェック"], ["機密情報や権限を勝手に外部AIへ渡す前提にしない"]),
    R("frequency", "objective", "実行頻度", ["{{value}}に合わせ、テンプレート化・バッチ処理・自動化の投資効果を判断する"], ["運用頻度別改善"]),
    R("output", "medium", "欲しい成果物", ["{{value}}を現場で再利用できる形式にし、例外時の戻り方も含める"], ["SOP成果物"]),
  ],
};

function fill(lines: readonly string[], value: string): string[] {
  return lines.map((line) => line.replaceAll("{{value}}", value));
}

function unique(lines: string[]): string[] {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

export function compileSideHustleScenarioKnowledge(
  definition: SideHustleDefinition,
  resolved: Readonly<Record<string, string>>,
): ScenarioCompileResult {
  const rules = SIDE_HUSTLE_SCENARIO_KNOWLEDGE[definition.slug] ?? [];
  const active = rules.filter((rule) => {
    const value = resolved[rule.fieldKey]?.trim();
    return Boolean(value && value !== "未指定" && value !== "自由入力未記入");
  });

  if (!active.length) return { promptBlock: "", applied: [] };

  const guidance = unique(active.flatMap((rule) => fill(rule.guidance, resolved[rule.fieldKey] ?? "")));
  const deliverables = unique(active.flatMap((rule) => fill(rule.deliverables, resolved[rule.fieldKey] ?? "")));
  const cautions = unique(active.flatMap((rule) => fill(rule.cautions, resolved[rule.fieldKey] ?? "")));

  const sections = [
    "【状況別副業KNOWLEDGE】",
    ...active.map((rule) => `- ${rule.label}: ${resolved[rule.fieldKey]}`),
    "",
    "【今回の条件に合わせた制作ルール】",
    ...guidance.map((line) => `- ${line}`),
  ];
  if (deliverables.length) sections.push("", "【状況別の追加成果物】", ...deliverables.map((line) => `- ${line}`));
  if (cautions.length) sections.push("", "【状況別の注意】", ...cautions.map((line) => `- ${line}`));

  return {
    promptBlock: sections.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n"),
    applied: active.map((rule) => `状況別: ${rule.label}`),
  };
}

export function countScenarioKnowledgeRules(slug: string): number {
  return SIDE_HUSTLE_SCENARIO_KNOWLEDGE[slug]?.length ?? 0;
}
