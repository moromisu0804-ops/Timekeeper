// ここにFirebaseコンソールで取得した設定値を貼り付けてください。
// 確認場所: Firebaseコンソール > プロジェクトの設定(歯車アイコン) > 全般 > マイアプリ
// 「ウェブアプリを追加」した際に表示される firebaseConfig の中身をそのままコピーしてOKです。
//
// 【安全性について】
// ここに書く値(apiKeyなど)はFirebaseの仕様上、公開されても問題ない値です
// (実際のアクセス制御はfirestore.rules側のUIDチェックで行っています)。
// メールアドレスなど個人が特定できる情報は、このファイルには一切含めません。
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
