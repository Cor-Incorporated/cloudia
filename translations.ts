export const translations = {
  en: {
    title: "Cloudia — Cor. AI Reception",
    welcomeMessage:
      "Hello. I'm Cloudia, Cor. Inc.'s AI receptionist. I'll organize your inquiry in about 5–7 questions and hand it off to our team. Please do not enter confidential information such as customer names, personal data, or contract text. First, choose the purpose of your inquiry.",
    welcomeMessageAmbassador:
      "Hey there! I'm Cloudia Sorano, Cor.inc's AI Ambassador! 🚀 I've got all the company info, upcoming events, and can dive into our social media for the latest tech buzz. What can I help you with today?",
    piiNotice:
      "Do not enter confidential information during the chat (customer names, personal data, contracts, etc.). Contact details are collected only at the final submit step.",
    intentPickerLabel: "Inquiry purpose",
    intentPickerPrompt: "What is the purpose of your inquiry?",
    intentSelected: "Selected purpose: {{label}}",
    knowledgeUpdated: "Company knowledge updated. I'll use this information for my next answers.",
    thinking: "Thinking...",
    sendMessage: "Send",
    typeYourMessage: "Type your message...",
    typeYourMessageIntake: "Describe your inquiry (no confidential details)...",
    companyKnowledgeBase: "Company Knowledge Base",
    companyInfoMarkdown: "Company Information (Markdown)",
    companyInfoPlaceholder: "Paste company information, policies, FAQs, etc. in Markdown format.",
    calendarInfo: "Calendar Details / Key Events",
    calendarInfoPlaceholder: "Describe key company events, meetings, or calendar summaries. E.g., 'Weekly team meeting: Mondays at 10 AM. Project deadline: Next Friday.'",
    showPreview: "Show Preview",
    hidePreview: "Hide Preview",
    updateKnowledge: "Update Knowledge",
    markdownPreview: "Markdown Preview:",
    calendarInfoPreview: "Calendar Info Preview:",
    aiError: "Sorry, I encountered an error. Please try again.",
    aiDefaultError: "Error communicating with AI",
    sources: "Sources",
    selectIntentFirst: "Please select an inquiry purpose above before sending a message.",
    handoffTitle: "Contact details",
    handoffHint: "We will use this only to follow up. Do not paste confidential documents.",
    handoffName: "Name",
    handoffEmail: "Email",
    handoffCompany: "Company (optional)",
    handoffMessage: "Additional notes (optional)",
    handoffSubmit: "Submit inquiry",
    handoffSuccess: "Thank you. Your inquiry has been submitted.",
    fallbackNotice: "Chat is temporarily unavailable. You can use the form instead:",
    fallbackLink: "Open contact form",
    showHandoff: "Proceed to submit contact details",
  },
  ja: {
    title: "Cloudia — Cor. AI受付",
    welcomeMessage:
      "こんにちは。Cor.株式会社のAI受付 Cloudiaです。5〜7問でご相談内容を整理し、担当者へ引き継ぎます。顧客名、個人情報、契約書本文などの機密情報は入力しないでください。まず、ご相談の目的を選んでください。",
    welcomeMessageAmbassador:
      "おっす！クラウディア・ソラノっちゃん、Cor.incのAIアンバサダーやけん！🚀 会社の情報も、今度のイベントも、SNSの最新情報も全部知っとうよ〜。なんか聞きたいことあると？",
    piiNotice:
      "会話中に機密情報（顧客名、個人情報、契約書本文など）は入力しないでください。連絡先は最終送信時のみお伺いします。",
    intentPickerLabel: "ご相談の目的",
    intentPickerPrompt: "ご相談の目的を選んでください。",
    intentSelected: "選択中の目的: {{label}}",
    knowledgeUpdated: "会社の知識が更新されました。次回の回答からこの情報を使用します。",
    thinking: "確認しています…",
    sendMessage: "送信",
    typeYourMessage: "メッセージを入力…",
    typeYourMessageIntake: "ご相談内容を入力（機密情報は不可）…",
    companyKnowledgeBase: "企業ナレッジベース",
    companyInfoMarkdown: "会社情報（マークダウン）",
    companyInfoPlaceholder: "会社情報、ポリシー、FAQなどをマークダウン形式で貼り付けてください。",
    calendarInfo: "カレンダー詳細 / 主要イベント",
    calendarInfoPlaceholder: "主要な会社のイベント、会議、またはカレンダーの概要を記述してください。例：「週次チーム会議：月曜午前10時。プロジェクト期限：来週の金曜日」",
    showPreview: "プレビューを表示",
    hidePreview: "プレビューを非表示",
    updateKnowledge: "知識を更新",
    markdownPreview: "マークダウンプレビュー：",
    calendarInfoPreview: "カレンダー情報プレビュー：",
    aiError: "申し訳ありません、エラーが発生しました。もう一度お試しください。",
    aiDefaultError: "AIとの通信エラー",
    sources: "情報源",
    selectIntentFirst: "メッセージを送る前に、上のご相談目的を選択してください。",
    handoffTitle: "ご連絡先",
    handoffHint: "担当からのご連絡にのみ使用します。機密文書は貼り付けないでください。",
    handoffName: "お名前",
    handoffEmail: "メールアドレス",
    handoffCompany: "会社名（任意）",
    handoffMessage: "補足（任意）",
    handoffSubmit: "問い合わせを送信",
    handoffSuccess: "送信しました。担当よりご連絡します。",
    fallbackNotice: "チャットが一時的に利用できません。フォームをご利用ください:",
    fallbackLink: "お問い合わせフォームを開く",
    showHandoff: "連絡先の入力に進む",
  },
};

export type Locale = keyof typeof translations;

// Ensure all keys are present in all languages, defaulting to 'en' if a key is missing.
Object.keys(translations.en).forEach(key => {
  if (!translations.ja[key as keyof typeof translations.en]) {
    console.warn(`Missing Japanese translation for key: ${key}`);
  }
});
