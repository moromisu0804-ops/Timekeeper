// ここにFirebaseコンソールで取得した設定値を貼り付けてください。
// 確認場所: Firebaseコンソール > プロジェクトの設定(歯車アイコン) > 全般 > マイアプリ
// 「ウェブアプリを追加」した際に表示される firebaseConfig の中身をそのままコピーしてOKです。
export const firebaseConfig = {
  apiKey: "AIzaSyAGYhCt0EuJZBdCTSUqO1gYsgOFj8iIMT4",
  authDomain: "timekeeper-36443.firebaseapp.com",
  projectId: "timekeeper-36443",
  storageBucket: "timekeeper-36443.firebasestorage.app",
  messagingSenderId: "909638145542",
  appId: "1:909638145542:web:6c535e66eefdba34f11587",
};

// このアプリへのログインを許可するGoogleアカウントのメールアドレス一覧。
// ※ここを変更した場合は、firestore.rules 内の許可メールアドレスも
//   必ず同じ内容に合わせて変更し、再デプロイしてください（クライアント側の
//   このチェックだけでは本当の安全性は担保できないため、実際のアクセス制御は
//   firestore.rules 側で行っています）。
export const ALLOWED_EMAILS = ["moro.misu0804@gmail.com"];
