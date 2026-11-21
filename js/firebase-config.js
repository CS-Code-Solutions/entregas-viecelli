// Substitua pelos dados reais do seu projeto no Console do Firebase
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// URL gerada após implantar o Google Apps Script (Web App)
const GAS_EMAIL_WEBHOOK_URL = "https://script.google.com/macros/s/SEU_ID_DE_IMPLANTACAO/exec";

// Inicializa o Firebase (SDK Compat v10)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
