export type AiAppKey = "chatgpt" | "claude" | "gemini";

export type AiAppLink = {
  key: AiAppKey;
  name: string;
  webUrl: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  iosScheme: string;
  androidPackage: string;
  description: string;
};

export const AI_APP_LINKS: Record<AiAppKey, AiAppLink> = {
  chatgpt: {
    key: "chatgpt",
    name: "ChatGPT",
    webUrl: "https://chatgpt.com/",
    iosStoreUrl: "https://apps.apple.com/jp/app/chatgpt/id6448311069",
    androidStoreUrl: "https://play.google.com/store/apps/details?id=com.openai.chatgpt",
    iosScheme: "chatgpt://",
    androidPackage: "com.openai.chatgpt",
    description: "アイデア出し・記事作成・画像生成",
  },
  claude: {
    key: "claude",
    name: "Claude",
    webUrl: "https://claude.ai/",
    iosStoreUrl: "https://apps.apple.com/jp/app/claude-by-anthropic/id6473753684",
    androidStoreUrl: "https://play.google.com/store/apps/details?id=com.anthropic.claude",
    iosScheme: "claude://",
    androidPackage: "com.anthropic.claude",
    description: "長文作成・推敲・深い整理",
  },
  gemini: {
    key: "gemini",
    name: "Gemini",
    webUrl: "https://gemini.google.com/",
    iosStoreUrl: "https://apps.apple.com/jp/app/google-gemini/id6477489729",
    androidStoreUrl: "https://play.google.com/store/apps/details?id=com.google.android.apps.bard",
    iosScheme: "googleapp://robin",
    androidPackage: "com.google.android.apps.bard",
    description: "調査・情報整理・Google連携",
  },
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

function buildAndroidIntent(app: AiAppLink): string {
  const target = new URL(app.webUrl);
  const path = `${target.host}${target.pathname}${target.search}`;
  return `intent://${path}#Intent;scheme=https;package=${app.androidPackage};S.browser_fallback_url=${encodeURIComponent(app.androidStoreUrl)};end`;
}

function openWebApp(app: AiAppLink): void {
  // Use a real target=_blank anchor instead of window.open so mobile Safari/PWA
  // keeps the AAS page available while the provider Web app opens separately.
  const anchor = document.createElement("a");
  anchor.href = app.webUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.setAttribute("aria-hidden", "true");
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function openIosScheme(app: AiAppLink): void {
  // Keep the AAS page in place while iOS handles the provider custom scheme.
  // A real anchor click preserves a direct user gesture and avoids navigating
  // the current AAS tab to a custom-scheme URL when the user cancels.
  const anchor = document.createElement("a");
  anchor.href = app.iosScheme;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.setAttribute("aria-hidden", "true");
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function showIosLaunchChoice(app: AiAppLink): void {
  document.getElementById("aas-ios-ai-launch-choice")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "aas-ios-ai-launch-choice";
  backdrop.className = "ai-ios-launch-backdrop";

  const dialog = document.createElement("div");
  dialog.className = "ai-ios-launch-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", `${app.name}を開く方法`);

  const title = document.createElement("strong");
  title.textContent = `${app.name}をどちらで開きますか？`;

  const help = document.createElement("p");
  help.textContent = "iPhone / iPadでは自動判定を行いません。アプリが入っている場合は「アプリを開く」を選んでください。";

  const actions = document.createElement("div");
  actions.className = "ai-ios-launch-actions";

  const appButton = document.createElement("button");
  appButton.type = "button";
  appButton.className = "ai-ios-launch-primary";
  appButton.textContent = `${app.name}アプリを開く`;

  const webButton = document.createElement("button");
  webButton.type = "button";
  webButton.className = "ai-ios-launch-secondary";
  webButton.textContent = "Web版を開く";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "ai-ios-launch-cancel";
  cancelButton.textContent = "キャンセル";

  const cleanup = () => backdrop.remove();

  appButton.addEventListener("click", () => {
    cleanup();
    openIosScheme(app);
  });
  webButton.addEventListener("click", () => {
    cleanup();
    openWebApp(app);
  });
  cancelButton.addEventListener("click", cleanup);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) cleanup();
  });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cleanup();
  });

  actions.append(appButton, webButton);
  dialog.append(title, help, actions, cancelButton);
  backdrop.append(dialog);
  document.body.append(backdrop);
  appButton.focus();
}

function openAiProvider(app: AiAppLink): void {
  if (isAndroid()) {
    window.location.assign(buildAndroidIntent(app));
    return;
  }

  if (isIos()) {
    showIosLaunchChoice(app);
    return;
  }

  openWebApp(app);
}

type AiUsageGuide = {
  eyebrow: string;
  title: string;
  intro: string;
  regularTitle: string;
  regularText: string;
  temporaryTitle: string;
  temporaryText: string;
  temporaryNote: string;
  stepsTitle: string;
  stepsText: string;
  handoffText: string;
};

const AI_USAGE_GUIDES: Record<AiAppKey, AiUsageGuide> = {
  chatgpt: {
    eyebrow: "CHATGPT GUIDE",
    title: "ChatGPTは通常チャット・一時チャットのどちらでも使えます",
    intro: "用途に合わせて選んでください。AASから一時チャットを自動選択することはできないため、ChatGPT側で開始方法を選びます。",
    regularTitle: "通常チャット",
    regularText: "あとで続きから作業したい記事、シリーズ記事、継続して育てる内容に向いています。",
    temporaryTitle: "一時チャット",
    temporaryText: "履歴へ残さず単発で記事を作りたい時に使えます。既存の好みを反映したい場合は、会話開始前に「パーソナライズあり」を選んでください。",
    temporaryNote: "パーソナライズありでは既存のメモリ・カスタム指示等を利用できますが、一時チャット中はメモリを新規作成・更新しません。開始後はパーソナライズ設定を変更できません。",
    stepsTitle: "一時チャットで使う場合",
    stepsText: "ChatGPTを開く → 一時チャットを選ぶ → 必要なら「パーソナライズあり」を選ぶ → AASでコピーしたプロンプトを貼り付ける",
    handoffText: "AASの「設定 → AI・文章の好み」では、自分の文章設定をChatGPTへ明示的に渡す引き継ぎプロンプトを作れます。ChatGPTのメモリやカスタム指示へ自動登録する機能ではありません。",
  },
  claude: {
    eyebrow: "CLAUDE GUIDE",
    title: "Claudeは通常チャット・シークレットチャットを使い分けできます",
    intro: "用途に合わせて選んでください。AASからシークレットチャットを自動選択することはできないため、Claude側で開始方法を選びます。",
    regularTitle: "通常チャット",
    regularText: "履歴やClaudeのメモリを活用しながら、あとで続きを行いたい記事・長文作成に向いています。",
    temporaryTitle: "シークレットチャット",
    temporaryText: "履歴やClaudeのメモリへ残さず、単発で作業したい時に使えます。既存のClaudeメモリはシークレットチャットでは使用されません。",
    temporaryNote: "カスタムスタイルや個人設定などのプロフィール情報は利用できます。シークレットチャットは通常チャットへ変換・保存できないため、必要な完成文はAASへ戻す前にコピーしてください。",
    stepsTitle: "シークレットチャットで使う場合",
    stepsText: "Claudeを開く → 新規チャット画面のゴーストアイコンでシークレットモードを有効化 → AASでコピーしたプロンプトを貼り付ける",
    handoffText: "AASの「設定 → AI・文章の好み」では、自分の文章設定をClaudeへ明示的に渡す引き継ぎプロンプトを作れます。Claudeのメモリ・プロフィール・カスタムスタイルへ自動登録する機能ではありません。",
  },
  gemini: {
    eyebrow: "GEMINI GUIDE",
    title: "Geminiは通常チャット・一時チャットを使い分けできます",
    intro: "用途に合わせて選んでください。AASから一時チャットを自動選択することはできないため、Gemini側で開始方法を選びます。",
    regularTitle: "通常チャット",
    regularText: "利用可能な場合、過去チャットや接続したGoogleサービス等を使ったパーソナライズを活用しながら継続作業できます。",
    temporaryTitle: "一時チャット",
    temporaryText: "最近のチャットやGemini Apps Activityへ残さず、単発で使いたい時に向いています。一時チャットではパーソナライズされた回答は利用できません。",
    temporaryNote: "一時チャットの内容は将来のパーソナライズ用情報として保存されません。Gemsや、一時チャットでは利用できない接続サービス等がある点にも注意してください。",
    stepsTitle: "一時チャットで使う場合",
    stepsText: "Geminiを開く → 一時チャットを選ぶ → AASでコピーしたプロンプトを貼り付ける",
    handoffText: "AASの「設定 → AI・文章の好み」では、自分の文章設定をGeminiへ明示的に渡す引き継ぎプロンプトを作れます。GeminiのPersonal Intelligenceや保存済み指示へ自動登録する機能ではありません。",
  },
};

function showAiUsageGuide(app: AiAppLink): void {
  document.getElementById("aas-ai-usage-guide")?.remove();
  const guide = AI_USAGE_GUIDES[app.key];

  const backdrop = document.createElement("div");
  backdrop.id = "aas-ai-usage-guide";
  backdrop.className = "ai-usage-backdrop";

  const dialog = document.createElement("div");
  dialog.className = "ai-usage-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", `${app.name}を使う前の案内`);

  const eyebrow = document.createElement("span");
  eyebrow.className = "ai-usage-eyebrow";
  eyebrow.textContent = guide.eyebrow;

  const title = document.createElement("strong");
  title.textContent = guide.title;

  const intro = document.createElement("p");
  intro.textContent = guide.intro;

  const choices = document.createElement("div");
  choices.className = "ai-usage-choices";

  const normal = document.createElement("section");
  normal.className = "ai-usage-choice";
  const normalTitle = document.createElement("strong");
  normalTitle.textContent = guide.regularTitle;
  const normalText = document.createElement("p");
  normalText.textContent = guide.regularText;
  normal.append(normalTitle, normalText);

  const temporary = document.createElement("section");
  temporary.className = "ai-usage-choice recommended";
  const temporaryTitle = document.createElement("strong");
  temporaryTitle.textContent = guide.temporaryTitle;
  const temporaryText = document.createElement("p");
  temporaryText.textContent = guide.temporaryText;
  const temporaryNote = document.createElement("small");
  temporaryNote.textContent = guide.temporaryNote;
  temporary.append(temporaryTitle, temporaryText, temporaryNote);

  choices.append(normal, temporary);

  const steps = document.createElement("div");
  steps.className = "ai-usage-steps";
  const stepsTitle = document.createElement("strong");
  stepsTitle.textContent = guide.stepsTitle;
  const stepsText = document.createElement("p");
  stepsText.textContent = guide.stepsText;
  steps.append(stepsTitle, stepsText);

  const handoff = document.createElement("div");
  handoff.className = "ai-usage-handoff";
  const handoffTitle = document.createElement("strong");
  handoffTitle.textContent = "AASのパーソナライズ引き継ぎ";
  const handoffText = document.createElement("p");
  handoffText.textContent = guide.handoffText;
  const handoffLink = document.createElement("a");
  handoffLink.href = "/settings";
  handoffLink.textContent = "AASの設定を開く";
  handoff.append(handoffTitle, handoffText, handoffLink);

  const actions = document.createElement("div");
  actions.className = "ai-usage-actions";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "ai-usage-primary";
  openButton.textContent = `${app.name}を開く`;

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "ai-usage-cancel";
  cancelButton.textContent = "キャンセル";

  const cleanup = () => backdrop.remove();
  openButton.addEventListener("click", () => {
    cleanup();
    openAiProvider(app);
  });
  cancelButton.addEventListener("click", cleanup);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) cleanup();
  });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cleanup();
  });

  actions.append(openButton, cancelButton);
  dialog.append(eyebrow, title, intro, choices, steps, handoff, actions);
  backdrop.append(dialog);
  document.body.append(backdrop);
  openButton.focus();
}

/**
 * Open an AI provider without embedding API credentials.
 *
 * Every supported provider shows a short provider-specific guide before
 * leaving AAS so users can intentionally choose regular vs temporary/private
 * chat behavior. Android keeps the package intent with an official store
 * fallback. iPhone/iPad cannot reliably expose installed-app state to a PWA,
 * so AAS presents an explicit app/Web choice after the guide.
 */
export function launchAiApp(key: AiAppKey): void {
  if (typeof window === "undefined") return;
  showAiUsageGuide(AI_APP_LINKS[key]);
}
