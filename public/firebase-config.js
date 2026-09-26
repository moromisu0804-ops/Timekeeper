// ここにFirebaseコンソールで取得した設定値を貼り付けてください。
// 確認場所: Firebaseコンソール > プロジェクトの設定(歯車アイコン) > 全般 > マイアプリ
// 「ウェブアプリを追加」した際に表示される firebaseConfig の中身をそのままコピーしてOKです。
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// このアプリへのログインを許可するGoogleアカウントのメールアドレス一覧。
// ※ここを変更した場合は、firestore.rules 内の許可メールアドレスも
//   必ず同じ内容に合わせて変更し、再デプロイしてください（クライアント側の
//   このチェックだけでは本当の安全性は担保できないため、実際のアクセス制御は
//   firestore.rules 側で行っています）。
export const ALLOWED_EMAILS = ["moro.misu0804@gmail.com"];
